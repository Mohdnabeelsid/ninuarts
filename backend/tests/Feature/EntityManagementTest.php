<?php

namespace Tests\Feature;

use App\Models\BusinessEntity;
use App\Models\Delivery;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Order;
use App\Models\Customer;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EntityManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'Nidha Proprietor',
            'email' => 'nidha@ninuarts.com',
            'password' => bcrypt('Password@123'),
            'role' => 'OWNER',
            'is_active' => true,
        ]);

        $this->staff = User::create([
            'name' => 'Staff Assistant',
            'email' => 'staff@ninuarts.com',
            'password' => bcrypt('Password@123'),
            'role' => 'STAFF',
            'is_active' => true,
        ]);
    }

    public function test_staff_cannot_access_entity_management_endpoints(): void
    {
        $staffToken = $this->staff->createToken('staff')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$staffToken}")
            ->getJson('/api/v1/business-entities')
            ->assertStatus(403);

        $this->withHeader('Authorization', "Bearer {$staffToken}")
            ->postJson('/api/v1/vendors', [
                'name' => 'Unauthorized Vendor',
                'entity_type' => 'SUPPLIER',
            ])
            ->assertStatus(403);
    }

    public function test_owner_can_manage_business_entities_and_primary_constraints(): void
    {
        $token = $this->owner->createToken('owner')->plainTextToken;

        // Default primary studio entity seeded by migration exists
        $listRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/business-entities');

        $listRes->assertStatus(200)
            ->assertJsonPath('success', true);

        $primary = BusinessEntity::where('is_primary', true)->first();
        $this->assertNotNull($primary);
        $this->assertEquals('NINU-HQ', $primary->code);

        // Primary entity cannot be deleted or deactivated directly
        $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson("/api/v1/business-entities/{$primary->id}")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'PRIMARY_ENTITY_PROTECTED');

        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/business-entities/{$primary->id}", ['is_active' => false])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'PRIMARY_ENTITY_PROTECTED');

        // Create a secondary workshop entity
        $createRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/business-entities', [
                'name' => 'Alappuzha Framing Workshop',
                'entity_type' => 'WORKSHOP',
                'city' => 'Alappuzha',
                'state' => 'Kerala',
                'upi_id' => 'ninuarts@okaxis',
                'is_primary' => false,
            ]);

        $createRes->assertStatus(201)
            ->assertJsonPath('data.entity_type', 'WORKSHOP');

        $workshopId = $createRes->json('data.id');

        // Promoting workshop to primary demotes previous primary
        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/business-entities/{$workshopId}", ['is_primary' => true])
            ->assertStatus(200)
            ->assertJsonPath('data.is_primary', true);

        $this->assertFalse($primary->fresh()->is_primary);

        // Now original entity can be deleted cleanly
        $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson("/api/v1/business-entities/{$primary->id}")
            ->assertStatus(200);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'BUSINESS_ENTITY_CREATED',
            'entity_type' => 'BusinessEntity',
            'entity_id' => $workshopId,
        ]);
    }

    public function test_vendor_crud_expense_rollups_and_deletion_guard(): void
    {
        $token = $this->owner->createToken('owner')->plainTextToken;

        $createVendor = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/vendors', [
                'name' => 'Travancore Frame Supply',
                'entity_type' => 'SUPPLIER',
                'contact_person' => 'Anil Kumar',
                'phone' => '+91 98470 55667',
                'city' => 'Kottayam',
                'payment_terms' => 'NET_7',
                'default_category' => 'MATERIALS',
            ]);

        $createVendor->assertStatus(201)
            ->assertJsonPath('data.entity_type', 'SUPPLIER');

        $vendorId = $createVendor->json('data.id');

        // Duplicate vendor name rejected
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/vendors', [
                'name' => 'travancore frame supply',
                'entity_type' => 'SUPPLIER',
            ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VENDOR_EXISTS');

        // Link an expense to the vendor
        $cat = ExpenseCategory::firstOrCreate(
            ['code' => 'MATERIALS'],
            ['name' => 'Materials', 'is_active' => true]
        );

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/expenses', [
                'category_id' => $cat->id,
                'amount' => 1450.00,
                'expense_date' => '2026-11-24',
                'payment_method' => 'UPI',
                'vendor_id' => $vendorId,
                'description' => 'Teak beading batch',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.vendor_name', 'Travancore Frame Supply');

        // Also record a courier partner and matching delivery
        $courierRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/vendors', [
                'name' => 'DTDC Express',
                'entity_type' => 'COURIER',
                'tracking_url_template' => 'https://www.dtdc.in/tracking.asp?strCnno={tracking}',
            ]);
        $courierRes->assertStatus(201);

        $customer = Customer::create([
            'name' => 'Meera',
            'phone' => '+91 99999 11111',
            'source_channel' => 'INSTAGRAM',
            'city' => 'Kochi',
        ]);
        $order = Order::create([
            'order_number' => 'NA-2026-9901',
            'customer_id' => $customer->id,
            'status' => 'CONFIRMED',
            'payment_status' => 'PAID',
            'subtotal_amount' => 1000,
            'delivery_charge' => 100,
            'discount_amount' => 0,
            'total_amount' => 1100,
            'advance_amount_required' => 500,
            'total_paid' => 1100,
            'balance_amount' => 0,
        ]);
        Delivery::create([
            'order_id' => $order->id,
            'delivery_type' => 'COURIER',
            'courier_partner' => 'DTDC Express',
            'status' => 'DISPATCHED',
        ]);

        // Index returns live expense and delivery stats
        $indexRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/vendors');
        $indexRes->assertStatus(200);

        $vendors = collect($indexRes->json('data'));
        $supplierRow = $vendors->firstWhere('id', $vendorId);
        $courierRow = $vendors->firstWhere('name', 'DTDC Express');

        $this->assertEquals(1450.0, (float) $supplierRow['total_spent']);
        $this->assertEquals(1, $supplierRow['expense_count']);
        $this->assertEquals(1, $courierRow['delivery_count']);

        // Deleting vendor with linked expenses is blocked (prompt deactivation instead)
        $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson("/api/v1/vendors/{$vendorId}")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VENDOR_HAS_EXPENSES');

        // Deactivation succeeds
        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/vendors/{$vendorId}", ['is_active' => false])
            ->assertStatus(200)
            ->assertJsonPath('data.is_active', false);

        // Courier vendor without linked expenses can be deleted cleanly
        $courierId = $courierRes->json('data.id');
        $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson("/api/v1/vendors/{$courierId}")
            ->assertStatus(200);
    }
}
