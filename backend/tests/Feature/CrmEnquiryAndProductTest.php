<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Customer;
use App\Models\Enquiry;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;

class CrmEnquiryAndProductTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected string $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $this->owner = User::where('email', 'nidha@ninuarts.com')->first();
        $this->token = $this->owner->createToken('test-token')->plainTextToken;
    }

    protected function authHeader(): array
    {
        return [
            'Authorization' => 'Bearer ' . $this->token,
            'Accept' => 'application/json',
        ];
    }

    /** 1. Customer Creation */
    public function test_customer_creation_generates_unique_code(): void
    {
        $response = $this->withHeaders($this->authHeader())->postJson('/api/v1/customers', [
            'name' => 'Kavya Madhavan',
            'phone' => '+91 94471 99887',
            'instagram_handle' => '@kavya_m',
            'city' => 'Alappuzha',
            'source_channel' => 'INSTAGRAM',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Kavya Madhavan',
                    'phone' => '+91 94471 99887',
                ],
            ]);

        $this->assertNotEmpty($response->json('data.customer_code'));
        $this->assertDatabaseHas('customers', [
            'phone' => '+91 94471 99887',
        ]);
    }

    /** 2. Duplicate Phone Detection */
    public function test_duplicate_phone_number_is_rejected(): void
    {
        Customer::create([
            'name' => 'Original Customer',
            'phone' => '+91 98470 11223',
            'source_channel' => 'WHATSAPP',
            'city' => 'Alappuzha',
        ]);

        $response = $this->withHeaders($this->authHeader())->postJson('/api/v1/customers', [
            'name' => 'Duplicate Attempt',
            'phone' => '98470 11223', // Same numbers without +91
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'DUPLICATE_PHONE',
                ],
            ]);
    }

    /** 3. Customer Note Addition */
    public function test_can_add_internal_note_to_customer(): void
    {
        $customer = Customer::create([
            'name' => 'Meera Nair',
            'phone' => '+91 94950 22334',
            'city' => 'Kochi',
        ]);

        $response = $this->withHeaders($this->authHeader())->postJson("/api/v1/customers/{$customer->id}/notes", [
            'note' => 'Customer prefers walnut brown finish frames with off-white mounts.',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'note' => 'Customer prefers walnut brown finish frames with off-white mounts.',
                ],
            ]);

        $this->assertDatabaseHas('customer_notes', [
            'customer_id' => $customer->id,
            'user_id' => $this->owner->id,
        ]);
    }

    /** 4. Customer CSV / Batch Import Preview & Execution */
    public function test_customer_import_preview_and_execution_with_duplicate_skipping(): void
    {
        Customer::create([
            'name' => 'Existing Contact',
            'phone' => '+91 99999 11111',
            'city' => 'Alappuzha',
        ]);

        $rows = [
            ['name' => 'New Client 1', 'phone' => '+91 88888 22222', 'city' => 'Kochi'],
            ['name' => 'New Client 2', 'phone' => '+91 88888 33333', 'city' => 'Alappuzha'],
            ['name' => 'Duplicate Client', 'phone' => '99999 11111', 'city' => 'Alappuzha'], // Existing in DB
            ['name' => 'Duplicate Client In File', 'phone' => '+91 88888 22222', 'city' => 'Kochi'], // Duplicate within file
        ];

        // Preview
        $previewRes = $this->withHeaders($this->authHeader())->postJson('/api/v1/customers/import-preview', [
            'rows' => $rows,
        ]);

        $previewRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'valid_count' => 2,
                    'duplicate_count' => 2,
                ],
            ]);

        // Execute Import
        $importRes = $this->withHeaders($this->authHeader())->postJson('/api/v1/customers/import', [
            'rows' => $rows,
        ]);

        $importRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'imported_count' => 2,
                    'skipped_count' => 2,
                ],
            ]);

        $this->assertDatabaseHas('customers', ['phone' => '+91 88888 22222']);
        $this->assertDatabaseHas('customers', ['phone' => '+91 88888 33333']);
    }

    /** 5. Enquiry Creation with Customer Auto-Reuse */
    public function test_enquiry_creation_reuses_existing_customer(): void
    {
        $existing = Customer::create([
            'name' => 'Sujith Kumar',
            'phone' => '+91 97455 66778',
            'city' => 'Alappuzha',
        ]);

        $response = $this->withHeaders($this->authHeader())->postJson('/api/v1/enquiries', [
            'customer_name' => 'Sujith Kumar',
            'customer_phone' => '97455 66778',
            'channel' => 'INSTAGRAM',
            'product_interest' => '24-page editorial magazine photobook',
            'estimated_value' => 3200.00,
            'requirements' => '25th anniversary wedding gift with gold foiled cover',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'customer_id' => $existing->id,
                    'product_interest' => '24-page editorial magazine photobook',
                ],
            ]);

        // Only 1 customer with that phone should exist
        $this->assertEquals(1, Customer::where('phone', $existing->phone)->count());
    }

    /** 6. Follow-Up Scheduling */
    public function test_can_schedule_follow_up_on_enquiry(): void
    {
        $customer = Customer::create(['name' => 'Reshmi', 'phone' => '+91 94460 77889']);
        $enquiry = Enquiry::create([
            'customer_id' => $customer->id,
            'channel' => 'WHATSAPP',
            'product_interest' => 'Acrylic couple plaque with Spotify code',
            'status' => 'NEW',
        ]);

        $response = $this->withHeaders($this->authHeader())->postJson("/api/v1/enquiries/{$enquiry->id}/follow-ups", [
            'scheduled_date' => now()->addDays(2)->toDateTimeString(),
            'notes' => 'Call to confirm photo resolution and song choice.',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseHas('follow_ups', [
            'enquiry_id' => $enquiry->id,
            'user_id' => $this->owner->id,
        ]);

        $this->assertEquals('CONTACTED', $enquiry->fresh()->status);
    }

    /** 7. Enquiry Conversion to Order and Customer link */
    public function test_convert_enquiry_to_order_and_link(): void
    {
        $customer = Customer::create(['name' => 'Vivek Anand', 'phone' => '+91 98460 12345']);
        $enquiry = Enquiry::create([
            'customer_id' => $customer->id,
            'channel' => 'INSTAGRAM',
            'product_interest' => '12x18 Customized Photo Frame',
            'status' => 'QUOTED',
        ]);

        $response = $this->withHeaders($this->authHeader())->postJson("/api/v1/enquiries/{$enquiry->id}/convert", [
            'advance_amount_required' => 800.00,
            'delivery_charge' => 100.00,
            'items' => [
                [
                    'item_name' => '12x18 Minimalist Pine Frame',
                    'item_type' => 'CUSTOM',
                    'unit_price' => 1500.00,
                    'quantity' => 1,
                    'customization_details' => 'Archival matte print, Couple names in script font.',
                ],
            ],
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
            ]);

        $enquiryFresh = $enquiry->fresh();
        $this->assertEquals('CONVERTED', $enquiryFresh->status);
        $this->assertNotNull($enquiryFresh->converted_order_id);
        $this->assertDatabaseHas('orders', [
            'id' => $enquiryFresh->converted_order_id,
            'customer_id' => $customer->id,
            'total_amount' => 1600.00,
        ]);
    }

    /** 8. CRITICAL RULE: Prevent Accidental Double Conversion */
    public function test_prevent_accidental_double_conversion(): void
    {
        $customer = Customer::create(['name' => 'Arunima', 'phone' => '+91 94950 99881']);
        $order = Order::create([
            'order_number' => 'ORD-ALREADY-001',
            'customer_id' => $customer->id,
            'status' => 'PENDING_ADVANCE',
            'payment_status' => 'UNPAID',
            'total_amount' => 1000.00,
            'balance_amount' => 1000.00,
        ]);
        $enquiry = Enquiry::create([
            'customer_id' => $customer->id,
            'channel' => 'WHATSAPP',
            'product_interest' => 'Gift Hamper',
            'status' => 'CONVERTED',
            'converted_order_id' => $order->id,
        ]);

        $response = $this->withHeaders($this->authHeader())->postJson("/api/v1/enquiries/{$enquiry->id}/convert", [
            'advance_amount_required' => 500.00,
            'items' => [
                [
                    'item_name' => 'Hamper',
                    'item_type' => 'CUSTOM',
                    'unit_price' => 1000.00,
                    'quantity' => 1,
                ],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'ENQUIRY_ALREADY_CONVERTED',
                ],
            ]);
    }

    /** 9. Product Creation, Category Assignment, Editing and Archiving */
    public function test_product_lifecycle_create_edit_archive_restore(): void
    {
        $category = ProductCategory::first();

        // 1. Create Product
        $createRes = $this->withHeaders($this->authHeader())->postJson('/api/v1/products', [
            'name' => '16x24 Teakwood Wall Collage',
            'category' => 'PHOTO_FRAME',
            'category_id' => $category->id,
            'base_price' => 2450.00,
            'description' => 'Solid Kerala teakwood with 12 photo collage grid.',
        ]);

        $createRes->assertStatus(201);
        $productId = $createRes->json('data.id');

        // 2. Edit Product
        $updateRes = $this->withHeaders($this->authHeader())->putJson("/api/v1/products/{$productId}", [
            'base_price' => 2600.00,
        ]);
        $updateRes->assertStatus(200)
            ->assertJson(['data' => ['base_price' => '2600.00']]);

        // 3. Archive Product (Soft Delete)
        $deleteRes = $this->withHeaders($this->authHeader())->deleteJson("/api/v1/products/{$productId}");
        $deleteRes->assertStatus(200);

        $this->assertSoftDeleted('products', ['id' => $productId]);

        // 4. Restore Product
        $restoreRes = $this->withHeaders($this->authHeader())->patchJson("/api/v1/products/{$productId}/restore");
        $restoreRes->assertStatus(200);

        $this->assertNotSoftDeleted('products', ['id' => $productId]);
    }
}
