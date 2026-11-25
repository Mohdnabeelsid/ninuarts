<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\OrderModificationHistory;
use Illuminate\Foundation\Testing\RefreshDatabase;

class OrderAndPaymentManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $staff;
    protected string $ownerToken;
    protected string $staffToken;
    protected Customer $customer;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $this->owner = User::where('email', 'nidha@ninuarts.com')->first();
        $this->staff = User::where('email', 'staff@ninuarts.com')->first();

        $this->ownerToken = $this->owner->createToken('test_owner')->plainTextToken;
        $this->staffToken = $this->staff->createToken('test_staff')->plainTextToken;

        $this->customer = Customer::create([
            'name' => 'Fathima Rafeeq',
            'phone' => '+91 94470 12345',
            'city' => 'Alappuzha',
            'delivery_address' => 'Near Beach Road, Alappuzha, 688001',
            'status' => 'ACTIVE',
        ]);

        $category = ProductCategory::first();
        $this->product = Product::create([
            'category_id' => $category->id,
            'name' => '12x18 Minimalist Pine Frame',
            'category' => 'PHOTO_FRAME',
            'base_price' => 1500.00,
            'is_active' => true,
        ]);
    }

    protected function authHeader(?string $token = null): array
    {
        return [
            'Authorization' => 'Bearer ' . ($token ?? $this->ownerToken),
            'Accept' => 'application/json',
        ];
    }

    /** 1. Single Product Order Creation */
    public function test_single_product_order_creation(): void
    {
        $payload = [
            'customer_id' => $this->customer->id,
            'advance_amount_required' => 500.00,
            'delivery_charge' => 100.00,
            'discount_amount' => 50.00,
            'target_delivery_date' => '2026-12-05',
            'internal_notes' => 'Handle with care. Archival glass print.',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'item_name' => $this->product->name,
                    'item_type' => 'CATALOG',
                    'unit_price' => 1500.00,
                    'quantity' => 1,
                    'customization_details' => 'Family portrait with natural wood texture',
                ],
            ],
        ];

        $response = $this->withHeaders($this->authHeader())->postJson('/api/v1/orders', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'subtotal_amount' => 1500.00,
                    'delivery_charge' => 100.00,
                    'discount_amount' => 50.00,
                    'total_amount' => 1550.00, // 1500 + 100 - 50
                    'advance_amount_required' => 500.00,
                    'total_paid' => 0.00,
                    'balance_amount' => 1550.00,
                    'status' => 'DRAFT',
                    'payment_status' => 'UNPAID',
                ],
            ]);

        $this->assertDatabaseHas('orders', [
            'customer_id' => $this->customer->id,
            'total_amount' => 1550.00,
            'balance_amount' => 1550.00,
        ]);
    }

    /** 2. Multi-Product Order Creation with Direct Material Costs */
    public function test_multi_product_order_creation_with_direct_costs(): void
    {
        $payload = [
            'customer_id' => $this->customer->id,
            'advance_amount_required' => 1500.00,
            'delivery_charge' => 150.00,
            'discount_amount' => 100.00,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'item_name' => $this->product->name,
                    'item_type' => 'CATALOG',
                    'unit_price' => 1500.00,
                    'quantity' => 2,
                    'direct_cost' => 600.00,
                    'cost_type' => 'PRINT',
                ],
                [
                    'item_name' => 'Bespoke Handmade Chocolate Gift Box',
                    'item_type' => 'CUSTOM',
                    'unit_price' => 850.00,
                    'quantity' => 1,
                    'customization_details' => 'With custom printed ribbon',
                    'direct_cost' => 350.00,
                    'cost_type' => 'RAW_MATERIAL',
                ],
            ],
        ];

        $response = $this->withHeaders($this->authHeader())->postJson('/api/v1/orders', $payload);

        $response->assertStatus(201);
        $orderData = $response->json('data');

        // Subtotal = (1500 * 2) + (850 * 1) = 3850
        // Total = 3850 + 150 - 100 = 3900
        $this->assertEquals(3850.00, (float)$orderData['subtotal_amount']);
        $this->assertEquals(3900.00, (float)$orderData['total_amount']);
        $this->assertEquals(3900.00, (float)$orderData['balance_amount']);
        $this->assertCount(2, $orderData['items']);

        $this->assertDatabaseHas('order_item_costs', [
            'amount' => 600.00,
            'cost_type' => 'PRINT',
        ]);
    }

    /** 3. Zero Advance Rejection on Confirmation Rule */
    public function test_zero_advance_rejection_on_confirmation(): void
    {
        $order = Order::create([
            'order_number' => 'ORD-ZERO-TEST',
            'customer_id' => $this->customer->id,
            'status' => 'DRAFT',
            'payment_status' => 'UNPAID',
            'subtotal_amount' => 2000.00,
            'total_amount' => 2000.00,
            'advance_amount_required' => 1000.00,
            'total_paid' => 0.00,
            'balance_amount' => 2000.00,
        ]);

        // Attempting to shift to CONFIRMED without valid advance payment must fail!
        $response = $this->withHeaders($this->authHeader())->patchJson("/api/v1/orders/{$order->id}/status", [
            'status' => 'CONFIRMED',
            'note' => 'Trying to confirm without payment',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'ADVANCE_PAYMENT_REQUIRED',
                ],
            ]);

        $this->assertEquals('DRAFT', $order->fresh()->status);
    }

    /** 4. Recording Partial Advance Payment Auto-Confirms Order */
    public function test_recording_advance_payment_auto_confirms_order(): void
    {
        $order = Order::create([
            'order_number' => 'ORD-AUTO-CONFIRM',
            'customer_id' => $this->customer->id,
            'status' => 'DRAFT',
            'payment_status' => 'UNPAID',
            'total_amount' => 2500.00,
            'advance_amount_required' => 1000.00,
            'total_paid' => 0.00,
            'balance_amount' => 2500.00,
        ]);

        $response = $this->withHeaders($this->authHeader())->postJson("/api/v1/orders/{$order->id}/payments", [
            'amount' => 1000.00,
            'payment_type' => 'ADVANCE',
            'payment_method' => 'UPI',
            'transaction_reference' => 'UPI/20261123/123456789',
            'notes' => 'GooglePay from client',
        ]);

        $response->assertStatus(201);

        $orderFresh = $order->fresh();
        $this->assertEquals('CONFIRMED', $orderFresh->status);
        $this->assertNotNull($orderFresh->confirmed_at);
        $this->assertEquals(1000.00, (float)$orderFresh->total_paid);
        $this->assertEquals(1500.00, (float)$orderFresh->balance_amount);
        $this->assertEquals('PARTIALLY_PAID', $orderFresh->payment_status);

        $this->assertDatabaseHas('order_status_history', [
            'order_id' => $order->id,
            'to_status' => 'CONFIRMED',
        ]);
    }

    /** 5. Multiple Payments and Final Settlement to PAID */
    public function test_multiple_payments_and_final_settlement(): void
    {
        $order = Order::create([
            'order_number' => 'ORD-SETTLE-TEST',
            'customer_id' => $this->customer->id,
            'status' => 'CONFIRMED',
            'payment_status' => 'UNPAID',
            'total_amount' => 3000.00,
            'advance_amount_required' => 1000.00,
            'total_paid' => 0.00,
            'balance_amount' => 3000.00,
        ]);

        // Payment 1: Advance ₹1000 via UPI
        $this->withHeaders($this->authHeader())->postJson("/api/v1/orders/{$order->id}/payments", [
            'amount' => 1000.00,
            'payment_type' => 'ADVANCE',
            'payment_method' => 'UPI',
            'transaction_reference' => 'PAY-001-ADV',
        ])->assertStatus(201);

        // Payment 2: Interim ₹1000 via Bank Transfer
        $this->withHeaders($this->authHeader())->postJson("/api/v1/orders/{$order->id}/payments", [
            'amount' => 1000.00,
            'payment_type' => 'PARTIAL',
            'payment_method' => 'BANK_TRANSFER',
            'transaction_reference' => 'NEFT-002-INT',
        ])->assertStatus(201);

        // Payment 3: Balance Final ₹1000 via Cash
        $this->withHeaders($this->authHeader())->postJson("/api/v1/orders/{$order->id}/payments", [
            'amount' => 1000.00,
            'payment_type' => 'BALANCE_FINAL',
            'payment_method' => 'CASH',
            'transaction_reference' => null, // Optional for cash
            'notes' => 'Cash handed at workshop pickup',
        ])->assertStatus(201);

        $orderFresh = $order->fresh();
        $this->assertEquals(3000.00, (float)$orderFresh->total_paid);
        $this->assertEquals(0.00, (float)$orderFresh->balance_amount);
        $this->assertEquals('PAID', $orderFresh->payment_status);
        $this->assertCount(3, $orderFresh->payments);
    }

    /** 6. Cash Payments Allow Null Transaction Reference */
    public function test_cash_payments_allow_null_transaction_reference(): void
    {
        $order = Order::create([
            'order_number' => 'ORD-CASH-TEST',
            'customer_id' => $this->customer->id,
            'status' => 'CONFIRMED',
            'payment_status' => 'UNPAID',
            'total_amount' => 1200.00,
            'advance_amount_required' => 500.00,
            'total_paid' => 0.00,
            'balance_amount' => 1200.00,
        ]);

        $response = $this->withHeaders($this->authHeader())->postJson("/api/v1/orders/{$order->id}/payments", [
            'amount' => 500.00,
            'payment_type' => 'ADVANCE',
            'payment_method' => 'CASH',
            'notes' => 'Received cash advance at studio desk',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'payment_method' => 'CASH',
                    'transaction_reference' => null,
                ],
            ]);
    }

    /** 7. Prevent Duplicate Payment Submissions with Same Reference */
    public function test_prevent_duplicate_payment_submission(): void
    {
        $order = Order::create([
            'order_number' => 'ORD-DUP-TEST',
            'customer_id' => $this->customer->id,
            'status' => 'CONFIRMED',
            'payment_status' => 'UNPAID',
            'total_amount' => 2000.00,
            'balance_amount' => 2000.00,
        ]);

        $payload = [
            'amount' => 500.00,
            'payment_type' => 'PARTIAL',
            'payment_method' => 'UPI',
            'transaction_reference' => 'UPI-UNIQUE-UTR-999',
        ];

        // First attempt succeeds
        $this->withHeaders($this->authHeader())->postJson("/api/v1/orders/{$order->id}/payments", $payload)
            ->assertStatus(201);

        // Immediate duplicate attempt with same reference is rejected
        $dupResponse = $this->withHeaders($this->authHeader())->postJson("/api/v1/orders/{$order->id}/payments", $payload);

        $dupResponse->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'PAYMENT_VALIDATION_FAILED',
                ],
            ]);
    }

    /** 8. Refund Processing and Balance Recalculation */
    public function test_refund_processing_and_balance_recalculation(): void
    {
        $order = Order::create([
            'order_number' => 'ORD-REFUND-TEST',
            'customer_id' => $this->customer->id,
            'status' => 'CONFIRMED',
            'payment_status' => 'PAID',
            'total_amount' => 2000.00,
            'total_paid' => 2000.00,
            'balance_amount' => 0.00,
        ]);

        $payment = Payment::create([
            'order_id' => $order->id,
            'payment_type' => 'ADVANCE',
            'amount' => 2000.00,
            'payment_method' => 'UPI',
            'transaction_reference' => 'UPI-REFUND-SRC-1',
            'payment_date' => now(),
            'status' => 'SUCCESS',
            'recorded_by' => $this->owner->id,
        ]);

        // Process refund of ₹500
        $response = $this->withHeaders($this->authHeader())->postJson("/api/v1/orders/{$order->id}/refunds", [
            'payment_id' => $payment->id,
            'amount' => 500.00,
            'refund_method' => 'UPI',
            'transaction_reference' => 'UPI-REV-500',
            'reason' => 'Customer opted for smaller frame size',
            'notes' => 'Sent back via GooglePay',
        ]);

        $response->assertStatus(201);

        $orderFresh = $order->fresh();
        // Net paid = 2000 - 500 = 1500
        // Balance = 2000 - 1500 = 500
        $this->assertEquals(1500.00, (float)$orderFresh->total_paid);
        $this->assertEquals(500.00, (float)$orderFresh->balance_amount);
        $this->assertEquals('PARTIALLY_PAID', $orderFresh->payment_status);

        $this->assertDatabaseHas('refunds', [
            'order_id' => $order->id,
            'amount' => 500.00,
            'status' => 'COMPLETED',
        ]);
    }

    /** 9. Refund Limit Validation: Cannot exceed net paid amount */
    public function test_refund_limit_validation_cannot_exceed_paid(): void
    {
        $order = Order::create([
            'order_number' => 'ORD-OVER-REFUND',
            'customer_id' => $this->customer->id,
            'status' => 'CONFIRMED',
            'payment_status' => 'PARTIALLY_PAID',
            'total_amount' => 3000.00,
            'total_paid' => 1000.00,
            'balance_amount' => 2000.00,
        ]);

        Payment::create([
            'order_id' => $order->id,
            'payment_type' => 'ADVANCE',
            'amount' => 1000.00,
            'payment_method' => 'UPI',
            'transaction_reference' => 'UPI-SRC-1000',
            'payment_date' => now(),
            'status' => 'SUCCESS',
            'recorded_by' => $this->owner->id,
        ]);

        // Trying to refund ₹1500 when only ₹1000 was paid must be rejected!
        $response = $this->withHeaders($this->authHeader())->postJson("/api/v1/orders/{$order->id}/refunds", [
            'amount' => 1500.00,
            'refund_method' => 'UPI',
            'reason' => 'Excessive refund request',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'REFUND_VALIDATION_FAILED',
                ],
            ]);
    }

    /** 10. Order Modification Preserves Historical Audit Trail */
    public function test_order_modification_preserves_historical_records(): void
    {
        $order = Order::create([
            'order_number' => 'ORD-MOD-TEST',
            'customer_id' => $this->customer->id,
            'status' => 'CONFIRMED',
            'payment_status' => 'PARTIALLY_PAID',
            'subtotal_amount' => 1500.00,
            'delivery_charge' => 100.00,
            'discount_amount' => 0.00,
            'total_amount' => 1600.00,
            'advance_amount_required' => 800.00,
            'total_paid' => 800.00,
            'balance_amount' => 800.00,
        ]);

        $order->items()->create([
            'item_name' => 'Original Item',
            'item_type' => 'CUSTOM',
            'unit_price' => 1500.00,
            'quantity' => 1,
            'total_price' => 1500.00,
        ]);

        Payment::create([
            'order_id' => $order->id,
            'payment_type' => 'ADVANCE',
            'amount' => 800.00,
            'payment_method' => 'UPI',
            'payment_date' => now(),
            'status' => 'SUCCESS',
        ]);

        // Modify order: add a second item and give ₹100 discount
        $response = $this->withHeaders($this->authHeader())->putJson("/api/v1/orders/{$order->id}", [
            'modification_reason' => 'Client requested upgrade to include personalized wooden easel',
            'delivery_charge' => 120.00,
            'discount_amount' => 100.00,
            'items' => [
                [
                    'item_name' => 'Original Item Upgraded',
                    'item_type' => 'CUSTOM',
                    'unit_price' => 1800.00,
                    'quantity' => 1,
                    'customization_details' => 'Upgraded glass and easel',
                ],
                [
                    'item_name' => 'Mini Keychain Keepsake',
                    'item_type' => 'CUSTOM',
                    'unit_price' => 300.00,
                    'quantity' => 1,
                ],
            ],
        ]);

        $response->assertStatus(200);

        // Subtotal = 1800 + 300 = 2100
        // Total = 2100 + 120 - 100 = 2120
        // Balance = 2120 - 800 (already paid) = 1320
        $orderFresh = $order->fresh();
        $this->assertEquals(2100.00, (float)$orderFresh->subtotal_amount);
        $this->assertEquals(2120.00, (float)$orderFresh->total_amount);
        $this->assertEquals(1320.00, (float)$orderFresh->balance_amount);

        // Verify modification history record was stored
        $this->assertDatabaseHas('order_modification_history', [
            'order_id' => $order->id,
            'previous_total' => 1600.00,
            'new_total' => 2120.00,
            'modified_by' => $this->owner->id,
        ]);

        $history = OrderModificationHistory::where('order_id', $order->id)->first();
        $this->assertNotNull($history->previous_values);
        $this->assertNotNull($history->new_values);
        $this->assertEquals('Client requested upgrade to include personalized wooden easel', $history->modification_reason);
    }

    /** 11. Historical Price Preservation: Catalogue price changes do not alter order items */
    public function test_historical_price_preservation(): void
    {
        // 1. Create order with catalog item at ₹1500
        $payload = [
            'customer_id' => $this->customer->id,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'item_name' => $this->product->name,
                    'item_type' => 'CATALOG',
                    'unit_price' => 1500.00,
                    'quantity' => 1,
                ],
            ],
        ];

        $response = $this->withHeaders($this->authHeader())->postJson('/api/v1/orders', $payload);
        $response->assertStatus(201);
        $orderId = $response->json('data.id');

        // 2. Catalogue product price increases from ₹1500 to ₹2200
        $this->product->update(['base_price' => 2200.00]);

        // 3. Existing order item and total must remain untouched at ₹1500!
        $orderFresh = Order::with('items')->find($orderId);
        $this->assertEquals(1500.00, (float)$orderFresh->total_amount);
        $this->assertEquals(1500.00, (float)$orderFresh->items->first()->unit_price);
    }

    /** 12. Confirmed Order Protected from Permanent Deletion */
    public function test_confirmed_order_protected_from_deletion(): void
    {
        $order = Order::create([
            'order_number' => 'ORD-PROTECTED-001',
            'customer_id' => $this->customer->id,
            'status' => 'CONFIRMED',
            'payment_status' => 'PARTIALLY_PAID',
            'total_amount' => 2000.00,
            'total_paid' => 1000.00,
            'balance_amount' => 1000.00,
        ]);

        Payment::create([
            'order_id' => $order->id,
            'amount' => 1000.00,
            'payment_type' => 'ADVANCE',
            'payment_method' => 'UPI',
            'payment_date' => now(),
            'status' => 'SUCCESS',
        ]);

        $response = $this->withHeaders($this->authHeader())->deleteJson("/api/v1/orders/{$order->id}");

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'ORDER_DELETION_FAILED',
                ],
            ]);

        $this->assertDatabaseHas('orders', ['id' => $order->id]);
    }
}
