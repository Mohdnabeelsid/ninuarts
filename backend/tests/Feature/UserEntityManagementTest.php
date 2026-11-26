<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserEntityManagementTest extends TestCase
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

    public function test_staff_cannot_access_user_management(): void
    {
        $staffToken = $this->staff->createToken('staff')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$staffToken}")
            ->getJson('/api/v1/users')
            ->assertStatus(403);

        $this->withHeader('Authorization', "Bearer {$staffToken}")
            ->postJson('/api/v1/users', [
                'name' => 'New Guy',
                'email' => 'new@ninuarts.com',
                'password' => 'Password@123',
                'role' => 'STAFF',
            ])
            ->assertStatus(403);
    }

    public function test_owner_can_list_dashboard_users_with_meta(): void
    {
        $ownerToken = $this->owner->createToken('owner')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$ownerToken}")
            ->getJson('/api/v1/users');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.owner_count', 1)
            ->assertJsonPath('meta.staff_count', 1);
    }

    public function test_owner_can_create_new_operator_and_duplicate_email_rejected(): void
    {
        $ownerToken = $this->owner->createToken('owner')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$ownerToken}")
            ->postJson('/api/v1/users', [
                'name' => 'Arun Framing Specialist',
                'email' => 'arun@ninuarts.com',
                'phone' => '+91 94471 22334',
                'password' => 'Secret@123',
                'role' => 'STAFF',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.name', 'Arun Framing Specialist')
            ->assertJsonPath('data.role', 'STAFF');

        $this->assertDatabaseHas('users', [
            'email' => 'arun@ninuarts.com',
            'role' => 'STAFF',
            'is_active' => true,
        ]);

        // Duplicate email rejected
        $this->withHeader('Authorization', "Bearer {$ownerToken}")
            ->postJson('/api/v1/users', [
                'name' => 'Arun Duplicate',
                'email' => 'arun@ninuarts.com',
                'password' => 'Secret@123',
                'role' => 'STAFF',
            ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['error' => ['details' => ['email']]]);
    }

    public function test_cannot_deactivate_self(): void
    {
        $ownerToken = $this->owner->createToken('owner')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$ownerToken}")
            ->putJson("/api/v1/users/{$this->owner->id}", [
                'is_active' => false,
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'CANNOT_DEACTIVATE_SELF');
    }

    public function test_cannot_demote_or_deactivate_sole_owner(): void
    {
        $ownerToken = $this->owner->createToken('owner')->plainTextToken;

        // Try to demote owner to STAFF
        $response = $this->withHeader('Authorization', "Bearer {$ownerToken}")
            ->putJson("/api/v1/users/{$this->owner->id}", [
                'role' => 'STAFF',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'LAST_OWNER_PROTECTED');
    }

    public function test_deactivating_operator_revokes_tokens(): void
    {
        $ownerToken = $this->owner->createToken('owner')->plainTextToken;
        $staffToken = $this->staff->createToken('staff-session')->plainTextToken;

        // Verify staff token currently works
        $this->withHeader('Authorization', "Bearer {$staffToken}")
            ->getJson('/api/v1/customers')
            ->assertStatus(200);

        // Reset auth state in test execution context before switching tokens
        app('auth')->forgetGuards();

        // Deactivate staff as owner
        $res = $this->withHeader('Authorization', "Bearer {$ownerToken}")
            ->putJson("/api/v1/users/{$this->staff->id}", [
                'is_active' => false,
            ]);

        $res->assertStatus(200)
            ->assertJsonPath('data.is_active', false);

        // Reset auth state again before making call with revoked staff token
        app('auth')->forgetGuards();

        // Staff token is now invalidated in DB
        $this->withHeader('Authorization', "Bearer {$staffToken}")
            ->getJson('/api/v1/customers')
            ->assertStatus(401);
    }

    public function test_owner_can_reset_operator_password(): void
    {
        $ownerToken = $this->owner->createToken('owner')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$ownerToken}")
            ->postJson("/api/v1/users/{$this->staff->id}/reset-password", [
                'password' => 'NewPass@999',
            ]);

        $response->assertStatus(200);

        $this->assertTrue(Hash::check('NewPass@999', $this->staff->fresh()->password));
    }

    public function test_delete_guards_self_and_historical_records(): void
    {
        $ownerToken = $this->owner->createToken('owner')->plainTextToken;

        // 1. Cannot delete self
        $this->withHeader('Authorization', "Bearer {$ownerToken}")
            ->deleteJson("/api/v1/users/{$this->owner->id}")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CANNOT_DELETE_SELF');

        // 2. Associate an order with staff
        $customer = Customer::create([
            'name' => 'Pooja',
            'phone' => '+91 91111 22222',
            'city' => 'Alappuzha',
        ]);
        Order::create([
            'order_number' => 'NA-2026-TEST',
            'customer_id' => $customer->id,
            'status' => 'CONFIRMED',
            'payment_status' => 'UNPAID',
            'subtotal_amount' => 500,
            'total_amount' => 500,
            'advance_amount_required' => 200,
            'total_paid' => 0,
            'balance_amount' => 500,
            'created_by' => $this->staff->id,
        ]);

        // Cannot delete staff with linked orders
        $this->withHeader('Authorization', "Bearer {$ownerToken}")
            ->deleteJson("/api/v1/users/{$this->staff->id}")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'USER_HAS_RECORDS');

        // 3. Create fresh operator without records and delete
        $fresh = User::create([
            'name' => 'Temporary Staff',
            'email' => 'temp@ninuarts.com',
            'password' => bcrypt('Password@123'),
            'role' => 'STAFF',
            'is_active' => true,
        ]);

        $this->withHeader('Authorization', "Bearer {$ownerToken}")
            ->deleteJson("/api/v1/users/{$fresh->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('users', ['id' => $fresh->id]);
    }
}
