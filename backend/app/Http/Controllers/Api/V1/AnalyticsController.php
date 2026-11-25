<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemCost;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Expense;
use App\Models\Customer;
use App\Models\Enquiry;
use App\Models\Delivery;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AnalyticsController extends BaseApiController
{
    /**
     * Database-portable YYYY-MM month grouping expression across SQLite, MySQL, and PostgreSQL.
     */
    private function monthExpression(string $column): string
    {
        return match (DB::getDriverName()) {
            'pgsql' => "TO_CHAR({$column}, 'YYYY-MM')",
            'mysql', 'mariadb' => "DATE_FORMAT({$column}, '%Y-%m')",
            default => "strftime('%Y-%m', {$column})",
        };
    }

    /**
     * Dashboard Overview - Real-time operational & financial KPI snapshot.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $periodStart = $request->attributes->get('active_period_start');
        $periodEnd = $request->attributes->get('active_period_end');
        $periodString = $request->attributes->get('active_period_string', 'ALL');

        $orderScope = Order::query();
        $paymentScope = Payment::where('status', 'SUCCESS');
        $refundScope = Refund::where('status', 'COMPLETED');
        $expenseScope = Expense::query();

        if ($periodStart && $periodEnd) {
            $orderScope->whereBetween('created_at', [$periodStart, $periodEnd]);
            $paymentScope->whereBetween('payment_date', [$periodStart, $periodEnd]);
            $refundScope->whereBetween('refund_date', [$periodStart, $periodEnd]);
            $expenseScope->whereDate('expense_date', '>=', $periodStart->toDateString())
                         ->whereDate('expense_date', '<=', $periodEnd->toDateString());
        }

        // 1. Accrual vs Cash Accounting Truth
        $grossBooked = (float) (clone $orderScope)->whereNotIn('status', ['CANCELLED', 'DRAFT'])->sum('total_amount');
        $cashCollected = (float) (clone $paymentScope)->sum('amount');
        $totalRefunds = (float) (clone $refundScope)->sum('amount');
        $netRealizedCash = max(0.00, $cashCollected - $totalRefunds);
        $totalExpenses = (float) (clone $expenseScope)->sum('amount');
        $netProfit = $netRealizedCash - $totalExpenses;
        $receivables = (float) Order::whereNotIn('status', ['CANCELLED', 'DRAFT'])
            ->where('balance_amount', '>', 0)
            ->sum('balance_amount');

        // 2. Active Orders by Status
        $statusCounts = (clone $orderScope)
            ->selectRaw('status, count(id) as cnt')
            ->groupBy('status')
            ->pluck('cnt', 'status');

        $activeOrders = [
            'DRAFT' => (int)($statusCounts['DRAFT'] ?? 0),
            'PENDING_ADVANCE' => (int)($statusCounts['PENDING_ADVANCE'] ?? 0),
            'CONFIRMED' => (int)($statusCounts['CONFIRMED'] ?? 0),
            'IN_PROGRESS' => (int)($statusCounts['IN_PROGRESS'] ?? 0),
            'READY_FOR_DELIVERY' => (int)($statusCounts['READY_FOR_DELIVERY'] ?? 0),
            'ON_HOLD' => (int)($statusCounts['ON_HOLD'] ?? 0),
            'DISPATCHED' => (int)($statusCounts['DISPATCHED'] ?? 0),
            'DELIVERED' => (int)($statusCounts['DELIVERED'] ?? 0),
            'CANCELLED' => (int)($statusCounts['CANCELLED'] ?? 0),
        ];

        // 3. Delayed Orders Count
        $overdueCount = Delivery::overdue()->count();

        return $this->sendResponse([
            'active_period' => $periodString,
            'metrics' => [
                'total_revenue_booked' => round($grossBooked, 2),
                'cash_collected' => round($netRealizedCash, 2),
                'total_expenses' => round($totalExpenses, 2),
                'total_refunds' => round($totalRefunds, 2),
                'net_business_profit' => round($netProfit, 2),
                'outstanding_receivables' => round($receivables, 2),
                'active_orders_count' => $activeOrders,
                'total_customers' => Customer::count(),
                'overdue_deliveries_count' => $overdueCount,
            ],
            'recent_orders' => (clone $orderScope)->with(['customer', 'items'])->latest()->take(5)->get(),
            'recent_enquiries' => Enquiry::latest()->take(5)->get(),
        ]);
    }

    /**
     * Report 1: Monthly Revenue vs Cash Collections.
     * Accrual (Recognized Booked Revenue) vs Cash (Collections - Refunds).
     */
    public function monthlyRevenue(Request $request): JsonResponse
    {
        $months = max(1, (int)$request->query('months', 6));
        $periodEnd = $request->attributes->get('active_period_end');
        $anchor = $periodEnd ? Carbon::parse($periodEnd)->endOfMonth() : now()->endOfMonth();
        $startDate = (clone $anchor)->subMonths($months - 1)->startOfMonth();

        // Monthly recognized order revenue (Accrual)
        $orderMonthExpr = $this->monthExpression('created_at');
        $ordersMonthly = Order::whereNotIn('status', ['CANCELLED', 'DRAFT'])
            ->whereBetween('created_at', [$startDate, $anchor])
            ->selectRaw("{$orderMonthExpr} as month, SUM(total_amount) as recognized_revenue, COUNT(id) as order_count")
            ->groupBy('month')
            ->orderBy('month')
            ->pluck('recognized_revenue', 'month');

        // Monthly payments received
        $paymentMonthExpr = $this->monthExpression('payment_date');
        $paymentsMonthly = Payment::where('status', 'SUCCESS')
            ->whereBetween('payment_date', [$startDate, $anchor])
            ->selectRaw("{$paymentMonthExpr} as month, SUM(amount) as payments_collected")
            ->groupBy('month')
            ->pluck('payments_collected', 'month');

        // Monthly refunds processed
        $refundMonthExpr = $this->monthExpression('refund_date');
        $refundsMonthly = Refund::where('status', 'COMPLETED')
            ->whereBetween('refund_date', [$startDate, $anchor])
            ->selectRaw("{$refundMonthExpr} as month, SUM(amount) as refunds_processed")
            ->groupBy('month')
            ->pluck('refunds_processed', 'month');

        $trend = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $cursor = (clone $anchor)->subMonthsNoOverflow($i);
            $monthKey = $cursor->format('Y-m');
            $monthLabel = $cursor->format('M Y');

            $rev = (float)($ordersMonthly[$monthKey] ?? 0.00);
            $pay = (float)($paymentsMonthly[$monthKey] ?? 0.00);
            $ref = (float)($refundsMonthly[$monthKey] ?? 0.00);
            $cash = max(0.00, $pay - $ref);

            $trend[] = [
                'month' => $monthKey,
                'label' => $monthLabel,
                'recognized_revenue' => round($rev, 2),
                'cash_collected' => round($cash, 2),
                'total_payments' => round($pay, 2),
                'total_refunds' => round($ref, 2),
                'variance' => round($rev - $cash, 2),
            ];
        }

        return $this->sendResponse([
            'trend' => $trend,
            'summary' => [
                'total_recognized_revenue' => round(array_sum(array_column($trend, 'recognized_revenue')), 2),
                'total_cash_collected' => round(array_sum(array_column($trend, 'cash_collected')), 2),
                'total_refunds' => round(array_sum(array_column($trend, 'total_refunds')), 2),
            ],
            'accounting_documentation' => [
                'revenue_recognition_basis' => 'Accrual Accounting: Revenue is recognized upon order confirmation/placement, excluding drafts and cancelled orders.',
                'cash_collection_basis' => 'Cash Accounting: Net cash collected (Gross Payments received minus Refunds settled) during the calendar month.',
                'difference_explanation' => 'Variance represents uncollected balances (advance vs balance pending delivery) or payments received in a different month from order placement.',
            ],
        ]);
    }

    /**
     * Report 2: Product Performance & Profitability.
     * Evaluates unit volume, revenue, direct costs, and gross margins.
     */
    public function productPerformance(Request $request): JsonResponse
    {
        $items = OrderItem::whereHas('order', function ($q) {
                $q->whereNotIn('status', ['CANCELLED', 'DRAFT']);
            })
            ->with(['costs', 'product'])
            ->get();

        $grouped = [];

        foreach ($items as $item) {
            $key = $item->item_type === 'CATALOG' && $item->product_id
                ? 'CAT_' . $item->product_id
                : 'CUSTOM_' . md5(strtolower(trim($item->item_name)));

            if (!isset($grouped[$key])) {
                $grouped[$key] = [
                    'key' => $key,
                    'product_id' => $item->product_id,
                    'product_name' => $item->item_name,
                    'item_type' => $item->item_type,
                    'category' => $item->product?->category ?? 'Custom Gifting',
                    'units_sold' => 0,
                    'order_count' => 0,
                    'revenue' => 0.00,
                    'recorded_direct_cost' => 0.00,
                    'has_incomplete_cost' => false,
                    'orders_with_cost_count' => 0,
                ];
            }

            $qty = $item->quantity;
            $revenue = (float)$item->total_price;
            $costsTotal = (float)$item->costs->sum('amount');

            $grouped[$key]['units_sold'] += $qty;
            $grouped[$key]['order_count'] += 1;
            $grouped[$key]['revenue'] += $revenue;

            if ($costsTotal > 0) {
                $grouped[$key]['recorded_direct_cost'] += $costsTotal;
                $grouped[$key]['orders_with_cost_count'] += 1;
            } else {
                // Never invent missing product costs
                $grouped[$key]['has_incomplete_cost'] = true;
            }
        }

        $allProducts = array_values($grouped);

        // Compute profit and margins
        foreach ($allProducts as &$p) {
            $p['revenue'] = round($p['revenue'], 2);
            $p['recorded_direct_cost'] = round($p['recorded_direct_cost'], 2);
            $p['gross_profit'] = round($p['revenue'] - $p['recorded_direct_cost'], 2);
            $p['gross_margin_pct'] = $p['revenue'] > 0
                ? round(($p['gross_profit'] / $p['revenue']) * 100, 1)
                : 0.0;
        }

        // Sort by revenue descending
        usort($allProducts, fn ($a, $b) => $b['revenue'] <=> $a['revenue']);

        $completeProducts = array_values(array_filter($allProducts, fn ($p) => !$p['has_incomplete_cost']));
        $incompleteProducts = array_values(array_filter($allProducts, fn ($p) => $p['has_incomplete_cost']));

        return $this->sendResponse([
            'all_products' => $allProducts,
            'complete_cost_products' => $completeProducts,
            'incomplete_cost_products' => $incompleteProducts,
            'summary' => [
                'total_product_revenue' => round(array_sum(array_column($allProducts, 'revenue')), 2),
                'total_direct_costs' => round(array_sum(array_column($allProducts, 'recorded_direct_cost')), 2),
                'total_gross_profit' => round(array_sum(array_column($allProducts, 'gross_profit')), 2),
                'incomplete_cost_count' => count($incompleteProducts),
            ],
            'cost_policy' => 'Direct costs are strictly extracted from recorded order item cost breakdown. Zero or missing costs are never estimated or invented; products with incomplete cost tracking are flagged separately.',
        ]);
    }

    /**
     * Report 3: Order Performance & Lifecycle Status Breakdown.
     */
    public function orderPerformance(Request $request): JsonResponse
    {
        $totalOrders = Order::count();
        $completedOrders = Order::where('status', 'DELIVERED')->count();
        $cancelledOrders = Order::where('status', 'CANCELLED')->count();
        $pendingOrders = Order::whereNotIn('status', ['DELIVERED', 'CANCELLED'])->count();
        $delayedOrders = Delivery::overdue()->count();

        $statusBreakdown = Order::selectRaw('status, count(id) as count, sum(total_amount) as total_val')
            ->groupBy('status')
            ->get()
            ->map(function ($row) {
                return [
                    'status' => $row->status,
                    'count' => $row->count,
                    'total_value' => round((float)$row->total_val, 2),
                ];
            });

        // 6-Month Order Volume Trend
        $months = 6;
        $startDate = now()->subMonths($months - 1)->startOfMonth();
        $orderMonthExpr = $this->monthExpression('created_at');
        $trend = Order::where('created_at', '>=', $startDate)
            ->selectRaw("{$orderMonthExpr} as month, count(id) as order_count, sum(case when status = 'DELIVERED' then 1 else 0 end) as delivered_count, sum(case when status = 'CANCELLED' then 1 else 0 end) as cancelled_count")
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        return $this->sendResponse([
            'summary' => [
                'total_orders' => $totalOrders,
                'completed_orders' => $completedOrders,
                'pending_orders' => $pendingOrders,
                'cancelled_orders' => $cancelledOrders,
                'delayed_orders' => $delayedOrders,
                'completion_rate' => $totalOrders > 0 ? round(($completedOrders / $totalOrders) * 100, 1) : 0,
            ],
            'status_breakdown' => $statusBreakdown,
            'trend' => $trend,
        ]);
    }

    /**
     * Report 4: Enquiry Conversion Funnel & Channel Attribution.
     */
    public function enquiryConversion(Request $request): JsonResponse
    {
        // Total enquiries
        $totalEnquiries = Enquiry::count();
        $converted = Enquiry::where('status', 'CONVERTED')->count();
        $lost = Enquiry::where('status', 'LOST')->count();
        $open = Enquiry::whereNotIn('status', ['CONVERTED', 'LOST'])->count();

        // Strict Rule: Closed Conversion Rate excludes still-open and duplicate enquiries from the conversion denominator
        $closedCohort = $converted + $lost;
        $closedConversionRate = $closedCohort > 0 ? round(($converted / $closedCohort) * 100, 1) : 0.0;
        $totalFunnelRate = $totalEnquiries > 0 ? round(($converted / $totalEnquiries) * 100, 1) : 0.0;

        // Channel breakdown: Instagram vs WhatsApp
        $channels = ['INSTAGRAM', 'WHATSAPP'];
        $channelStats = [];

        foreach ($channels as $chan) {
            $cTotal = Enquiry::where('channel', $chan)->count();
            $cConverted = Enquiry::where('channel', $chan)->where('status', 'CONVERTED')->count();
            $cLost = Enquiry::where('channel', $chan)->where('status', 'LOST')->count();
            $cOpen = Enquiry::where('channel', $chan)->whereNotIn('status', ['CONVERTED', 'LOST'])->count();
            $cClosed = $cConverted + $cLost;

            $channelStats[$chan] = [
                'total_enquiries' => $cTotal,
                'converted' => $cConverted,
                'lost' => $cLost,
                'open' => $cOpen,
                'closed_conversion_rate' => $cClosed > 0 ? round(($cConverted / $cClosed) * 100, 1) : 0.0,
                'overall_rate' => $cTotal > 0 ? round(($cConverted / $cTotal) * 100, 1) : 0.0,
            ];
        }

        // Lost Reasons Breakdown
        $lostReasons = Enquiry::where('status', 'LOST')
            ->whereNotNull('lost_reason')
            ->selectRaw('lost_reason, count(id) as count')
            ->groupBy('lost_reason')
            ->orderByDesc('count')
            ->get();

        return $this->sendResponse([
            'conversion_funnel' => [
                'total_enquiries' => $totalEnquiries,
                'converted_enquiries' => $converted,
                'lost_enquiries' => $lost,
                'open_enquiries' => $open,
                'closed_conversion_rate' => $closedConversionRate,
                'total_cohort_conversion_rate' => $totalFunnelRate,
            ],
            'channels' => $channelStats,
            'lost_reasons' => $lostReasons,
            'formula_documentation' => [
                'closed_conversion_rate' => 'Converted / (Converted + Lost) * 100 (Excludes active discussions and ongoing quotes from denominator to prevent rate deflation).',
                'cohort_definition' => 'All unique enquiries logged in Ninu Arts CRM, mapped to eventual confirmed orders.',
            ],
        ]);
    }

    /**
     * Report 5: Customer Analytics & Repeat Purchase Retention.
     */
    public function customerAnalytics(Request $request): JsonResponse
    {
        $totalCustomers = Customer::count();

        // Critical Rule: Do not treat imported historical customer records as verified purchases
        // Verified purchasing customers: customers who have placed at least 1 verified non-cancelled order
        $customersWithOrders = Customer::withCount(['orders' => function ($q) {
            $q->whereNotIn('status', ['CANCELLED', 'DRAFT']);
        }])->get();

        $verifiedPurchasingCustomers = $customersWithOrders->filter(fn ($c) => $c->orders_count >= 1);
        $verifiedCount = $verifiedPurchasingCustomers->count();

        // Returning customers: customers who placed 2 or more verified orders
        $returningCustomers = $customersWithOrders->filter(fn ($c) => $c->orders_count >= 2);
        $returningCount = $returningCustomers->count();
        $singleOrderCount = $verifiedCount - $returningCount;

        $repeatPurchaseRate = $verifiedCount > 0
            ? round(($returningCount / $verifiedCount) * 100, 1)
            : 0.0;

        // Top 10 Customers by Lifetime Value (LTV)
        $topCustomers = Customer::with(['orders' => function ($q) {
                $q->whereNotIn('status', ['CANCELLED', 'DRAFT']);
            }])
            ->get()
            ->map(function ($c) {
                $orderCount = $c->orders->count();
                $totalSpent = (float)$c->orders->sum('total_amount');
                return [
                    'id' => $c->id,
                    'customer_code' => $c->customer_code,
                    'name' => $c->name,
                    'phone' => $c->phone,
                    'city' => $c->city,
                    'order_count' => $orderCount,
                    'total_spent' => round($totalSpent, 2),
                    'average_order_value' => $orderCount > 0 ? round($totalSpent / $orderCount, 2) : 0.00,
                ];
            })
            ->filter(fn ($c) => $c['order_count'] > 0)
            ->sortByDesc('total_spent')
            ->values()
            ->take(10);

        return $this->sendResponse([
            'metrics' => [
                'total_registered_customers' => $totalCustomers,
                'verified_purchasing_customers' => $verifiedCount,
                'single_order_customers' => $singleOrderCount,
                'returning_customers' => $returningCount,
                'repeat_purchase_rate' => $repeatPurchaseRate,
            ],
            'top_customers' => $topCustomers,
            'kpi_definition' => [
                'verified_purchasers' => 'Customers with at least 1 confirmed/delivered non-cancelled order in system database. Imported CSV records without real order links are strictly excluded from verified purchaser counts.',
                'repeat_purchase_rate' => 'Returning Customers (orders >= 2) / Verified Purchasing Customers * 100.',
            ],
        ]);
    }

    /**
     * Report 6: Operating Expense Analytics & Cost Breakdown.
     */
    public function expenseAnalytics(Request $request): JsonResponse
    {
        $months = (int)$request->query('months', 6);
        $startDate = now()->subMonths($months - 1)->startOfMonth();

        $totalExpenses = (float) Expense::sum('amount');

        // Category Breakdown
        $categoryBreakdown = Expense::join('expense_categories', 'expenses.category_id', '=', 'expense_categories.id')
            ->selectRaw('expense_categories.name, expense_categories.code, sum(expenses.amount) as total_amount, count(expenses.id) as count')
            ->groupBy('expense_categories.id', 'expense_categories.name', 'expense_categories.code')
            ->orderByDesc('total_amount')
            ->get()
            ->map(function ($item) use ($totalExpenses) {
                $amt = (float)$item->total_amount;
                return [
                    'category_name' => $item->name,
                    'category_code' => $item->code,
                    'amount' => round($amt, 2),
                    'count' => $item->count,
                    'percentage_of_total' => $totalExpenses > 0 ? round(($amt / $totalExpenses) * 100, 1) : 0,
                ];
            });

        // Payment Method breakdown
        $methodBreakdown = Expense::selectRaw('payment_method, sum(amount) as total_amount, count(id) as count')
            ->groupBy('payment_method')
            ->get()
            ->map(function ($item) {
                return [
                    'payment_method' => $item->payment_method,
                    'amount' => round((float)$item->total_amount, 2),
                    'count' => $item->count,
                ];
            });

        // Monthly Expense Trend
        $expenseMonthExpr = $this->monthExpression('expense_date');
        $monthlyTrend = Expense::where('expense_date', '>=', $startDate)
            ->selectRaw("{$expenseMonthExpr} as month, sum(amount) as total_amount, count(id) as count")
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(function ($item) {
                return [
                    'month' => $item->month,
                    'label' => Carbon::createFromFormat('Y-m', $item->month)->format('M Y'),
                    'total_amount' => round((float)$item->total_amount, 2),
                    'count' => $item->count,
                ];
            });

        return $this->sendResponse([
            'summary' => [
                'total_expenses' => round($totalExpenses, 2),
                'total_transactions' => Expense::count(),
            ],
            'categories' => $categoryBreakdown,
            'payment_methods' => $methodBreakdown,
            'monthly_trend' => $monthlyTrend,
        ]);
    }

    /**
     * Report 7: Delayed Orders & Delivery Bottlenecks.
     */
    public function delayedOrders(Request $request): JsonResponse
    {
        $today = now()->startOfDay();

        // 1. Deliveries with estimated_delivery_date in the past that are not delivered or returned
        $overdueDeliveries = Delivery::overdue()
            ->with(['order.customer'])
            ->get()
            ->map(function ($d) use ($today) {
                $est = Carbon::parse($d->estimated_delivery_date)->startOfDay();
                return [
                    'order_id' => $d->order_id,
                    'delivery_id' => $d->id,
                    'order_number' => $d->order?->order_number,
                    'customer_name' => $d->recipient_name ?? $d->order?->customer?->name,
                    'customer_phone' => $d->recipient_phone ?? $d->order?->customer?->phone,
                    'expected_delivery_date' => $d->estimated_delivery_date ? Carbon::parse($d->estimated_delivery_date)->format('Y-m-d') : null,
                    'current_status' => $d->status,
                    'order_status' => $d->order?->status,
                    'courier_partner' => $d->courier_partner,
                    'tracking_number' => $d->tracking_number,
                    'days_overdue' => $est->diffInDays($today),
                    'delay_reason' => $d->delay_reason ?? 'Awaiting courier movement / delivery attempt update',
                ];
            });

        return $this->sendResponse([
            'delayed_orders' => $overdueDeliveries,
            'total_delayed' => $overdueDeliveries->count(),
        ]);
    }
}
