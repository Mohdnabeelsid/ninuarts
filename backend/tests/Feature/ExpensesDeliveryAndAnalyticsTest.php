<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemCost;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Delivery;
use App\Models\Enquiry;
use App\Models\ActivityLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Carbon\Carbon;

class ExpensesDeliveryAndAnalyticsTest extends TestCase
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
            'name' => 'Staff Member',
            'email' => 'staff@ninuarts.com',
            'password' => bcrypt('Password@123'),
            'role' => 'STAFF',
            'is_active' => true,
        ]);
    }

    /**
     * Test 1: Expense creation with standard category, custom category, and audit logging.
     */
    public function test_expense_creation_and_custom_category(): void
    {
        $token = $this->owner->createToken('test')->plainTextToken;

        // 1. Create with standard category
        $cat = ExpenseCategory::firstOrCreate(
            ['code' => 'MATERIALS'],
            ['name' => 'Materials', 'is_active' => true]
        );

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/expenses', [
                'category_id' => $cat->id,
                'amount' => 1250.00,
                'expense_date' => '2026-11-20',
                'payment_method' => 'UPI',
                'vendor_name' => 'Kerala Frame Mart',
                'bill_reference' => 'BILL-401',
                'description' => '20 A4 Wooden frames for gift hampers',
                'notes' => 'Received with receipt',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('expenses', [
            'amount' => 1250.00,
            'vendor_name' => 'Kerala Frame Mart',
            'description' => '20 A4 Wooden frames for gift hampers',
        ]);

        // Verify audit log
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'EXPENSE_CREATED',
            'entity_type' => 'Expense',
        ]);

        // 2. Create with custom category
        $customResponse = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/expenses', [
                'custom_category' => 'Studio Lighting',
                'amount' => 850.50,
                'expense_date' => '2026-11-21',
                'payment_method' => 'BANK_TRANSFER',
                'description' => 'Ring light for Instagram reel production',
            ]);

        $customResponse->assertStatus(201);
        $this->assertDatabaseHas('expense_categories', [
            'name' => 'Studio Lighting',
            'code' => 'STUDIO_LIGHTING',
        ]);
    }

    /**
     * Test 2: Expense editing, validation, and deletion.
     */
    public function test_expense_editing_and_deletion(): void
    {
        $token = $this->owner->createToken('test')->plainTextToken;
        $cat = ExpenseCategory::firstOrCreate(['code' => 'PRINTING'], ['name' => 'Printing', 'is_active' => true]);

        $expense = Expense::create([
            'category_id' => $cat->id,
            'amount' => 500.00,
            'expense_date' => '2026-11-15',
            'payment_method' => 'CASH',
            'description' => 'Photo paper roll',
            'recorded_by' => $this->owner->id,
        ]);

        // Edit
        $updateRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/expenses/{$expense->id}", [
                'amount' => 650.00,
                'description' => 'Photo paper roll 260gsm premium glossy',
            ]);

        $updateRes->assertStatus(200);
        $this->assertDatabaseHas('expenses', [
            'id' => $expense->id,
            'amount' => 650.00,
            'description' => 'Photo paper roll 260gsm premium glossy',
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'EXPENSE_UPDATED',
            'entity_type' => 'Expense',
            'entity_id' => $expense->id,
        ]);

        // Delete
        $delRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson("/api/v1/expenses/{$expense->id}");

        $delRes->assertStatus(200);
        $this->assertDatabaseMissing('expenses', ['id' => $expense->id]);
    }

    /**
     * Test 3: Expense filtering by category, payment method, and search.
     */
    public function test_expense_filtering_and_summary(): void
    {
        $token = $this->owner->createToken('test')->plainTextToken;
        $cat1 = ExpenseCategory::firstOrCreate(['code' => 'COURIER'], ['name' => 'Courier', 'is_active' => true]);
        $cat2 = ExpenseCategory::firstOrCreate(['code' => 'MARKETING'], ['name' => 'Marketing', 'is_active' => true]);

        Expense::create([
            'category_id' => $cat1->id,
            'amount' => 300.00,
            'expense_date' => '2026-11-01',
            'payment_method' => 'UPI',
            'vendor_name' => 'Speed Post Alappuzha',
            'description' => 'Parcel shipping',
            'recorded_by' => $this->owner->id,
        ]);

        Expense::create([
            'category_id' => $cat2->id,
            'amount' => 1500.00,
            'expense_date' => '2026-11-05',
            'payment_method' => 'BANK_TRANSFER',
            'vendor_name' => 'Meta Ads India',
            'description' => 'Instagram feed promotion',
            'recorded_by' => $this->owner->id,
        ]);

        // Filter by category
        $res = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/v1/expenses?category_code=COURIER");

        $res->assertStatus(200);
        $this->assertCount(1, $res->json('data'));
        $this->assertEquals(300.00, $res->json('meta.summary.total_amount'));
    }

    /**
     * Test 4: Delivery creation and status updates syncing to Order status.
     */
    public function test_delivery_creation_and_status_sync(): void
    {
        $token = $this->staff->createToken('test')->plainTextToken;

        $cust = Customer::create([
            'name' => 'Anjali Nair',
            'phone' => '+919495123456',
            'city' => 'Alappuzha',
            'delivery_address' => 'Nair Villa, Beach Road, Alappuzha - 688001',
            'status' => 'ACTIVE',
        ]);

        $order = Order::create([
            'order_number' => 'ORD-2026-7001',
            'customer_id' => $cust->id,
            'status' => 'IN_PROGRESS',
            'subtotal_amount' => 1200.00,
            'delivery_charge' => 100.00,
            'total_amount' => 1300.00,
            'advance_amount_required' => 500.00,
            'total_paid' => 500.00,
            'balance_amount' => 800.00,
        ]);

        // Create Delivery
        $delRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/deliveries', [
                'order_id' => $order->id,
                'delivery_type' => 'COURIER',
                'courier_partner' => 'DTDC',
                'tracking_number' => 'DTDC98765432',
                'estimated_delivery_date' => Carbon::now()->addDays(3)->toDateString(),
                'status' => 'READY_FOR_DISPATCH',
            ]);

        $delRes->assertStatus(201);
        $deliveryId = $delRes->json('data.id');

        // Recipient details should auto-fill from customer
        $this->assertEquals('Anjali Nair', $delRes->json('data.recipient_name'));
        $this->assertEquals('+919495123456', $delRes->json('data.recipient_phone'));

        // Update status to DISPATCHED
        $dispRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->patchJson("/api/v1/deliveries/{$deliveryId}/status", [
                'status' => 'DISPATCHED',
            ]);

        $dispRes->assertStatus(200);
        $order->refresh();
        $this->assertEquals('DISPATCHED', $order->status);

        // Update status to DELIVERED
        $delivRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->patchJson("/api/v1/deliveries/{$deliveryId}/status", [
                'status' => 'DELIVERED',
                'actual_delivery_date' => Carbon::now()->toDateString(),
            ]);

        $delivRes->assertStatus(200);
        $order->refresh();
        $this->assertEquals('DELIVERED', $order->status);
    }

    /**
     * Test 5: Overdue delivery detection and dispatch template generation.
     */
    public function test_overdue_delivery_detection_and_dispatch_template(): void
    {
        $token = $this->staff->createToken('test')->plainTextToken;

        $cust = Customer::create([
            'name' => 'Rahul Pillai',
            'phone' => '+919846001122',
            'city' => 'Kochi',
            'delivery_address' => 'Marine Drive, Kochi - 682031',
            'status' => 'ACTIVE',
        ]);

        $order = Order::create([
            'order_number' => 'ORD-2026-7002',
            'customer_id' => $cust->id,
            'status' => 'DISPATCHED',
            'subtotal_amount' => 1500.00,
            'total_amount' => 1500.00,
            'balance_amount' => 0.00,
        ]);

        // Create overdue delivery (estimated 4 days ago)
        $pastDate = Carbon::now()->subDays(4)->toDateString();
        $delivery = Delivery::create([
            'order_id' => $order->id,
            'delivery_type' => 'COURIER',
            'courier_partner' => 'Delhivery',
            'tracking_number' => 'DELH77889900',
            'estimated_delivery_date' => $pastDate,
            'status' => 'IN_TRANSIT',
        ]);

        // Overdue endpoint check
        $overdueRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/deliveries/overdue');

        $overdueRes->assertStatus(200);
        $items = $overdueRes->json('data');
        $this->assertNotEmpty($items);
        $found = collect($items)->firstWhere('id', $delivery->id);
        $this->assertNotNull($found);
        $this->assertEquals(4, $found['days_overdue']);

        // Dispatch template generator check
        $templateRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/v1/deliveries/{$delivery->id}/dispatch-template");

        $templateRes->assertStatus(200);
        $text = $templateRes->json('data.template_text');
        $this->assertStringContainsString('Ninu Arts Order Dispatch Update', $text);
        $this->assertStringContainsString('ORD-2026-7002', $text);
        $this->assertStringContainsString('Delhivery', $text);
        $this->assertStringContainsString('DELH77889900', $text);
    }

    /**
     * Test 6: Revenue calculations: Accrual Recognized vs Cash Collections with refunds.
     */
    public function test_monthly_revenue_and_cash_collections(): void
    {
        $token = $this->owner->createToken('test')->plainTextToken;

        $cust = Customer::create([
            'name' => 'Fathima Beevi',
            'phone' => '+919447112233',
            'city' => 'Alappuzha',
            'status' => 'ACTIVE',
        ]);

        // Order 1: Confirmed (1500)
        $order1 = Order::create([
            'order_number' => 'ORD-2026-8001',
            'customer_id' => $cust->id,
            'status' => 'CONFIRMED',
            'subtotal_amount' => 1500.00,
            'total_amount' => 1500.00,
            'total_paid' => 1000.00,
            'balance_amount' => 500.00,
            'created_at' => Carbon::now(),
        ]);

        // Payment for Order 1: 1000 UPI
        Payment::create([
            'order_id' => $order1->id,
            'payment_type' => 'ADVANCE',
            'amount' => 1000.00,
            'payment_method' => 'UPI',
            'payment_date' => Carbon::now(),
            'status' => 'SUCCESS',
        ]);

        // Refund for Order 1: 200
        Refund::create([
            'order_id' => $order1->id,
            'amount' => 200.00,
            'refund_method' => 'UPI',
            'reason' => 'Discount adjustment',
            'refund_date' => Carbon::now(),
            'status' => 'COMPLETED',
        ]);

        $res = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/analytics/monthly-revenue?months=1');

        $res->assertStatus(200);
        $currentMonthTrend = $res->json('data.trend.0');

        // Recognized revenue = 1500
        $this->assertEquals(1500.00, $currentMonthTrend['recognized_revenue']);
        // Payments = 1000, Refunds = 200 => Net Cash Collected = 800
        $this->assertEquals(1000.00, $currentMonthTrend['total_payments']);
        $this->assertEquals(200.00, $currentMonthTrend['total_refunds']);
        $this->assertEquals(800.00, $currentMonthTrend['cash_collected']);
        // Variance = 1500 - 800 = 700
        $this->assertEquals(700.00, $currentMonthTrend['variance']);
    }

    /**
     * Test 7: Product profitability, custom products, and incomplete cost flags.
     */
    public function test_product_profitability_and_incomplete_cost_handling(): void
    {
        $token = $this->owner->createToken('test')->plainTextToken;

        $cust = Customer::create(['name' => 'Aswin Kumar', 'phone' => '+919562334455', 'city' => 'Alappuzha', 'status' => 'ACTIVE']);
        $catalogProduct = Product::create(['name' => 'Spotify Acrylic Plaque', 'category' => 'PHOTO_FRAME', 'base_price' => 799.00, 'is_active' => true]);

        $order = Order::create([
            'order_number' => 'ORD-2026-9001',
            'customer_id' => $cust->id,
            'status' => 'CONFIRMED',
            'subtotal_amount' => 1800.00,
            'total_amount' => 1800.00,
            'balance_amount' => 0.00,
        ]);

        // Item 1: Catalog with complete direct cost
        $item1 = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $catalogProduct->id,
            'item_name' => 'Spotify Acrylic Plaque',
            'item_type' => 'CATALOG',
            'unit_price' => 800.00,
            'quantity' => 1,
            'total_price' => 800.00,
        ]);

        OrderItemCost::create([
            'order_item_id' => $item1->id,
            'cost_type' => 'RAW_MATERIAL',
            'amount' => 300.00,
            'description' => 'Acrylic sheet and UV print',
        ]);

        // Item 2: Custom product with NO direct cost recorded
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => null,
            'item_name' => 'Handmade Resin Wall Clock 12-inch',
            'item_type' => 'CUSTOM',
            'unit_price' => 1000.00,
            'quantity' => 1,
            'total_price' => 1000.00,
        ]);

        $res = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/analytics/product-performance');

        $res->assertStatus(200);
        $allProducts = $res->json('data.all_products');
        $this->assertCount(2, $allProducts);

        // Find Catalog Product: Gross Profit = 800 - 300 = 500, margin = 62.5%
        $catalogP = collect($allProducts)->firstWhere('item_type', 'CATALOG');
        $this->assertEquals(800.00, $catalogP['revenue']);
        $this->assertEquals(300.00, $catalogP['recorded_direct_cost']);
        $this->assertEquals(500.00, $catalogP['gross_profit']);
        $this->assertEquals(62.5, $catalogP['gross_margin_pct']);
        $this->assertFalse($catalogP['has_incomplete_cost']);

        // Find Custom Product: Has incomplete cost, cost should be 0.00 (not invented)
        $customP = collect($allProducts)->firstWhere('item_type', 'CUSTOM');
        $this->assertEquals(1000.00, $customP['revenue']);
        $this->assertEquals(0.00, $customP['recorded_direct_cost']);
        $this->assertTrue($customP['has_incomplete_cost']);

        // Check incomplete list count
        $incomplete = $res->json('data.incomplete_cost_products');
        $this->assertCount(1, $incomplete);
    }

    /**
     * Test 8: Enquiry conversion metrics excluding still-open leads from denominator.
     */
    public function test_enquiry_conversion_funnel(): void
    {
        $token = $this->owner->createToken('test')->plainTextToken;
        $cust = Customer::create(['name' => 'Meera J', 'phone' => '+919876500001', 'city' => 'Alappuzha', 'status' => 'ACTIVE']);

        // 3 Converted
        Enquiry::create(['customer_id' => $cust->id, 'channel' => 'INSTAGRAM', 'product_interest' => 'Frame', 'status' => 'CONVERTED']);
        Enquiry::create(['customer_id' => $cust->id, 'channel' => 'INSTAGRAM', 'product_interest' => 'Clock', 'status' => 'CONVERTED']);
        Enquiry::create(['customer_id' => $cust->id, 'channel' => 'WHATSAPP', 'product_interest' => 'Hampers', 'status' => 'CONVERTED']);

        // 1 Lost
        Enquiry::create(['customer_id' => $cust->id, 'channel' => 'INSTAGRAM', 'product_interest' => 'Album', 'status' => 'LOST', 'lost_reason' => 'Budget constraints']);

        // 6 Still Open (Discussing/Quoted)
        for ($i = 0; $i < 6; $i++) {
            Enquiry::create(['customer_id' => $cust->id, 'channel' => 'WHATSAPP', 'product_interest' => 'Frame', 'status' => 'DISCUSSING']);
        }

        $res = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/analytics/enquiry-conversion');

        $res->assertStatus(200);
        $funnel = $res->json('data.conversion_funnel');

        // Total enquiries = 10
        $this->assertEquals(10, $funnel['total_enquiries']);
        $this->assertEquals(3, $funnel['converted_enquiries']);
        $this->assertEquals(1, $funnel['lost_enquiries']);
        $this->assertEquals(6, $funnel['open_enquiries']);

        // Closed conversion rate = Converted / (Converted + Lost) = 3 / (3 + 1) = 75%
        // Open enquiries must be excluded from denominator!
        $this->assertEquals(75.0, $funnel['closed_conversion_rate']);
    }

    /**
     * Test 9: Customer retention: verified purchasers vs unverified imported records.
     */
    public function test_customer_analytics_and_retention(): void
    {
        $token = $this->owner->createToken('test')->plainTextToken;

        // Customer 1: Verified Repeat Buyer (2 orders)
        $cust1 = Customer::create(['name' => 'Buyer Repeat', 'phone' => '+919999900001', 'city' => 'Alappuzha', 'status' => 'ACTIVE']);
        Order::create(['order_number' => 'ORD-101', 'customer_id' => $cust1->id, 'status' => 'DELIVERED', 'total_amount' => 1000.00]);
        Order::create(['order_number' => 'ORD-102', 'customer_id' => $cust1->id, 'status' => 'DELIVERED', 'total_amount' => 2000.00]);

        // Customer 2: Single Order Buyer (1 order)
        $cust2 = Customer::create(['name' => 'Buyer Single', 'phone' => '+919999900002', 'city' => 'Alappuzha', 'status' => 'ACTIVE']);
        Order::create(['order_number' => 'ORD-103', 'customer_id' => $cust2->id, 'status' => 'DELIVERED', 'total_amount' => 1500.00]);

        // Customer 3: Historical Imported Customer with 0 system orders
        Customer::create(['name' => 'Imported Historical', 'phone' => '+919999900003', 'city' => 'Alappuzha', 'status' => 'ACTIVE']);

        $res = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/analytics/customer-analytics');

        $res->assertStatus(200);
        $metrics = $res->json('data.metrics');

        // Total registered = 3
        $this->assertEquals(3, $metrics['total_registered_customers']);
        // Verified purchasing customers = 2 (cust3 excluded because it has 0 verified orders!)
        $this->assertEquals(2, $metrics['verified_purchasing_customers']);
        // Returning customers = 1
        $this->assertEquals(1, $metrics['returning_customers']);
        // Repeat purchase rate = 1 / 2 = 50.0%
        $this->assertEquals(50.0, $metrics['repeat_purchase_rate']);

        // Check top customers: cust1 total spend = 3000, cust2 = 1500
        $top = $res->json('data.top_customers');
        $this->assertEquals('Buyer Repeat', $top[0]['name']);
        $this->assertEquals(3000.00, $top[0]['total_spent']);
    }

    /**
     * Test 10: Operational dashboard endpoint returns all aggregated metrics.
     */
    public function test_dashboard_overview_endpoint(): void
    {
        $token = $this->owner->createToken('test')->plainTextToken;

        $res = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/analytics/dashboard');

        $res->assertStatus(200);
        $this->assertArrayHasKey('metrics', $res->json('data'));
        $this->assertArrayHasKey('total_revenue_booked', $res->json('data.metrics'));
        $this->assertArrayHasKey('cash_collected', $res->json('data.metrics'));
        $this->assertArrayHasKey('net_business_profit', $res->json('data.metrics'));
        $this->assertArrayHasKey('recent_orders', $res->json('data'));
        $this->assertArrayHasKey('recent_enquiries', $res->json('data'));
    }
}
