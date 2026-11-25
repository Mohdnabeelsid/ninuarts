import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IndianRupee,
  ShoppingBag,
  Clock,
  AlertTriangle,
  Users,
  ArrowUpRight,
  Plus,
  CreditCard,
  TrendingUp,
  Package,
  Receipt,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "../components/layout/PageHeader";
import { StatCard } from "../components/shared/StatCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { LoadingState } from "../components/shared/LoadingState";
import { ErrorState } from "../components/shared/ErrorState";
import { formatCurrency, formatDate } from "../lib/utils";
import { useActivePeriod } from "../contexts/ActivePeriodContext";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../lib/api";
import { Order, Enquiry } from "../types";

export function DashboardOverviewPage() {
  const { activePeriod } = useActivePeriod();
  const { user } = useAuth();
  const navigate = useNavigate();

  // 1. Fetch live dashboard metrics scoped to active period
  const { data: dashboardData, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-metrics", activePeriod.formatted],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/dashboard");
      return res.data?.data || null;
    },
  });

  // 2. Fetch monthly revenue trend anchored to active period
  const { data: revenueData } = useQuery({
    queryKey: ["dashboard-revenue-trend", activePeriod.formatted],
    queryFn: async () => {
      const res = await apiClient.get("/analytics/monthly-revenue?months=6");
      return res.data?.data?.trend || [];
    },
  });

  // 3. Fetch overdue deliveries
  const { data: overdueData } = useQuery({
    queryKey: ["dashboard-overdue-deliveries"],
    queryFn: async () => {
      const res = await apiClient.get("/deliveries/overdue");
      return (res.data?.data || []) as any[];
    },
  });

  const metrics = dashboardData?.metrics || {
    total_revenue_booked: 0,
    cash_collected: 0,
    total_expenses: 0,
    total_refunds: 0,
    net_business_profit: 0,
    outstanding_receivables: 0,
    active_orders_count: {},
    total_customers: 0,
    overdue_deliveries_count: 0,
  };

  const recentOrders: Order[] = dashboardData?.recent_orders || [];
  const recentEnquiries: Enquiry[] = dashboardData?.recent_enquiries || [];
  const overdueDeliveries = overdueData || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Soft Editorial Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E1D8] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#817872]">
            <Sparkles className="h-3.5 w-3.5 text-[#D4A373]" />
            <span>Studio Pulse & Financial Overview</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#34312F] mt-1 tracking-tight">
            Good day, {user?.name?.split(" ")[0] || "Nidha"}.
          </h1>
          <p className="text-xs text-[#817872] mt-0.5">
            Gifting operations and studio performance for {activePeriod.displayLabel}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate("/enquiries")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D6C4B5] bg-white px-3.5 py-2 text-xs font-medium text-[#34312F] shadow-soft hover:bg-[#F7F4F0] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Lead</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/orders")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#34312F] px-4 py-2 text-xs font-medium text-white shadow-soft hover:bg-[#1F1D1C] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Order</span>
          </button>
        </div>
      </div>

      {/* Delayed Orders Urgent Alert Banner */}
      {overdueDeliveries.length > 0 && (
        <div className="rounded-2xl border border-[#F2D0CE] bg-[#FAECEB]/80 p-4.5 shadow-card">
          <div className="flex items-start gap-3.5">
            <div className="rounded-xl bg-[#F2D0CE] p-2 text-[#8F352A] shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8F352A]">
                  Attention Required: {overdueDeliveries.length} Shipment Past Expected Target
                </h4>
                <span className="text-[10px] font-medium text-[#8F352A] bg-white/70 px-2 py-0.5 rounded-full border border-[#F2D0CE]">
                  Action Needed
                </span>
              </div>
              <p className="mt-1 text-xs text-[#6B2A21] leading-relaxed">
                Order <strong>{overdueDeliveries[0].order?.order_number}</strong> for{" "}
                <strong>{overdueDeliveries[0].recipient_name || overdueDeliveries[0].order?.customer?.name}</strong>{" "}
                was expected by {overdueDeliveries[0].estimated_delivery_date}. Current status:{" "}
                <span className="font-semibold uppercase">{overdueDeliveries[0].status}</span>.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/deliveries")}
                  className="rounded-lg bg-[#8F352A] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#72271E] transition-colors shadow-soft"
                >
                  Manage Deliveries
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary KPI Grid */}
      {isLoading ? (
        <LoadingState message="Loading live operational metrics..." />
      ) : isError ? (
        <ErrorState message="Failed to load dashboard data." onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Recognized Order Revenue"
              value={formatCurrency(metrics.total_revenue_booked)}
              icon={TrendingUp}
              highlight={true}
              subtitle="Confirmed order value"
            />
            <StatCard
              title="Cash Realized"
              value={formatCurrency(metrics.cash_collected)}
              icon={CreditCard}
              subtitle="Gross payments minus refunds"
            />
            <StatCard
              title="Operating Outflows"
              value={formatCurrency(metrics.total_expenses)}
              icon={Receipt}
              subtitle="Materials, courier, printing"
            />
            <StatCard
              title="Net Studio Profit"
              value={formatCurrency(metrics.net_business_profit)}
              icon={IndianRupee}
              subtitle="Cash realized minus expenses"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Outstanding Receivables"
              value={formatCurrency(metrics.outstanding_receivables)}
              icon={Clock}
              subtitle="Pending customer balances"
            />
            <StatCard
              title="Total CRM Customers"
              value={metrics.total_customers?.toString() || "0"}
              icon={Users}
              subtitle="Registered gifting clients"
            />
            <StatCard
              title="Active Production Pipeline"
              value={(
                (metrics.active_orders_count?.CONFIRMED || 0) +
                (metrics.active_orders_count?.IN_PROGRESS || 0) +
                (metrics.active_orders_count?.READY_FOR_DELIVERY || 0)
              ).toString()}
              icon={Package}
              subtitle="Orders in craft & packaging"
            />
          </div>

          {/* Revenue vs Cash Trend Chart */}
          <div className="bg-white p-5.5 rounded-2xl border border-[#E7E1D8] shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-[#34312F] uppercase tracking-wider">
                  Financial Realization: Recognized Revenue vs Cash Deposits
                </h3>
                <p className="text-[11px] text-[#817872] mt-0.5">
                  Visual comparison of accrual-booked gifting orders against actual bank & UPI receipts.
                </p>
              </div>
              <button
                onClick={() => navigate("/analytics")}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#34312F] hover:text-[#817872] transition-colors"
              >
                Detailed P&L <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34312F" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#34312F" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B9B86" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8B9B86" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE7" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#817872" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#817872" }} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip
                    formatter={(val: any) => formatCurrency(Number(val))}
                    contentStyle={{ borderRadius: 12, fontSize: 12, borderColor: "#E7E1D8", backgroundColor: "#FFFFFF" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="recognized_revenue"
                    name="Recognized Revenue"
                    stroke="#34312F"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                  />
                  <Area
                    type="monotone"
                    dataKey="cash_collected"
                    name="Cash Realized"
                    stroke="#8B9B86"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCash)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Operational Tables: Recent Orders & Leads */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <div className="bg-white rounded-2xl border border-[#E7E1D8] shadow-card overflow-hidden flex flex-col">
              <div className="p-4.5 border-b border-[#F0ECE7] flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#34312F] uppercase tracking-wider">Recent Customer Orders</h3>
                <button
                  onClick={() => navigate("/orders")}
                  className="text-xs font-medium text-[#34312F] hover:text-[#817872] transition-colors"
                >
                  View All Orders →
                </button>
              </div>
              <div className="divide-y divide-[#F0ECE7] flex-1">
                {recentOrders.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#817872]">No recent orders.</div>
                ) : (
                  recentOrders.map((ord) => (
                    <div key={ord.id} className="p-3.5 hover:bg-[#FDFBF7] flex items-center justify-between transition-colors">
                      <div>
                        <span className="font-mono font-medium text-xs text-[#34312F]">
                          {ord.order_number}
                        </span>
                        <span className="text-xs text-[#6B635B] block font-medium">
                          {ord.customer?.name || "Customer"}
                        </span>
                        <span className="text-[10px] text-[#817872]">
                          {formatDate(ord.created_at)}
                        </span>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="font-serif text-[#34312F] text-sm">
                          {formatCurrency(ord.total_amount)}
                        </span>
                        <StatusBadge status={ord.status} size="sm" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Enquiries */}
            <div className="bg-white rounded-2xl border border-[#E7E1D8] shadow-card overflow-hidden flex flex-col">
              <div className="p-4.5 border-b border-[#F0ECE7] flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#34312F] uppercase tracking-wider">Recent Inbound Inquiries</h3>
                <button
                  onClick={() => navigate("/enquiries")}
                  className="text-xs font-medium text-[#34312F] hover:text-[#817872] transition-colors"
                >
                  View All Enquiries →
                </button>
              </div>
              <div className="divide-y divide-[#F0ECE7] flex-1">
                {recentEnquiries.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#817872]">No recent enquiries.</div>
                ) : (
                  recentEnquiries.map((enq) => (
                    <div key={enq.id} className="p-3.5 hover:bg-[#FDFBF7] flex items-center justify-between transition-colors">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#E8D8D4] text-[#7A4B43]">
                            {enq.channel}
                          </span>
                          <span className="font-medium text-xs text-[#34312F]">
                            {enq.product_interest}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#817872] mt-0.5 block">
                          Logged: {formatDate(enq.created_at)}
                        </span>
                      </div>
                      <StatusBadge status={enq.status} size="sm" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
