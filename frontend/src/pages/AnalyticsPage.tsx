import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  CreditCard,
  ShoppingBag,
  Percent,
  Award,
  Calendar,
  Users,
  Clock,
  AlertTriangle,
  Receipt,
  Tag,
  ArrowUpRight,
  Info,
  DollarSign,
  Package,
  Layers,
  HelpCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
} from "recharts";
import { PageHeader } from "../components/layout/PageHeader";
import { StatCard } from "../components/shared/StatCard";
import { LoadingState } from "../components/shared/LoadingState";
import { ErrorState } from "../components/shared/ErrorState";
import { formatCurrency, formatDate } from "../lib/utils";
import { apiClient } from "../lib/api";
import { useActivePeriod } from "../contexts/ActivePeriodContext";
import {
  MonthlyRevenueTrendItem,
  ProductPerformanceItem,
  OrderPerformanceReport,
  EnquiryConversionReport,
  CustomerAnalyticsReport,
  ExpenseAnalyticsReport,
  DelayedOrderItem,
} from "../types";

const PIE_COLORS = ["#34312F", "#8B9B86", "#D4A373", "#E8D8D4", "#C96A5B", "#6E95B8", "#8278A3", "#D6C4B5"];

export function AnalyticsPage() {
  const { activePeriod } = useActivePeriod();
  const [activeTab, setActiveTab] = useState<
    "REVENUE" | "PRODUCTS" | "ORDERS" | "CONVERSION" | "CUSTOMERS" | "EXPENSES" | "DELAYED"
  >("REVENUE");

  // 1. Report: Monthly Revenue vs Cash Collected
  const { data: revData, isLoading: revLoading } = useQuery({
    queryKey: ["analytics-monthly-revenue", activePeriod.formatted],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/monthly-revenue?months=6");
      return res.data?.data || null;
    },
    enabled: activeTab === "REVENUE",
  });

  // 2. Report: Product Performance
  const { data: prodData, isLoading: prodLoading } = useQuery({
    queryKey: ["analytics-product-performance"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/product-performance");
      return res.data?.data || null;
    },
    enabled: activeTab === "PRODUCTS",
  });

  // 3. Report: Order Performance
  const { data: orderPerfData, isLoading: orderPerfLoading } = useQuery({
    queryKey: ["analytics-order-performance"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/order-performance");
      return res.data?.data || null;
    },
    enabled: activeTab === "ORDERS",
  });

  // 4. Report: Enquiry Conversion
  const { data: convData, isLoading: convLoading } = useQuery({
    queryKey: ["analytics-enquiry-conversion"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/enquiry-conversion");
      return res.data?.data || null;
    },
    enabled: activeTab === "CONVERSION",
  });

  // 5. Report: Customer Analytics
  const { data: custData, isLoading: custLoading } = useQuery({
    queryKey: ["analytics-customer-analytics"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/customer-analytics");
      return res.data?.data || null;
    },
    enabled: activeTab === "CUSTOMERS",
  });

  // 6. Report: Expense Analytics
  const { data: expData, isLoading: expLoading } = useQuery({
    queryKey: ["analytics-expense-analytics"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/expense-analytics?months=6");
      return res.data?.data || null;
    },
    enabled: activeTab === "EXPENSES",
  });

  // 7. Report: Delayed Orders
  const { data: delayedData, isLoading: delayedLoading } = useQuery({
    queryKey: ["analytics-delayed-orders"],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/delayed-orders");
      return res.data?.data || null;
    },
  });

  const revenueTrend: MonthlyRevenueTrendItem[] = revData?.trend || [];
  const products: ProductPerformanceItem[] = prodData?.all_products || [];
  const incompleteCostProducts: ProductPerformanceItem[] = prodData?.incomplete_cost_products || [];
  const orderSummary = orderPerfData?.summary;
  const convFunnel = convData?.conversion_funnel;
  const custMetrics = custData?.metrics;
  const delayedOrders: DelayedOrderItem[] = delayedData?.delayed_orders || [];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Business Analytics & Financial Intelligence"
        description="Verified database reports: Accrual vs Cash revenue, unit economics, conversion funnels, customer retention, and fulfillment health."
      />

      {/* Analytics Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#E7E1D8] pb-2.5">
        {[
          { id: "REVENUE", label: "1. Revenue vs Cash" },
          { id: "PRODUCTS", label: "2. Product Profitability" },
          { id: "ORDERS", label: "3. Order Lifecycle" },
          { id: "CONVERSION", label: "4. Lead Funnel" },
          { id: "CUSTOMERS", label: "5. Customer Retention" },
          { id: "EXPENSES", label: "6. Expense Analysis" },
          {
            id: "DELAYED",
            label: "7. Delayed Orders",
            badge: delayedOrders.length > 0 ? delayedOrders.length : undefined,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-[#34312F] text-white shadow-soft"
                : "text-[#6B635B] hover:text-[#34312F] hover:bg-[#F7F4F0]"
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  activeTab === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-[#FAECEB] text-[#8F352A]"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MONTHLY REVENUE VS CASH COLLECTIONS */}
      {/* ========================================================================= */}
      {activeTab === "REVENUE" && (
        <div className="space-y-6">
          {revLoading ? (
            <LoadingState message="Calculating revenue and cash realization..." />
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  title="Recognized Booked Revenue"
                  value={formatCurrency(revData?.summary?.total_recognized_revenue || 0)}
                  icon={TrendingUp}
                  highlight={true}
                  subtitle="Accrual accounting basis"
                />
                <StatCard
                  title="Net Cash Collected"
                  value={formatCurrency(revData?.summary?.total_cash_collected || 0)}
                  icon={CreditCard}
                  subtitle="Gross payments minus refunds"
                />
                <StatCard
                  title="Total Refunds Issued"
                  value={formatCurrency(revData?.summary?.total_refunds || 0)}
                  icon={Percent}
                  subtitle="Accounted settlements"
                />
              </div>

              {/* Accounting Basis Disclosure Note */}
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Info className="w-4 h-4 text-amber-700" />
                  <span>Accounting Basis Disclosure</span>
                </div>
                <p>
                  <strong>Accrual Basis:</strong> Revenue is recognized upon order confirmation/placement, excluding drafts and cancelled orders.
                </p>
                <p>
                  <strong>Cash Basis:</strong> Net collections represent actual cash/bank/UPI deposits minus processed refunds in the period.
                </p>
              </div>

              {/* Revenue vs Cash Bar Chart */}
              <div className="bg-white p-5 rounded-2xl border border-[#E7E1D8] shadow-card space-y-4">
                <h3 className="text-xs font-bold text-[#34312F]">
                  Monthly Comparison: Recognized Order Revenue vs Cash Collections (Past 6 Months)
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE7" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#817872" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#817872" }} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip
                        formatter={(val: any) => formatCurrency(Number(val))}
                        contentStyle={{ borderRadius: 12, fontSize: 12, borderColor: "#E7E1D8", backgroundColor: "#FFFFFF" }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                      <Bar dataKey="recognized_revenue" name="Recognized Revenue (Accrual)" fill="#34312F" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cash_collected" name="Cash Realized (Collections)" fill="#8B9B86" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Table */}
              <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-card">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Calendar Month</th>
                      <th className="py-2.5 px-4">Recognized Revenue (₹)</th>
                      <th className="py-2.5 px-4">Payments Received (₹)</th>
                      <th className="py-2.5 px-4">Refunds Deducted (₹)</th>
                      <th className="py-2.5 px-4">Net Cash Realized (₹)</th>
                      <th className="py-2.5 px-4 text-right">Variance (Uncollected)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {revenueTrend.map((row) => (
                      <tr key={row.month} className="hover:bg-stone-50/50">
                        <td className="py-2.5 px-4 font-semibold text-stone-900">{row.label}</td>
                        <td className="py-2.5 px-4 font-serif font-bold text-stone-900">
                          {formatCurrency(row.recognized_revenue)}
                        </td>
                        <td className="py-2.5 px-4">{formatCurrency(row.total_payments)}</td>
                        <td className="py-2.5 px-4 text-red-600">
                          {row.total_refunds > 0 ? `-${formatCurrency(row.total_refunds)}` : "₹0.00"}
                        </td>
                        <td className="py-2.5 px-4 font-serif font-semibold text-emerald-700">
                          {formatCurrency(row.cash_collected)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-serif">
                          {formatCurrency(row.variance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PRODUCT PERFORMANCE & PROFITABILITY */}
      {/* ========================================================================= */}
      {activeTab === "PRODUCTS" && (
        <div className="space-y-6">
          {prodLoading ? (
            <LoadingState message="Compiling product unit economics..." />
          ) : (
            <>
              {/* Product Profitability KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <StatCard
                  title="Total Product Sales"
                  value={formatCurrency(prodData?.summary?.total_product_revenue || 0)}
                  icon={ShoppingBag}
                  highlight={true}
                />
                <StatCard
                  title="Recorded Direct Costs"
                  value={formatCurrency(prodData?.summary?.total_direct_costs || 0)}
                  icon={Receipt}
                  subtitle="Materials, printing & frames"
                />
                <StatCard
                  title="Total Gross Profit"
                  value={formatCurrency(prodData?.summary?.total_gross_profit || 0)}
                  icon={DollarSign}
                  subtitle="Sales minus recorded costs"
                />
                <StatCard
                  title="Products with Incomplete Cost Data"
                  value={(prodData?.summary?.incomplete_cost_count || 0).toString()}
                  icon={AlertTriangle}
                  subtitle="Flagged separately"
                />
              </div>

              {/* Strict Cost Tracking Disclosure */}
              <div className="p-3.5 rounded-xl bg-stone-100 border border-stone-200 text-xs text-stone-700 flex items-start gap-2">
                <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Direct Cost Principle:</strong> Direct costs are strictly calculated from actual order line item costs recorded by operators during order creation. Missing costs are never assumed or fabricated.
                </p>
              </div>

              {/* Full Product Profitability Table */}
              <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-card">
                <div className="p-4 border-b border-stone-200 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-900">
                    Product Performance & Margin Ranking
                  </h3>
                  <span className="text-3xs text-stone-500">
                    {products.length} Products & Custom Offerings Sold
                  </span>
                </div>
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Product Name</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Units Sold</th>
                      <th className="py-2.5 px-4">Revenue (₹)</th>
                      <th className="py-2.5 px-4">Recorded Direct Cost (₹)</th>
                      <th className="py-2.5 px-4">Gross Profit (₹)</th>
                      <th className="py-2.5 px-4 text-right">Gross Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {products.map((p) => (
                      <tr key={p.key} className="hover:bg-stone-50/50">
                        <td className="py-2.5 px-4 font-semibold text-stone-900">
                          {p.product_name}
                          {p.has_incomplete_cost && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-3xs font-bold bg-amber-100 text-amber-800">
                              Partial Cost Tracking
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-1.5 py-0.5 rounded text-3xs font-semibold ${
                              p.item_type === "CUSTOM"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-stone-100 text-stone-800"
                            }`}
                          >
                            {p.item_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-bold">{p.units_sold}</td>
                        <td className="py-2.5 px-4 font-serif font-bold text-stone-900">
                          {formatCurrency(p.revenue)}
                        </td>
                        <td className="py-2.5 px-4 font-serif">
                          {formatCurrency(p.recorded_direct_cost)}
                        </td>
                        <td className="py-2.5 px-4 font-serif font-semibold text-emerald-700">
                          {formatCurrency(p.gross_profit)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-rose-800">
                          {p.gross_margin_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ORDER LIFECYCLE & PERFORMANCE */}
      {/* ========================================================================= */}
      {activeTab === "ORDERS" && (
        <div className="space-y-6">
          {orderPerfLoading ? (
            <LoadingState message="Compiling order performance reports..." />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <StatCard
                  title="Total Orders"
                  value={(orderSummary?.total_orders || 0).toString()}
                  icon={ShoppingBag}
                  highlight={true}
                />
                <StatCard
                  title="Completed & Delivered"
                  value={(orderSummary?.completed_orders || 0).toString()}
                  icon={Award}
                  subtitle={`Completion rate: ${orderSummary?.completion_rate || 0}%`}
                />
                <StatCard
                  title="Pending Fulfillment"
                  value={(orderSummary?.pending_orders || 0).toString()}
                  icon={Clock}
                  subtitle="Active production pipeline"
                />
                <StatCard
                  title="Cancelled Orders"
                  value={(orderSummary?.cancelled_orders || 0).toString()}
                  icon={AlertTriangle}
                  subtitle="Voided transactions"
                />
              </div>

              {/* Order Status Breakdown */}
              <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-card space-y-4">
                <h3 className="text-xs font-bold text-stone-900">
                  Orders by Lifecycle Status
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {orderPerfData?.status_breakdown?.map((item: any) => (
                    <div
                      key={item.status}
                      className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between"
                    >
                      <span className="text-3xs font-bold uppercase text-stone-500">
                        {item.status.replace(/_/g, " ")}
                      </span>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-xl font-bold text-stone-900">{item.count}</span>
                        <span className="text-xs font-serif font-semibold text-rose-800">
                          {formatCurrency(item.total_value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: LEAD & ENQUIRY CONVERSION */}
      {/* ========================================================================= */}
      {activeTab === "CONVERSION" && (
        <div className="space-y-6">
          {convLoading ? (
            <LoadingState message="Analyzing lead conversion cohorts..." />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <StatCard
                  title="Closed Conversion Rate"
                  value={`${convFunnel?.closed_conversion_rate || 0}%`}
                  icon={TrendingUp}
                  highlight={true}
                  subtitle="Converted vs (Converted + Lost)"
                />
                <StatCard
                  title="Total Orders Converted"
                  value={(convFunnel?.converted_enquiries || 0).toString()}
                  icon={Award}
                  subtitle="Ready-to-produce customers"
                />
                <StatCard
                  title="Open Leads in Discussion"
                  value={(convFunnel?.open_enquiries || 0).toString()}
                  icon={Clock}
                  subtitle="Actively quoted / discussed"
                />
                <StatCard
                  title="Lost Enquiries"
                  value={(convFunnel?.lost_enquiries || 0).toString()}
                  icon={AlertTriangle}
                  subtitle="With documented lost reasons"
                />
              </div>

              {/* Channel Conversion Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {["INSTAGRAM", "WHATSAPP"].map((chan) => {
                  const data = convData?.channels?.[chan] || {
                    total_enquiries: 0,
                    converted: 0,
                    lost: 0,
                    open: 0,
                    closed_conversion_rate: 0,
                  };
                  return (
                    <div
                      key={chan}
                      className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-card space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-stone-900">{chan} Direct Channel</h4>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          {data.closed_conversion_rate}% Conversion
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                        <div className="p-2 rounded-lg bg-stone-50">
                          <span className="text-3xs text-stone-500 block">Converted</span>
                          <span className="text-sm font-bold text-emerald-700">{data.converted}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-stone-50">
                          <span className="text-3xs text-stone-500 block">In Discussion</span>
                          <span className="text-sm font-bold text-stone-700">{data.open}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-stone-50">
                          <span className="text-3xs text-stone-500 block">Lost</span>
                          <span className="text-sm font-bold text-red-600">{data.lost}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lost Reasons Breakdown */}
              <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-card space-y-3">
                <h4 className="text-xs font-bold text-stone-900">Documented Lost Reasons</h4>
                {convData?.lost_reasons?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {convData.lost_reasons.map((r: any) => (
                      <div key={r.lost_reason} className="p-3 rounded-lg bg-stone-50 border border-stone-200">
                        <span className="text-xs font-semibold text-stone-800 block truncate">
                          {r.lost_reason}
                        </span>
                        <span className="text-xs font-bold text-red-700 mt-1 block">
                          {r.count} lost leads
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 italic">No lost leads recorded.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CUSTOMER ANALYTICS & RETENTION */}
      {/* ========================================================================= */}
      {activeTab === "CUSTOMERS" && (
        <div className="space-y-6">
          {custLoading ? (
            <LoadingState message="Analyzing customer retention rates..." />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <StatCard
                  title="Repeat Purchase Rate"
                  value={`${custMetrics?.repeat_purchase_rate || 0}%`}
                  icon={Award}
                  highlight={true}
                  subtitle="Returning vs verified purchasers"
                />
                <StatCard
                  title="Verified Purchasing Clients"
                  value={(custMetrics?.verified_purchasing_customers || 0).toString()}
                  icon={Users}
                  subtitle="Exclude unverified CSV records"
                />
                <StatCard
                  title="Returning Customers (2+ Orders)"
                  value={(custMetrics?.returning_customers || 0).toString()}
                  icon={ShoppingBag}
                  subtitle="High customer loyalty"
                />
                <StatCard
                  title="Total Registered in CRM"
                  value={(custMetrics?.total_registered_customers || 0).toString()}
                  icon={Users}
                  subtitle="CRM Directory records"
                />
              </div>

              {/* Top Customers by Lifetime Value (LTV) */}
              <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-card">
                <div className="p-4 border-b border-stone-200">
                  <h3 className="text-xs font-bold text-stone-900">
                    Top 10 Customers by Lifetime Value (LTV)
                  </h3>
                </div>
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Customer Name</th>
                      <th className="py-2.5 px-4">Phone</th>
                      <th className="py-2.5 px-4">City</th>
                      <th className="py-2.5 px-4">Orders Placed</th>
                      <th className="py-2.5 px-4">Average Order Value (₹)</th>
                      <th className="py-2.5 px-4 text-right">Lifetime Spend (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {custData?.top_customers?.map((c: any) => (
                      <tr key={c.id} className="hover:bg-stone-50/50">
                        <td className="py-2.5 px-4 font-semibold text-stone-900">
                          {c.name}
                          <span className="text-3xs text-stone-400 block">{c.customer_code}</span>
                        </td>
                        <td className="py-2.5 px-4 font-mono">{c.phone}</td>
                        <td className="py-2.5 px-4">{c.city}</td>
                        <td className="py-2.5 px-4 font-bold">{c.order_count}</td>
                        <td className="py-2.5 px-4 font-serif">{formatCurrency(c.average_order_value)}</td>
                        <td className="py-2.5 px-4 text-right font-serif font-bold text-rose-800">
                          {formatCurrency(c.total_spent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: EXPENSE ANALYTICS & COST STRUCTURE */}
      {/* ========================================================================= */}
      {activeTab === "EXPENSES" && (
        <div className="space-y-6">
          {expLoading ? (
            <LoadingState message="Processing operational cost analytics..." />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  title="Total Operating Outflows"
                  value={formatCurrency(expData?.summary?.total_expenses || 0)}
                  icon={Receipt}
                  highlight={true}
                  subtitle="Recorded across all categories"
                />
                <StatCard
                  title="Total Expense Vouchers"
                  value={(expData?.summary?.total_transactions || 0).toString()}
                  icon={Tag}
                  subtitle="Audit-backed entries"
                />
                <StatCard
                  title="Top Expense Outflow"
                  value={
                    expData?.categories?.length > 0 ? expData.categories[0].category_name : "Materials"
                  }
                  icon={TrendingUp}
                  subtitle={
                    expData?.categories?.length > 0
                      ? `${expData.categories[0].percentage_of_total}% of operating costs`
                      : "0%"
                  }
                />
              </div>

              {/* Categories & Payment Methods Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category Table */}
                <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-card space-y-3">
                  <h4 className="text-xs font-bold text-stone-900">Cost Breakdown by Category</h4>
                  <div className="space-y-2">
                    {expData?.categories?.map((cat: any, i: number) => (
                      <div key={cat.category_name} className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="font-semibold text-stone-800">{cat.category_name}</span>
                          <span className="text-3xs text-stone-400">({cat.count} bills)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-bold text-stone-900">
                            {formatCurrency(cat.amount)}
                          </span>
                          <span className="text-3xs font-semibold text-stone-500 w-10 text-right">
                            {cat.percentage_of_total}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Method Breakdown */}
                <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-card space-y-3">
                  <h4 className="text-xs font-bold text-stone-900">Disbursements by Payment Method</h4>
                  <div className="space-y-3">
                    {expData?.payment_methods?.map((m: any) => (
                      <div key={m.payment_method} className="p-3 rounded-lg bg-stone-50 border border-stone-200 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-xs text-stone-900">{m.payment_method}</span>
                          <span className="text-3xs text-stone-500 block">{m.count} transactions</span>
                        </div>
                        <span className="font-serif font-bold text-stone-900 text-sm">
                          {formatCurrency(m.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: DELAYED ORDERS & BOTTLENECK MONITOR */}
      {/* ========================================================================= */}
      {activeTab === "DELAYED" && (
        <div className="space-y-6">
          {delayedLoading ? (
            <LoadingState message="Checking delivery bottlenecks..." />
          ) : delayedOrders.length === 0 ? (
            <div className="p-8 bg-white rounded-xl border border-stone-200 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">No Delayed Orders</h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                All confirmed orders and shipments are within their expected delivery targets. Keep up the excellent turnaround!
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-stone-200/80 overflow-hidden shadow-card space-y-0">
              <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-red-50/50">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <h3 className="text-xs font-bold text-red-900">
                    Delayed Orders Requiring Customer & Courier Follow-up
                  </h3>
                </div>
                <span className="text-xs font-bold text-red-800">
                  {delayedOrders.length} Overdue
                </span>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Order & Client</th>
                    <th className="py-2.5 px-4">Courier & Tracking</th>
                    <th className="py-2.5 px-4">Expected Delivery</th>
                    <th className="py-2.5 px-4">Days Overdue</th>
                    <th className="py-2.5 px-4">Current Status</th>
                    <th className="py-2.5 px-4">Delay Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {delayedOrders.map((d) => (
                    <tr key={d.delivery_id} className="hover:bg-red-50/20">
                      <td className="py-2.5 px-4">
                        <span className="font-mono font-bold text-stone-900">{d.order_number}</span>
                        <span className="text-stone-700 block font-semibold">{d.customer_name}</span>
                        <span className="text-3xs text-stone-400">{d.customer_phone}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-stone-800">{d.courier_partner || "Courier"}</span>
                        {d.tracking_number && (
                          <span className="font-mono text-3xs text-stone-500 block">
                            AWB: {d.tracking_number}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-stone-700">
                        {d.expected_delivery_date}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-red-700">
                        {d.days_overdue} days
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 text-amber-800 uppercase">
                          {d.current_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-stone-600 italic">
                        {d.delay_reason || "Awaiting transit scan"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
