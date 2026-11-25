<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ExpenseCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class EndToEndBusinessWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $staff;
    protected string $ownerToken;
    protected string $staffToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();

        $this->owner = User::where('email', 'nidha@ninuarts.com')->first();
        $this->staff = User::where('email', 'staff@ninuarts.com')->first();

        $this->ownerToken = $this->owner->createToken('e2e_owner')->plainTextToken;
        $this->staffToken = $this->staff->createToken('e2e_staff')->plainTextToken;
    }

    /**
     * Execute complete 20-step Day 7 E2E business workflow and verify every stage against DB & analytics.
     */
    public function test_complete_20_step_end_to_end_business_workflow(): void
    {
        Storage::fake('local');
        Storage::fake('public');

        $category = ProductCategory::first();
        $catProduct1 = Product::create([
            'category_id' => $category->id,
            'name' => 'Pine Photo Frame 12x18',
            'category' => 'PHOTO_FRAME',
            'base_price' => 1500.00,
            'is_active' => true,
        ]);
        $catProduct2 = Product::create([
            'category_id' => $category->id,
            'name' => 'Spotify Acrylic Stand',
            'category' => 'CUSTOM_GIFT',
            'base_price' => 800.00,
            'is_active' => true,
        ]);

        // 1. Create a new customer
        $custRes = $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->postJson('/api/v1/customers', [
                'name' => 'Lakshmi Menon',
                'phone' => '+91 98950 11223',
                'instagram_handle' => '@lakshmi_alpy',
                'source_channel' => 'INSTAGRAM',
                'city' => 'Alappuzha',
                'delivery_address' => 'Mullakkal Ward, Alappuzha - 688011',
            ]);
        $custRes->assertStatus(201);
        $customerId = $custRes->json('data.id');
        $this->assertDatabaseHas('customers', ['id' => $customerId, 'name' => 'Lakshmi Menon']);

        // 2. Record an Instagram enquiry
        $enqRes = $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->postJson('/api/v1/enquiries', [
                'customer_id' => $customerId,
                'channel' => 'INSTAGRAM',
                'product_interest' => 'Anniversary Frame & Gift Combo',
                'budget_range' => '4500-5500',
                'estimated_value' => 5000.00,
                'requirements' => 'Couple portrait with gold lettering',
            ]);
        $enqRes->assertStatus(201);
        $enquiryId = $enqRes->json('data.id');
        $this->assertDatabaseHas('enquiries', ['id' => $enquiryId, 'status' => 'NEW']);

        // 3. Add follow-up notes
        $fuRes = $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->postJson("/api/v1/enquiries/{$enquiryId}/follow-ups", [
                'scheduled_date' => Carbon::now()->addDay()->toDateTimeString(),
                'notes' => 'Shared frame sample photos on Instagram DM.',
            ]);
        $fuRes->assertStatus(201);
        $this->assertDatabaseHas('follow_ups', ['enquiry_id' => $enquiryId]);
        $this->assertDatabaseHas('enquiries', ['id' => $enquiryId, 'status' => 'CONTACTED']);

        // 4. Convert the enquiry (creates an initial order linked to the enquiry)
        $convRes = $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->postJson("/api/v1/enquiries/{$enquiryId}/convert", [
                'advance_amount_required' => 400.00,
                'delivery_charge' => 0.00,
                'items' => [
                    [
                        'product_id' => $catProduct2->id,
                        'item_name' => $catProduct2->name,
                        'item_type' => 'CATALOG',
                        'unit_price' => 800.00,
                        'quantity' => 1,
                        'customization_details' => 'Song: Uyire',
                    ],
                ],
            ]);
        $convRes->assertStatus(201);
        $convertedOrderId = $convRes->json('data.order.id');
        $this->assertDatabaseHas('enquiries', [
            'id' => $enquiryId,
            'status' => 'CONVERTED',
            'converted_order_id' => $convertedOrderId,
        ]);

        // Confirm the converted order with its advance so customer has 2 verified non-draft orders at the end
        $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->postJson("/api/v1/orders/{$convertedOrderId}/payments", [
                'amount' => 800.00,
                'payment_type' => 'ADVANCE',
                'payment_method' => 'UPI',
                'transaction_reference' => 'UTR-CONV-001',
            ])->assertStatus(201);

        // 5-8. Create a multi-product order: 2 catalogue products + 1 custom product + shipping + discount
        $orderRes = $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->postJson('/api/v1/orders', [
                'customer_id' => $customerId,
                'advance_amount_required' => 1500.00,
                'delivery_charge' => 150.00,
                'discount_amount' => 150.00,
                'target_delivery_date' => Carbon::now()->addDays(5)->toDateString(),
                'items' => [
                    [
                        'product_id' => $catProduct1->id,
                        'item_name' => $catProduct1->name,
                        'item_type' => 'CATALOG',
                        'unit_price' => 1500.00,
                        'quantity' => 2, // 3000
                        'direct_cost' => 1200.00,
                        'cost_type' => 'FRAME',
                    ],
                    [
                        'product_id' => $catProduct2->id,
                        'item_name' => $catProduct2->name,
                        'item_type' => 'CATALOG',
                        'unit_price' => 800.00,
                        'quantity' => 1, // 800
                        'direct_cost' => 300.00,
                        'cost_type' => 'RAW_MATERIAL',
                    ],
                    [
                        'item_name' => 'Custom Resin Nameplate',
                        'item_type' => 'CUSTOM',
                        'unit_price' => 1200.00,
                        'quantity' => 1, // 1200
                        'customization_details' => 'Teak finish, white calligraphy',
                        'direct_cost' => 450.00,
                        'cost_type' => 'RAW_MATERIAL',
                    ],
                ],
            ]);
        $orderRes->assertStatus(201);
        $orderId = $orderRes->json('data.id');
        // Subtotal = 3000 + 800 + 1200 = 5000; Total = 5000 + 150 - 150 = 5000
        $this->assertEquals(5000.00, (float)$orderRes->json('data.subtotal_amount'));
        $this->assertEquals(5000.00, (float)$orderRes->json('data.total_amount'));
        $this->assertEquals('DRAFT', $orderRes->json('data.status'));

        // Guard check: Cannot create delivery for DRAFT order
        $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->postJson('/api/v1/deliveries', [
                'order_id' => $orderId,
                'delivery_type' => 'COURIER',
                'status' => 'READY_FOR_DISPATCH',
            ])->assertStatus(422);

        // 9 & 10. Record advance payment (₹1500) -> auto-confirms order
        $advRes = $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->postJson("/api/v1/orders/{$orderId}/payments", [
                'amount' => 1500.00,
                'payment_type' => 'ADVANCE',
                'payment_method' => 'UPI',
                'transaction_reference' => 'UTR-E2E-ADV-101',
                'notes' => 'Advance via GPay',
            ]);
        $advRes->assertStatus(201);
        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'status' => 'CONFIRMED',
            'total_paid' => 1500.00,
            'balance_amount' => 3500.00,
            'payment_status' => 'PARTIALLY_PAID',
        ]);

        // Duplicate UTR must be rejected
        $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->postJson("/api/v1/orders/{$orderId}/payments", [
                'amount' => 1500.00,
                'payment_type' => 'ADVANCE',
                'payment_method' => 'UPI',
                'transaction_reference' => 'UTR-E2E-ADV-101',
            ])->assertStatus(422);

        // 11. Modify one product requirement post-confirmation (+200 upgrade on custom product)
        $modRes = $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->putJson("/api/v1/orders/{$orderId}", [
                'modification_reason' => 'Customer upgraded custom nameplate to gold leaf border',
                'items' => [
                    [
                        'product_id' => $catProduct1->id,
                        'item_name' => $catProduct1->name,
                        'item_type' => 'CATALOG',
                        'unit_price' => 1500.00,
                        'quantity' => 2,
                        'direct_cost' => 1200.00,
                        'cost_type' => 'FRAME',
                    ],
                    [
                        'product_id' => $catProduct2->id,
                        'item_name' => $catProduct2->name,
                        'item_type' => 'CATALOG',
                        'unit_price' => 800.00,
                        'quantity' => 1,
                        'direct_cost' => 300.00,
                        'cost_type' => 'RAW_MATERIAL',
                    ],
                    [
                        'item_name' => 'Custom Resin Nameplate',
                        'item_type' => 'CUSTOM',
                        'unit_price' => 1400.00, // +200
                        'quantity' => 1,
                        'customization_details' => 'Teak finish, 24K gold leaf calligraphy border',
                        'direct_cost' => 500.00,
                        'cost_type' => 'RAW_MATERIAL',
                    ],
                ],
            ]);
        $modRes->assertStatus(200);
        // New total = 5200, Paid = 1500, Balance = 3700
        $this->assertEquals(5200.00, (float)$modRes->json('data.total_amount'));
        $this->assertEquals(3700.00, (float)$modRes->json('data.balance_amount'));
        $this->assertDatabaseHas('order_modification_history', [
            'order_id' => $orderId,
            'previous_total' => 5000.00,
            'new_total' => 5200.00,
        ]);

        // 12. Record second payment (₹1700 via Bank Transfer)
        $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->postJson("/api/v1/orders/{$orderId}/payments", [
                'amount' => 1700.00,
                'payment_type' => 'PARTIAL',
                'payment_method' => 'BANK_TRANSFER',
                'transaction_reference' => 'IMPS-E2E-202',
            ])->assertStatus(201);
        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'total_paid' => 3200.00,
            'balance_amount' => 2000.00,
        ]);

        // 13. Create a delivery record
        $delRes = $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->postJson('/api/v1/deliveries', [
                'order_id' => $orderId,
                'delivery_type' => 'COURIER',
                'courier_partner' => 'DTDC',
                'tracking_number' => 'DTDC-E2E-7788',
                'estimated_delivery_date' => Carbon::now()->addDays(2)->toDateString(),
                'status' => 'READY_FOR_DISPATCH',
            ]);
        $delRes->assertStatus(201);
        $deliveryId = $delRes->json('data.id');

        // 14. Update delivery to DISPATCHED -> syncs order status & logs OrderStatusHistory
        $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->patchJson("/api/v1/deliveries/{$deliveryId}/status", [
                'status' => 'DISPATCHED',
            ])->assertStatus(200);
        $this->assertDatabaseHas('orders', ['id' => $orderId, 'status' => 'DISPATCHED']);
        $this->assertDatabaseHas('order_status_history', ['order_id' => $orderId, 'to_status' => 'DISPATCHED']);

        // 15. Record final payment (₹2000 via CASH with null reference)
        $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->postJson("/api/v1/orders/{$orderId}/payments", [
                'amount' => 2000.00,
                'payment_type' => 'BALANCE_FINAL',
                'payment_method' => 'CASH',
                'transaction_reference' => null,
            ])->assertStatus(201);
        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'total_paid' => 5200.00,
            'balance_amount' => 0.00,
            'payment_status' => 'PAID',
        ]);

        // 16. Mark delivery DELIVERED -> marks order DELIVERED
        $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->patchJson("/api/v1/deliveries/{$deliveryId}/status", [
                'status' => 'DELIVERED',
                'actual_delivery_date' => Carbon::now()->toDateString(),
            ])->assertStatus(200);
        $this->assertDatabaseHas('orders', ['id' => $orderId, 'status' => 'DELIVERED']);

        // 17. Record business expenses (Owner-only) + secure private receipt upload
        $this->app['auth']->forgetGuards();
        $receiptFile = UploadedFile::fake()->create('vendor_bill.pdf', 120, 'application/pdf');
        $uploadRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->post('/api/v1/expenses/upload-receipt', ['receipt' => $receiptFile], ['Accept' => 'application/json']);
        $uploadRes->assertStatus(200);
        $receiptPath = $uploadRes->json('data.path');
        $this->assertStringStartsWith('/api/v1/expenses/receipts/', $receiptPath);

        // Staff must NOT be allowed to download private receipts
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', "Bearer {$this->staffToken}")
            ->get($receiptPath, ['Accept' => 'application/json'])
            ->assertStatus(403);

        // Owner CAN access private receipt
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->get($receiptPath)
            ->assertStatus(200);

        $matCat = ExpenseCategory::firstOrCreate(['code' => 'MATERIALS'], ['name' => 'Materials', 'is_active' => true]);
        $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/v1/expenses', [
                'category_id' => $matCat->id,
                'amount' => 1000.00,
                'expense_date' => Carbon::now()->toDateString(),
                'payment_method' => 'UPI',
                'vendor_name' => 'Alappuzha Craft Mart',
                'description' => 'Teak boards and gold foil',
                'attachment_path' => $receiptPath,
            ])->assertStatus(201);

        // Also verify product image upload works (fixed missing Str import)
        $imgFile = UploadedFile::fake()->image('frame.jpg', 400, 400);
        $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->post('/api/v1/products/upload-image', ['image' => $imgFile], ['Accept' => 'application/json'])
            ->assertStatus(200);

        // 18. Verify dashboard calculations
        // Orders confirmed/delivered: Order1 (800) + Order2 (5200) = 6000 booked; Cash = 800 + 5200 = 6000; Expenses = 1000 => Profit = 5000
        $dashRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->getJson('/api/v1/analytics/dashboard');
        $dashRes->assertStatus(200);
        $metrics = $dashRes->json('data.metrics');
        $this->assertEquals(6000.00, (float)$metrics['total_revenue_booked']);
        $this->assertEquals(6000.00, (float)$metrics['cash_collected']);
        $this->assertEquals(1000.00, (float)$metrics['total_expenses']);
        $this->assertEquals(5000.00, (float)$metrics['net_business_profit']);
        $this->assertEquals(0.00, (float)$metrics['outstanding_receivables']);

        // 19. Verify product profitability
        $profRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->getJson('/api/v1/analytics/product-performance');
        $profRes->assertStatus(200);
        // Total revenue across items = 800 + 3000 + 800 + 1400 = 6000; Recorded direct costs = 1200 + 300 + 500 = 2000; Gross profit = 4000
        $this->assertEquals(6000.00, (float)$profRes->json('data.summary.total_product_revenue'));
        $this->assertEquals(2000.00, (float)$profRes->json('data.summary.total_direct_costs'));
        $this->assertEquals(4000.00, (float)$profRes->json('data.summary.total_gross_profit'));

        // 20. Verify customer purchase history & repeat purchase analytics
        $custShowRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->getJson("/api/v1/customers/{$customerId}");
        $custShowRes->assertStatus(200);
        $this->assertEquals(6000.00, (float)$custShowRes->json('data.lifetime_spend'));
        $this->assertEquals(2, $custShowRes->json('data.orders_count'));

        $custAnalytics = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->getJson('/api/v1/analytics/customer-analytics');
        $custAnalytics->assertStatus(200);
        $this->assertEquals(1, $custAnalytics->json('data.metrics.returning_customers'));
        $this->assertEquals(100.0, (float)$custAnalytics->json('data.metrics.repeat_purchase_rate'));

        // Verify Activity Logs endpoint returns real audit records
        $logsRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->getJson('/api/v1/activity-logs');
        $logsRes->assertStatus(200);
        $this->assertNotEmpty($logsRes->json('data'));
    }
}
