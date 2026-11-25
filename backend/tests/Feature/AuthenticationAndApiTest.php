<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class AuthenticationAndApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    /** 1. Database Connection and Migrations verification */
    public function test_database_connection_and_migrations_are_healthy(): void
    {
        $this->assertTrue(DB::connection()->getPdo() !== null);
        $this->assertTrue(DB::getSchemaBuilder()->hasTable('users'));
        $this->assertTrue(DB::getSchemaBuilder()->hasTable('orders'));
        $this->assertTrue(DB::getSchemaBuilder()->hasTable('payments'));
        $this->assertTrue(DB::getSchemaBuilder()->hasTable('expenses'));
        $this->assertTrue(DB::getSchemaBuilder()->hasTable('deliveries'));
        $this->assertTrue(DB::getSchemaBuilder()->hasTable('activity_logs'));
    }

    /** 2. Owner Account Creation / Seeding verification */
    public function test_owner_account_created_and_seeded(): void
    {
        $owner = User::where('email', 'nidha@ninuarts.com')->first();
        $this->assertNotNull($owner);
        $this->assertEquals('OWNER', $owner->role);
        $this->assertTrue($owner->is_active);
        $this->assertTrue(Hash::check('Password@123', $owner->password));
    }

    /** 3. Successful Login with Token generation */
    public function test_successful_login_returns_token_and_user_profile(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'nidha@ninuarts.com',
            'password' => 'Password@123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'user' => [
                        'email' => 'nidha@ninuarts.com',
                        'role' => 'OWNER',
                    ],
                ],
            ]);

        $this->assertNotEmpty($response->json('data.token'));
    }

    /** 4. Invalid Login Rejection */
    public function test_invalid_login_rejected_with_401(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'nidha@ninuarts.com',
            'password' => 'WrongPassword',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_CREDENTIALS',
                ],
            ]);
    }

    /** 5. Protected Route Access when Authenticated */
    public function test_protected_routes_accessible_with_bearer_token(): void
    {
        $owner = User::where('email', 'nidha@ninuarts.com')->first();
        $token = $owner->createToken('test-token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/auth/me');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'user' => [
                        'id' => $owner->id,
                        'email' => 'nidha@ninuarts.com',
                    ],
                ],
            ]);
    }

    /** 6. Unauthenticated Access to Protected Routes Rejection (401) */
    public function test_unauthenticated_request_rejected_with_401(): void
    {
        $response = $this->getJson('/api/v1/auth/me');
        $response->assertStatus(401);
    }

    /** 7. Logout revokes token */
    public function test_logout_revokes_current_token(): void
    {
        $owner = User::where('email', 'nidha@ninuarts.com')->first();
        $token = $owner->createToken('test-token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/auth/logout');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertCount(0, $owner->tokens);
    }

    /** 8. Role-Based Access: Staff restricted from Owner-Only routes */
    public function test_staff_cannot_access_owner_only_endpoints(): void
    {
        $staff = User::where('email', 'staff@ninuarts.com')->first();
        $token = $staff->createToken('staff-token')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/analytics/dashboard');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'FORBIDDEN',
                ],
            ]);
    }
}
