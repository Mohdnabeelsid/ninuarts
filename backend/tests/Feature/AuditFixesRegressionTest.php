<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Order;
use App\Models\OrderItemCost;
use App\Models\Payment;
use App\Models\ProductCategory;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AuditFixesRegressionTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected string $ownerToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $this->owner = User::where('email', 'nidha@ninuarts.com')->firstOrFail();
        $this->ownerToken = $this->owner->createToken('regression-test')->plainTextToken;
    }

    protected function ownerHeaders(array $extra = []): array
    {
        return array_merge([
            'Authorization' => 'Bearer ' . $this->ownerToken,
            'Accept' => 'application/json',
        ], $extra);
    }

    public function test_order_status_accepts_on_hold_and_ready_for_delivery_against_db_constraints(): void
    {
        $customer = Customer::create([
            'name' => 'Aarti Nair',
            'phone' => '+91 98470 55443',
            'city' => 'Alappuzha',
        ]);

        $createRes = $this->withHeaders($this->ownerHeaders())->postJson('/api/v1/orders', [
            'customer_id' => $customer->id,
            'advance_amount_required' => 500,
            'items' => [
                [
                    'item_name' => '12x18 Pine Frame',
                    'item_type' => 'CUSTOM',
                    'unit_price' => 1500,
                    'quantity' => 1,
                ],
            ],
            'advance_payment' => [
                'amount' => 500,
                'payment_method' => 'UPI',
                'transaction_reference' => 'UTR-ONHOLD-001',
            ],
        ]);
        $createRes->assertStatus(201);
        $orderId = $createRes->json('data.id');

        // Put order ON_HOLD (previously threw CHECK constraint failure)
        $this->withHeaders($this->ownerHeaders())
            ->patchJson("/api/v1/orders/{$orderId}/status", [
                'status' => 'ON_HOLD',
                'note' => 'Awaiting client photo selection',
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'ON_HOLD');

        // Resume and progress to READY_FOR_DELIVERY
        $this->withHeaders($this->ownerHeaders())
            ->patchJson("/api/v1/orders/{$orderId}/status", ['status' => 'CONFIRMED'])
            ->assertStatus(200);

        $this->withHeaders($this->ownerHeaders())
            ->patchJson("/api/v1/orders/{$orderId}/status", ['status' => 'READY_FOR_DELIVERY'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'READY_FOR_DELIVERY');

        // Cancel order cleanly
        $this->withHeaders($this->ownerHeaders())
            ->patchJson("/api/v1/orders/{$orderId}/status", ['status' => 'CANCELLED'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'CANCELLED');
    }

    public function test_product_creation_with_category_id_archived_filter_and_image_stream(): void
    {
        Storage::fake('public');
        $category = ProductCategory::firstOrFail();

        // Create omitting legacy enum 'category' (relying on category_id resolution)
        $createRes = $this->withHeaders($this->ownerHeaders())->postJson('/api/v1/products', [
            'name' => 'Bespoke Editorial Frame',
            'category_id' => $category->id,
            'base_price' => 1850,
            'is_active' => 1,
        ]);
        $createRes->assertStatus(201)
            ->assertJsonPath('data.category_ref.id', $category->id);
        $productId = $createRes->json('data.id');

        // Archive and verify include_archived=1 AND include_archived=true return it
        $this->withHeaders($this->ownerHeaders())
            ->deleteJson("/api/v1/products/{$productId}")
            ->assertStatus(200);

        $archivedRes = $this->withHeaders($this->ownerHeaders())
            ->getJson('/api/v1/products?include_archived=1');
        $archivedRes->assertStatus(200);
        $this->assertTrue(
            collect($archivedRes->json('data'))->contains('id', $productId),
            'Archived product should be listed with include_archived=1'
        );

        // Restore via PATCH
        $this->withHeaders($this->ownerHeaders())
            ->patchJson("/api/v1/products/{$productId}/restore")
            ->assertStatus(200);

        // Upload & serve product image via API endpoint
        $img = UploadedFile::fake()->image('sample_frame.jpg', 300, 300);
        $uploadRes = $this->withHeaders($this->ownerHeaders())
            ->post('/api/v1/products/upload-image', ['image' => $img]);
        $uploadRes->assertStatus(200);
        $url = $uploadRes->json('data.url');
        $this->assertStringStartsWith('/api/v1/products/images/product_', $url);

        $this->get($url)->assertStatus(200);
    }

    public function test_enquiry_nested_customer_and_order_modify_preserves_item_costs(): void
    {
        // Enquiry creation accepts nested customer payload shape too
        $enqRes = $this->withHeaders($this->ownerHeaders())->postJson('/api/v1/enquiries', [
            'channel' => 'INSTAGRAM',
            'product_interest' => 'Custom Hamper',
            'customer' => [
                'name' => 'Divya Menon',
                'phone' => '+91 98951 77665',
                'source_channel' => 'INSTAGRAM',
            ],
        ]);
        $enqRes->assertStatus(201);
        $customerId = $enqRes->json('data.customer_id');

        // Create order with direct item cost
        $orderRes = $this->withHeaders($this->ownerHeaders())->postJson('/api/v1/orders', [
            'customer_id' => $customerId,
            'items' => [
                [
                    'item_name' => 'Custom Hamper Box',
                    'item_type' => 'CUSTOM',
                    'unit_price' => 2000,
                    'quantity' => 1,
                    'direct_cost' => 750,
                    'cost_type' => 'PACKAGING',
                ],
            ],
        ]);
        $orderRes->assertStatus(201);
        $orderId = $orderRes->json('data.id');

        // Modify order pricing without sending direct_cost -> cost must be preserved
        $modRes = $this->withHeaders($this->ownerHeaders())->putJson("/api/v1/orders/{$orderId}", [
            'modification_reason' => 'Updated item price after client confirmation',
            'items' => [
                [
                    'item_name' => 'Custom Hamper Box',
                    'item_type' => 'CUSTOM',
                    'unit_price' => 2200,
                    'quantity' => 1,
                ],
            ],
        ]);
        $modRes->assertStatus(200);

        $freshOrder = Order::with('items.costs')->findOrFail($orderId);
        $this->assertEquals(750.00, (float)$freshOrder->items->first()->costs->sum('amount'));
    }

    public function test_active_period_header_scopes_dashboard_orders_and_expenses(): void
    {
        $customer = Customer::create([
            'name' => 'Kiran Das',
            'phone' => '+91 94471 88899',
            'city' => 'Kochi',
        ]);
        $cat = ExpenseCategory::firstOrFail();

        $sepOrder = Order::create([
            'order_number' => 'ORD-SEP-01',
            'customer_id' => $customer->id,
            'status' => 'CONFIRMED',
            'subtotal_amount' => 1000,
            'total_amount' => 1000,
            'balance_amount' => 1000,
        ]);
        $sepOrder->forceFill(['created_at' => Carbon::create(2026, 9, 10, 12, 0, 0)])->saveQuietly();

        $octOrder = Order::create([
            'order_number' => 'ORD-OCT-01',
            'customer_id' => $customer->id,
            'status' => 'CONFIRMED',
            'subtotal_amount' => 2500,
            'total_amount' => 2500,
            'balance_amount' => 500,
            'total_paid' => 2000,
        ]);
        $octOrder->forceFill(['created_at' => Carbon::create(2026, 10, 12, 12, 0, 0)])->saveQuietly();

        Payment::create([
            'order_id' => $octOrder->id,
            'payment_type' => 'ADVANCE',
            'amount' => 2000,
            'payment_method' => 'UPI',
            'payment_date' => Carbon::create(2026, 10, 12, 12, 0, 0),
            'status' => 'SUCCESS',
        ]);

        Expense::create([
            'category_id' => $cat->id,
            'amount' => 300,
            'expense_date' => '2026-09-15',
            'payment_method' => 'CASH',
            'description' => 'Sep packaging tape',
            'recorded_by' => $this->owner->id,
        ]);

        // September scope
        $sepDash = $this->withHeaders($this->ownerHeaders(['X-Active-Period' => '2026-09']))
            ->getJson('/api/v1/analytics/dashboard');
        $sepDash->assertStatus(200)
            ->assertJsonPath('data.active_period', '2026-09');
        $this->assertEquals(1000.00, (float)$sepDash->json('data.metrics.total_revenue_booked'));
        $this->assertEquals(300.00, (float)$sepDash->json('data.metrics.total_expenses'));
        // Studio-wide receivables includes both Sep (1000) and Oct (500)
        $this->assertEquals(1500.00, (float)$sepDash->json('data.metrics.outstanding_receivables'));

        // Orders index scoped to 2026-09 shows only ORD-SEP-01
        $sepOrders = $this->withHeaders($this->ownerHeaders(['X-Active-Period' => '2026-09']))
            ->getJson('/api/v1/orders');
        $sepOrders->assertStatus(200);
        $this->assertCount(1, $sepOrders->json('data'));
        $this->assertEquals('ORD-SEP-01', $sepOrders->json('data.0.order_number'));

        // Cumulative scope with ALL returns both orders (3500 booked)
        $allDash = $this->withHeaders($this->ownerHeaders(['X-Active-Period' => 'ALL']))
            ->getJson('/api/v1/analytics/dashboard');
        $allDash->assertStatus(200);
        $this->assertEquals(3500.00, (float)$allDash->json('data.metrics.total_revenue_booked'));
    }

    public function test_legacy_fulfillment_respects_draft_guard_and_duplicate_category_rejected(): void
    {
        $customer = Customer::create([
            'name' => 'Rohan Varma',
            'phone' => '+91 98470 99001',
            'city' => 'Kochi',
        ]);
        $draftOrder = Order::create([
            'order_number' => 'ORD-DRAFT-GUARD',
            'customer_id' => $customer->id,
            'status' => 'DRAFT',
            'total_amount' => 1000,
        ]);

        $this->withHeaders($this->ownerHeaders())->putJson("/api/v1/orders/{$draftOrder->id}/fulfillment", [
            'delivery_type' => 'COURIER',
            'status' => 'PACKED',
        ])->assertStatus(422)
          ->assertJsonPath('error.code', 'INVALID_ORDER_STATE');

        // Duplicate product category slug returns clean 422 instead of 500
        $existing = ProductCategory::firstOrFail();
        $this->withHeaders($this->ownerHeaders())->postJson('/api/v1/product-categories', [
            'name' => $existing->name,
        ])->assertStatus(422)
          ->assertJsonPath('error.code', 'CATEGORY_EXISTS');
    }

    public function test_delivered_order_with_unpaid_balance_counts_in_receivables_and_user_orders_relation(): void
    {
        $customer = Customer::create([
            'name' => 'Meenu Krishnan',
            'phone' => '+91 94471 12399',
            'city' => 'Alappuzha',
        ]);

        $order = Order::create([
            'order_number' => 'ORD-DELIV-BAL',
            'customer_id' => $customer->id,
            'created_by' => $this->owner->id,
            'status' => 'DELIVERED',
            'payment_status' => 'PARTIALLY_PAID',
            'total_amount' => 2000,
            'total_paid' => 1200,
            'balance_amount' => 800,
        ]);

        $this->assertTrue($this->owner->orders->contains('id', $order->id));

        $dash = $this->withHeaders($this->ownerHeaders())
            ->getJson('/api/v1/analytics/dashboard');
        $dash->assertStatus(200);
        $this->assertEquals(800.00, (float)$dash->json('data.metrics.outstanding_receivables'));
    }

    public function test_login_endpoint_enforces_rate_limiting(): void
    {
        for ($i = 0; $i < 15; $i++) {
            $this->postJson('/api/v1/auth/login', [
                'email' => 'nidha@ninuarts.com',
                'password' => 'wrong-password',
            ])->assertStatus(401);
        }

        $this->postJson('/api/v1/auth/login', [
            'email' => 'nidha@ninuarts.com',
            'password' => 'wrong-password',
        ])->assertStatus(429);
    }
}
