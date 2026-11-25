import React, { useState } from "react";
import {
  Plus,
  ShoppingBag,
  Eye,
  Calendar,
  User,
  IndianRupee,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Edit2,
  DollarSign,
  CreditCard,
  FileText,
  Lock,
  Layers,
  Send,
  Loader2,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/layout/PageHeader";
import { DataTable, Column } from "../components/shared/DataTable";
import { SearchInput } from "../components/shared/SearchInput";
import { FilterDropdown } from "../components/shared/FilterDropdown";
import { StatusBadge } from "../components/shared/StatusBadge";
import { FormDialog } from "../components/shared/FormDialog";
import { DetailDrawer } from "../components/shared/DetailDrawer";
import { ConfirmationDialog } from "../components/shared/ConfirmationDialog";
import { LoadingState } from "../components/shared/LoadingState";
import { ErrorState } from "../components/shared/ErrorState";
import { formatCurrency, getApiErrorMessage } from "../lib/utils";
import { apiClient } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useActivePeriod } from "../contexts/ActivePeriodContext";
import { useDashboardSearch } from "../layouts/DashboardLayout";
import {
  Order,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  Customer,
  Product,
} from "../types";

export function OrdersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activePeriod } = useActivePeriod();
  const globalSearch = useDashboardSearch();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");

  // Selection & Modals
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isModifyOpen, setIsModifyOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"ITEMS" | "PAYMENTS" | "REFUNDS" | "TIMELINE">("ITEMS");

  // Status transition note prompt
  const [statusNote, setStatusNote] = useState("");
  const [pendingStatusChange, setPendingStatusChange] = useState<OrderStatus | null>(null);

  // New Order Wizard State
  const [customerMode, setCustomerMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustChannel, setNewCustChannel] = useState<"INSTAGRAM" | "WHATSAPP" | "REFERRAL" | "DIRECT">("INSTAGRAM");
  const [newCustCity, setNewCustCity] = useState("Alappuzha");
  const [newCustAddress, setNewCustAddress] = useState("");

  const [orderDeliveryCharge, setOrderDeliveryCharge] = useState("100");
  const [orderDiscount, setOrderDiscount] = useState("0");
  const [orderAdvanceReq, setOrderAdvanceReq] = useState("500");
  const [orderTargetDate, setOrderTargetDate] = useState("");
  const [orderInternalNotes, setOrderInternalNotes] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Dynamic Line Items for Create / Modify
  const [orderItems, setOrderItems] = useState<
    Array<{
      product_id?: number | null;
      item_name: string;
      item_type: "CATALOG" | "CUSTOM";
      unit_price: number;
      quantity: number;
      customization_details: string;
      direct_cost?: number;
      cost_type?: "RAW_MATERIAL" | "PRINT" | "FRAME" | "PACKAGING" | "OTHER";
    }>
  >([
    {
      item_name: "12x18 Minimalist Pine Frame",
      item_type: "CUSTOM",
      unit_price: 1500,
      quantity: 1,
      customization_details: "Family portrait with natural pine wood border",
    },
  ]);

  // Optional direct advance during creation
  const [recordAdvanceNow, setRecordAdvanceNow] = useState(false);
  const [directAdvanceAmount, setDirectAdvanceAmount] = useState("500");
  const [directAdvanceMethod, setDirectAdvanceMethod] = useState<PaymentMethod>("UPI");
  const [directAdvanceRef, setDirectAdvanceRef] = useState("");

  // Payment Recording State
  const [payAmount, setPayAmount] = useState("");
  const [payType, setPayType] = useState<"ADVANCE" | "PARTIAL" | "INTERIM" | "ADDITIONAL" | "BALANCE_FINAL">("PARTIAL");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("UPI");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payError, setPayError] = useState<string | null>(null);

  // Refund Recording State
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>("UPI");
  const [refundRef, setRefundRef] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundNotes, setRefundNotes] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);

  // Modify Order State
  const [modifyReason, setModifyReason] = useState("");
  const [modifyError, setModifyError] = useState<string | null>(null);

  // Fetch Orders
  const effectiveSearch = search || globalSearch;
  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Order[]>({
    queryKey: ["orders", activePeriod.formatted, effectiveSearch, statusFilter, paymentFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (effectiveSearch) params.search = effectiveSearch;
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (paymentFilter !== "ALL") params.payment_status = paymentFilter;
      const res = await apiClient.get("/orders", { params });
      return res.data?.data?.data || res.data?.data || [];
    },
  });

  // Fetch Customers for order creation dropdown
  const { data: customerOptions = [] } = useQuery<Customer[]>({
    queryKey: ["customers-dropdown-orders"],
    queryFn: async () => {
      const res = await apiClient.get("/customers?per_page=100");
      return res.data?.data?.data || res.data?.data || [];
    },
    enabled: isCreateOpen,
  });

  // Fetch Products for catalog item selection
  const { data: catalogProducts = [] } = useQuery<Product[]>({
    queryKey: ["catalog-products-orders"],
    queryFn: async () => {
      const res = await apiClient.get("/products?is_active=1&per_page=100");
      return res.data?.data?.data || res.data?.data || [];
    },
    enabled: isCreateOpen || isModifyOpen,
  });

  // Fetch Selected Order Details
  const {
    data: orderDetails,
    isLoading: isDetailsLoading,
    refetch: refetchOrderDetails,
  } = useQuery<Order | null>({
    queryKey: ["order", selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return null;
      const res = await apiClient.get(`/orders/${selectedOrderId}`);
      return res.data?.data || null;
    },
    enabled: !!selectedOrderId,
  });

  // Create Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/orders", payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setIsCreateOpen(false);
      resetCreateForm();
      const newId = data?.data?.id;
      if (newId) setSelectedOrderId(newId);
    },
    onError: (err: any) => {
      setCreateError(getApiErrorMessage(err, "Order creation failed."));
    },
  });

  // Record Payment Mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async ({ orderId, payload }: { orderId: number; payload: any }) => {
      const res = await apiClient.post(`/orders/${orderId}/payments`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", selectedOrderId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setIsPaymentOpen(false);
      setPayAmount("");
      setPayRef("");
      setPayNotes("");
      setPayError(null);
    },
    onError: (err: any) => {
      setPayError(getApiErrorMessage(err, "Failed to record payment."));
    },
  });

  // Process Refund Mutation
  const processRefundMutation = useMutation({
    mutationFn: async ({ orderId, payload }: { orderId: number; payload: any }) => {
      const res = await apiClient.post(`/orders/${orderId}/refunds`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", selectedOrderId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setIsRefundOpen(false);
      setRefundAmount("");
      setRefundRef("");
      setRefundReason("");
      setRefundNotes("");
      setRefundError(null);
    },
    onError: (err: any) => {
      setRefundError(getApiErrorMessage(err, "Failed to process refund."));
    },
  });

  // Modify Order Mutation
  const modifyOrderMutation = useMutation({
    mutationFn: async ({ orderId, payload }: { orderId: number; payload: any }) => {
      const res = await apiClient.put(`/orders/${orderId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", selectedOrderId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setIsModifyOpen(false);
      setModifyReason("");
      setModifyError(null);
    },
    onError: (err: any) => {
      setModifyError(getApiErrorMessage(err, "Order modification failed."));
    },
  });

  // Status Change Mutation
  const statusChangeMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
      note,
    }: {
      orderId: number;
      status: OrderStatus;
      note?: string;
    }) => {
      const res = await apiClient.patch(`/orders/${orderId}/status`, { status, note });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", selectedOrderId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setPendingStatusChange(null);
      setOrderToCancel(null);
      setStatusNote("");
    },
    onError: (err: any) => {
      alert(getApiErrorMessage(err, "Status update failed."));
      setPendingStatusChange(null);
      setOrderToCancel(null);
    },
  });

  const resetCreateForm = () => {
    setCustomerMode("EXISTING");
    setSelectedCustomerId("");
    setNewCustName("");
    setNewCustPhone("");
    setNewCustChannel("INSTAGRAM");
    setNewCustCity("Alappuzha");
    setNewCustAddress("");
    setOrderDeliveryCharge("100");
    setOrderDiscount("0");
    setOrderAdvanceReq("500");
    setOrderTargetDate("");
    setOrderInternalNotes("");
    setRecordAdvanceNow(false);
    setDirectAdvanceAmount("500");
    setDirectAdvanceRef("");
    setCreateError(null);
    setOrderItems([
      {
        item_name: "12x18 Minimalist Pine Frame",
        item_type: "CUSTOM",
        unit_price: 1500,
        quantity: 1,
        customization_details: "Family portrait with natural pine wood border",
      },
    ]);
  };

  // Real-time calculation helpers for Create Form
  const calcSubtotal = orderItems.reduce(
    (sum, item) => sum + (parseFloat(String(item.unit_price)) || 0) * (item.quantity || 1),
    0
  );
  const calcDelivery = parseFloat(orderDeliveryCharge) || 0;
  const calcDiscount = parseFloat(orderDiscount) || 0;
  const calcTotal = Math.max(0, calcSubtotal + calcDelivery - calcDiscount);

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const payload: any = {
      delivery_charge: parseFloat(orderDeliveryCharge) || 0,
      discount_amount: parseFloat(orderDiscount) || 0,
      advance_amount_required: parseFloat(orderAdvanceReq) || 0,
      target_delivery_date: orderTargetDate || null,
      internal_notes: orderInternalNotes.trim() || null,
      items: orderItems.map((it) => ({
        product_id: it.product_id || null,
        item_name: it.item_name.trim(),
        item_type: it.item_type,
        unit_price: parseFloat(String(it.unit_price)) || 0,
        quantity: parseInt(String(it.quantity)) || 1,
        customization_details: it.customization_details?.trim() || null,
        direct_cost: it.direct_cost ? parseFloat(String(it.direct_cost)) : null,
        cost_type: it.cost_type || null,
      })),
    };

    if (customerMode === "EXISTING") {
      if (!selectedCustomerId) {
        setCreateError("Please select an existing customer.");
        return;
      }
      payload.customer_id = Number(selectedCustomerId);
    } else {
      if (!newCustName.trim() || !newCustPhone.trim()) {
        setCreateError("Customer name and phone number are required.");
        return;
      }
      payload.new_customer = {
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        source_channel: newCustChannel,
        city: newCustCity.trim() || "Alappuzha",
        delivery_address: newCustAddress.trim() || null,
      };
    }

    if (recordAdvanceNow && parseFloat(directAdvanceAmount) > 0) {
      payload.advance_payment = {
        amount: parseFloat(directAdvanceAmount),
        payment_method: directAdvanceMethod,
        transaction_reference: directAdvanceRef.trim() || null,
        notes: "Advance payment recorded during order creation",
      };
    }

    createOrderMutation.mutate(payload);
  };

  const handleOpenModifyModal = (order: Order) => {
    setModifyReason("");
    setModifyError(null);
    setOrderDeliveryCharge(String(order.delivery_charge));
    setOrderDiscount(String(order.discount_amount));
    setOrderAdvanceReq(String(order.advance_amount_required));
    setOrderTargetDate(order.target_delivery_date ? order.target_delivery_date.substring(0, 10) : "");
    setOrderInternalNotes(order.internal_notes || "");

    const mapped = (order.items || []).map((it) => {
      const existingCost = (it.costs || []).reduce(
        (sum, c) => sum + (parseFloat(String(c.amount)) || 0),
        0
      );
      return {
        product_id: it.product_id,
        item_name: it.item_name,
        item_type: it.item_type,
        unit_price: it.unit_price,
        quantity: it.quantity,
        customization_details: it.customization_details || "",
        direct_cost: existingCost > 0 ? existingCost : undefined,
        cost_type: it.costs?.[0]?.cost_type || "RAW_MATERIAL",
      };
    });

    setOrderItems(mapped.length > 0 ? mapped : [
      {
        item_name: "Custom Product Item",
        item_type: "CUSTOM",
        unit_price: 1000,
        quantity: 1,
        customization_details: "",
      },
    ]);

    setIsModifyOpen(true);
  };

  const handleExecuteModify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderDetails) return;
    setModifyError(null);

    if (!modifyReason.trim()) {
      setModifyError("A clear modification reason is mandatory for audit records.");
      return;
    }

    const payload = {
      modification_reason: modifyReason.trim(),
      delivery_charge: parseFloat(orderDeliveryCharge) || 0,
      discount_amount: parseFloat(orderDiscount) || 0,
      advance_amount_required: parseFloat(orderAdvanceReq) || 0,
      target_delivery_date: orderTargetDate || null,
      internal_notes: orderInternalNotes.trim() || null,
      items: orderItems.map((it) => ({
        product_id: it.product_id || null,
        item_name: it.item_name.trim(),
        item_type: it.item_type,
        unit_price: parseFloat(String(it.unit_price)) || 0,
        quantity: parseInt(String(it.quantity)) || 1,
        customization_details: it.customization_details?.trim() || null,
        direct_cost:
          it.direct_cost && parseFloat(String(it.direct_cost)) > 0
            ? parseFloat(String(it.direct_cost))
            : null,
        cost_type: it.cost_type || "RAW_MATERIAL",
      })),
    };

    modifyOrderMutation.mutate({ orderId: orderDetails.id, payload });
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderDetails) return;
    setPayError(null);

    const payload = {
      amount: parseFloat(payAmount) || 0,
      payment_type: payType,
      payment_method: payMethod,
      transaction_reference: payRef.trim() || null,
      notes: payNotes.trim() || null,
    };

    recordPaymentMutation.mutate({ orderId: orderDetails.id, payload });
  };

  const handleProcessRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderDetails) return;
    setRefundError(null);

    const payload = {
      amount: parseFloat(refundAmount) || 0,
      refund_method: refundMethod,
      transaction_reference: refundRef.trim() || null,
      reason: refundReason.trim(),
      notes: refundNotes.trim() || null,
    };

    processRefundMutation.mutate({ orderId: orderDetails.id, payload });
  };

  const columns: Column<Order>[] = [
    {
      header: "Order Number",
      cell: (row) => (
        <div>
          <span className="font-mono font-bold text-stone-900 text-xs">{row.order_number}</span>
          <p className="text-3xs text-stone-400 mt-0.5">
            {new Date(row.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      ),
    },
    {
      header: "Customer",
      cell: (row) => (
        <div>
          <p className="font-semibold text-stone-900">{row.customer?.name || "Direct Customer"}</p>
          <p className="text-3xs text-stone-500 font-mono">{row.customer?.phone}</p>
        </div>
      ),
    },
    {
      header: "Items Summary",
      cell: (row) => {
        const count = row.items?.length || 1;
        const firstName = row.items?.[0]?.item_name || "Custom Craft Item";
        return (
          <div className="max-w-xs truncate text-stone-700">
            <span className="font-medium">{firstName}</span>
            {count > 1 && (
              <span className="text-3xs text-stone-400 ml-1">+{count - 1} more items</span>
            )}
          </div>
        );
      },
    },
    {
      header: "Financials (INR)",
      cell: (row) => (
        <div>
          <p className="font-bold text-stone-900">{formatCurrency(row.total_amount)}</p>
          <p
            className={`text-3xs font-semibold ${
              row.balance_amount > 0 ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            Balance: {formatCurrency(row.balance_amount)}
          </p>
        </div>
      ),
    },
    {
      header: "Order Status",
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      header: "Payment",
      cell: (row) => <StatusBadge status={row.payment_status} size="sm" />,
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setSelectedOrderId(row.id)}
            className="rounded p-1 text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
            title="Inspect Order"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedOrderId(row.id);
              setPayAmount(String(row.balance_amount > 0 ? row.balance_amount : 500));
              setPayType(row.status === "DRAFT" || row.total_paid === 0 ? "ADVANCE" : "PARTIAL");
              setIsPaymentOpen(true);
            }}
            className="rounded bg-rose-50 p-1 text-rose-700 hover:bg-rose-100 border border-rose-200/60 transition-colors"
            title="Record Payment"
          >
            <CreditCard className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders & Production Management"
        description="End-to-end craft order lifecycle, advance tracking, multi-item invoicing, and payment ledgers in INR."
        actions={
          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#34312F] px-3.5 py-2 text-xs font-semibold text-white shadow-soft hover:bg-[#1F1D1C] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create New Order</span>
          </button>
        }
      />

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by order #, customer, phone, notes..."
        />
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <FilterDropdown
            label="Order Status"
            selectedValue={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: "All Statuses", value: "ALL" },
              { label: "Draft", value: "DRAFT" },
              { label: "Awaiting Advance", value: "PENDING_ADVANCE" },
              { label: "Confirmed", value: "CONFIRMED" },
              { label: "In Crafting", value: "IN_PROGRESS" },
              { label: "Ready for Dispatch", value: "READY_FOR_DELIVERY" },
              { label: "Dispatched", value: "DISPATCHED" },
              { label: "Delivered", value: "DELIVERED" },
              { label: "On Hold", value: "ON_HOLD" },
              { label: "Cancelled", value: "CANCELLED" },
            ]}
          />
          <FilterDropdown
            label="Payment Status"
            selectedValue={paymentFilter}
            onChange={setPaymentFilter}
            options={[
              { label: "All Payments", value: "ALL" },
              { label: "Unpaid", value: "UNPAID" },
              { label: "Partially Paid", value: "PARTIALLY_PAID" },
              { label: "Settled (Full)", value: "PAID" },
              { label: "Overpaid", value: "OVERPAID" },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading orders and ledger balances..." />
      ) : isError ? (
        <ErrorState
          title="Could not load orders"
          message={(error as any)?.message || "Failed to communicate with Laravel Order API."}
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          data={orders}
          columns={columns}
          onRowClick={(row) => setSelectedOrderId(row.id)}
          emptyTitle="No orders found"
          emptyMessage="No customer orders match your search or status filter."
        />
      )}

      {/* ORDER DETAIL DRAWER & COMMAND CENTER */}
      {selectedOrderId && (
        <DetailDrawer
          isOpen={!!selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          title={
            orderDetails
              ? `Order ${orderDetails.order_number}`
              : "Order Details"
          }
          subtitle={orderDetails?.customer?.name}
          width="xl"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="rounded-xl border border-[#E7E1D8] px-4 py-2 text-[#34312F] hover:bg-[#F7F4F0] font-medium text-xs transition-colors"
              >
                Close Drawer
              </button>
            </div>
          }
        >
          {isDetailsLoading || !orderDetails ? (
            <div className="py-8">
              <LoadingState message="Fetching order records, payment ledgers, and audit history..." />
            </div>
          ) : (
            <div className="space-y-5 text-xs">
              {/* Financial KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3.5 rounded-2xl bg-[#F7F4F0] border border-[#E7E1D8]">
                  <p className="text-[10px] uppercase tracking-wider text-[#817872] font-semibold">
                    Total Order Value
                  </p>
                  <p className="font-serif text-lg text-[#34312F] mt-0.5">
                    {formatCurrency(orderDetails.total_amount)}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#EAF0E8] border border-[#D1E0CE]">
                  <p className="text-[10px] uppercase tracking-wider text-[#475E42] font-semibold">
                    Net Paid
                  </p>
                  <p className="font-serif text-lg text-[#475E42] mt-0.5">
                    {formatCurrency(orderDetails.total_paid)}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#FAF0E6] border border-[#F0DDC7]">
                  <p className="text-[10px] uppercase tracking-wider text-[#8C6239] font-semibold">
                    Outstanding Balance
                  </p>
                  <p className="font-serif text-lg text-[#8C6239] mt-0.5">
                    {formatCurrency(orderDetails.balance_amount)}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F5ECE9] border border-[#E8D8D4]">
                  <p className="text-[10px] uppercase tracking-wider text-[#7A4B43] font-semibold">
                    Advance Required
                  </p>
                  <p className="font-serif text-lg text-[#7A4B43] mt-0.5">
                    {formatCurrency(orderDetails.advance_amount_required)}
                  </p>
                </div>
              </div>

              {/* Status Header and Lifecycle Actions */}
              <div className="bg-[#FDFBF7] p-4 rounded-2xl border border-[#E7E1D8] flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-sm">Lifecycle Status:</span>
                    <StatusBadge status={orderDetails.status} size="sm" />
                    <StatusBadge status={orderDetails.payment_status} size="sm" />
                  </div>
                  <p className="text-3xs text-stone-500">
                    Target Delivery:{" "}
                    <strong>
                      {orderDetails.target_delivery_date
                        ? new Date(orderDetails.target_delivery_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Not specified"}
                    </strong>
                    {orderDetails.confirmed_at && (
                      <span className="ml-2 text-emerald-700">
                        • Confirmed on {new Date(orderDetails.confirmed_at).toLocaleDateString("en-IN")}
                      </span>
                    )}
                  </p>
                </div>

                {/* Status Stepper Controls */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {orderDetails.status === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() =>
                        statusChangeMutation.mutate({
                          orderId: orderDetails.id,
                          status: "CONFIRMED",
                          note: "Manual confirmation triggered",
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-white font-semibold hover:bg-emerald-800 shadow-soft text-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Confirm Order</span>
                    </button>
                  )}

                  {orderDetails.status === "CONFIRMED" && (
                    <button
                      type="button"
                      onClick={() =>
                        statusChangeMutation.mutate({
                          orderId: orderDetails.id,
                          status: "IN_PROGRESS",
                          note: "Handed over to framing studio",
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-700 px-3 py-1.5 text-white font-semibold hover:bg-rose-800 shadow-soft text-xs"
                    >
                      <span>Start Crafting</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {orderDetails.status === "IN_PROGRESS" && (
                    <button
                      type="button"
                      onClick={() =>
                        statusChangeMutation.mutate({
                          orderId: orderDetails.id,
                          status: "READY_FOR_DELIVERY",
                          note: "Crafting completed, packaging ready",
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-xl bg-indigo-700 px-3 py-1.5 text-white font-semibold hover:bg-indigo-800 shadow-soft text-xs"
                    >
                      <span>Mark Ready</span>
                    </button>
                  )}

                  {orderDetails.status === "READY_FOR_DELIVERY" && (
                    <button
                      type="button"
                      onClick={() =>
                        statusChangeMutation.mutate({
                          orderId: orderDetails.id,
                          status: "DISPATCHED",
                          note: "Dispatched to courier partner",
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-xl bg-blue-700 px-3 py-1.5 text-white font-semibold hover:bg-blue-800 shadow-soft text-xs"
                    >
                      <span>Dispatch</span>
                    </button>
                  )}

                  {orderDetails.status === "DISPATCHED" && (
                    <button
                      type="button"
                      onClick={() =>
                        statusChangeMutation.mutate({
                          orderId: orderDetails.id,
                          status: "DELIVERED",
                          note: "Delivered to client",
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-white font-semibold hover:bg-emerald-800 shadow-soft text-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Mark Delivered</span>
                    </button>
                  )}

                  {orderDetails.status !== "CANCELLED" && orderDetails.status !== "DELIVERED" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          statusChangeMutation.mutate({
                            orderId: orderDetails.id,
                            status: orderDetails.status === "ON_HOLD" ? "CONFIRMED" : "ON_HOLD",
                            note: "Toggled hold status",
                          })
                        }
                        className="rounded-xl border border-[#E7E1D8] bg-white px-2.5 py-1.5 text-[#34312F] hover:bg-[#F7F4F0] font-medium text-xs"
                      >
                        {orderDetails.status === "ON_HOLD" ? "Resume" : "Hold"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderToCancel(orderDetails)}
                        className="rounded-xl border border-[#F2D0CE] bg-[#FAECEB] px-2.5 py-1.5 text-[#8F352A] hover:bg-[#F2D0CE]/60 font-medium text-xs"
                      >
                        Cancel Order
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setPayAmount(String(orderDetails.balance_amount > 0 ? orderDetails.balance_amount : 500));
                      setPayType(orderDetails.balance_amount === 0 ? "ADDITIONAL" : "PARTIAL");
                      setIsPaymentOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-700 px-3 py-1.5 text-white font-semibold hover:bg-rose-800 shadow-soft text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Record Payment</span>
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-stone-200 text-xs font-semibold gap-4">
                <button
                  type="button"
                  onClick={() => setActiveDetailTab("ITEMS")}
                  className={`pb-2 transition-colors border-b-2 ${
                    activeDetailTab === "ITEMS"
                      ? "border-rose-700 text-rose-800"
                      : "border-transparent text-stone-500 hover:text-stone-800"
                  }`}
                >
                  Line Items ({orderDetails.items?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailTab("PAYMENTS")}
                  className={`pb-2 transition-colors border-b-2 ${
                    activeDetailTab === "PAYMENTS"
                      ? "border-rose-700 text-rose-800"
                      : "border-transparent text-stone-500 hover:text-stone-800"
                  }`}
                >
                  Payments Ledger ({orderDetails.payments?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailTab("REFUNDS")}
                  className={`pb-2 transition-colors border-b-2 ${
                    activeDetailTab === "REFUNDS"
                      ? "border-rose-700 text-rose-800"
                      : "border-transparent text-stone-500 hover:text-stone-800"
                  }`}
                >
                  Refunds ({orderDetails.refunds?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDetailTab("TIMELINE")}
                  className={`pb-2 transition-colors border-b-2 ${
                    activeDetailTab === "TIMELINE"
                      ? "border-rose-700 text-rose-800"
                      : "border-transparent text-stone-500 hover:text-stone-800"
                  }`}
                >
                  Audit Timeline & Modifications
                </button>
              </div>

              {/* TAB 1: LINE ITEMS */}
              {activeDetailTab === "ITEMS" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-700 uppercase tracking-wider text-2xs">
                      Product Items & Craft Specifications
                    </span>
                    {orderDetails.status !== "CANCELLED" && (
                      <button
                        type="button"
                        onClick={() => handleOpenModifyModal(orderDetails)}
                        className="inline-flex items-center gap-1 text-2xs font-semibold text-rose-700 hover:text-rose-800"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>Modify Order Items & Pricing</span>
                      </button>
                    )}
                  </div>

                  <div className="rounded-lg border border-stone-200 overflow-hidden bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 text-stone-500 font-medium text-3xs uppercase border-b border-stone-200">
                        <tr>
                          <th className="p-3">Item Name & Instructions</th>
                          <th className="p-3">Type</th>
                          <th className="p-3 text-right">Unit Price</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 text-stone-800">
                        {orderDetails.items?.map((item, idx) => (
                          <tr key={idx} className="hover:bg-stone-50/70">
                            <td className="p-3">
                              <p className="font-semibold text-stone-900">{item.item_name}</p>
                              {item.customization_details && (
                                <p className="text-2xs text-stone-500 mt-0.5 italic">
                                  "{item.customization_details}"
                                </p>
                              )}
                              {item.costs && item.costs.length > 0 && (
                                <div className="mt-1 flex items-center gap-2">
                                  {item.costs.map((c, ci) => (
                                    <span
                                      key={ci}
                                      className="rounded bg-stone-100 px-1.5 py-0.5 text-3xs font-mono text-stone-600"
                                    >
                                      Cost ({c.cost_type}): ₹{c.amount}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="rounded bg-stone-100 px-2 py-0.5 text-3xs font-semibold text-stone-600 uppercase">
                                {item.item_type}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono font-medium">
                              {formatCurrency(item.unit_price)}
                            </td>
                            <td className="p-3 text-center font-mono font-bold">
                              {item.quantity}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-stone-900">
                              {formatCurrency(item.total_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-stone-50 font-semibold border-t border-stone-200 text-stone-700">
                        <tr>
                          <td colSpan={4} className="p-2.5 text-right text-3xs uppercase">
                            Subtotal
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            {formatCurrency(orderDetails.subtotal_amount)}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="p-2 text-right text-3xs uppercase">
                            Delivery / Shipping Charges
                          </td>
                          <td className="p-2 text-right font-mono">
                            +{formatCurrency(orderDetails.delivery_charge)}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="p-2 text-right text-3xs uppercase text-emerald-700">
                            Discount
                          </td>
                          <td className="p-2 text-right font-mono text-emerald-700">
                            -{formatCurrency(orderDetails.discount_amount)}
                          </td>
                        </tr>
                        <tr className="border-t border-stone-200 bg-stone-100 text-stone-900 text-xs">
                          <td colSpan={4} className="p-3 text-right font-bold uppercase">
                            Grand Total
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-sm text-rose-900">
                            {formatCurrency(orderDetails.total_amount)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: PAYMENTS LEDGER */}
              {activeDetailTab === "PAYMENTS" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-700 uppercase tracking-wider text-2xs">
                      Recorded Payment Receipts
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPayAmount(String(orderDetails.balance_amount > 0 ? orderDetails.balance_amount : 500));
                        setPayType(orderDetails.balance_amount === 0 ? "ADDITIONAL" : "PARTIAL");
                        setIsPaymentOpen(true);
                      }}
                      className="inline-flex items-center gap-1 rounded bg-rose-700 px-3 py-1 text-white font-semibold hover:bg-rose-800 text-2xs"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Record Payment</span>
                    </button>
                  </div>

                  {orderDetails.payments && orderDetails.payments.length > 0 ? (
                    <div className="rounded-lg border border-stone-200 overflow-hidden bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-stone-50 text-stone-500 font-medium text-3xs uppercase border-b border-stone-200">
                          <tr>
                            <th className="p-2.5">Date & Type</th>
                            <th className="p-2.5">Method</th>
                            <th className="p-2.5">Reference (UTR)</th>
                            <th className="p-2.5">Recorded By</th>
                            <th className="p-2.5 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {orderDetails.payments.map((pay) => (
                            <tr key={pay.id} className="hover:bg-stone-50">
                              <td className="p-2.5">
                                <span className="font-semibold text-stone-900">
                                  {pay.payment_type.replace(/_/g, " ")}
                                </span>
                                <p className="text-3xs text-stone-400">
                                  {new Date(pay.payment_date).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
                              </td>
                              <td className="p-2.5">
                                <span className="rounded bg-stone-100 px-2 py-0.5 text-3xs font-semibold text-stone-700">
                                  {pay.payment_method}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono text-stone-600 text-2xs">
                                {pay.transaction_reference || "— (Cash receipt)"}
                              </td>
                              <td className="p-2.5 text-stone-500 text-2xs">
                                {pay.recorder?.name || "Staff"}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-emerald-800 text-xs">
                                +{formatCurrency(pay.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 rounded-lg bg-stone-50 border border-stone-200/70 text-center text-stone-500">
                      No payments recorded for this order yet.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: REFUNDS */}
              {activeDetailTab === "REFUNDS" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-stone-700 uppercase tracking-wider text-2xs">
                        Refund Processing Ledger
                      </span>
                      <p className="text-3xs text-stone-500">
                        Refund ceiling cannot exceed net paid balance:{" "}
                        <strong>{formatCurrency(orderDetails.total_paid)}</strong>
                      </p>
                    </div>
                    {user?.role === "OWNER" && orderDetails.total_paid > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setRefundAmount(String(orderDetails.total_paid));
                          setIsRefundOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-amber-700 px-3 py-1 text-white font-semibold hover:bg-amber-800 text-2xs"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Process Refund</span>
                      </button>
                    )}
                  </div>

                  {orderDetails.refunds && orderDetails.refunds.length > 0 ? (
                    <div className="rounded-lg border border-stone-200 overflow-hidden bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-stone-50 text-stone-500 font-medium text-3xs uppercase border-b border-stone-200">
                          <tr>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Reason</th>
                            <th className="p-2.5">Method & Ref</th>
                            <th className="p-2.5">Processed By</th>
                            <th className="p-2.5 text-right">Refund Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {orderDetails.refunds.map((ref) => (
                            <tr key={ref.id} className="hover:bg-stone-50">
                              <td className="p-2.5 text-stone-500 text-3xs">
                                {new Date(ref.refund_date).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="p-2.5 font-medium text-stone-900">{ref.reason}</td>
                              <td className="p-2.5 font-mono text-2xs text-stone-600">
                                {ref.refund_method} {ref.transaction_reference && `(${ref.transaction_reference})`}
                              </td>
                              <td className="p-2.5 text-stone-500 text-2xs">
                                {ref.processor?.name || "Owner"}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-red-700 text-xs">
                                -{formatCurrency(ref.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 rounded-lg bg-stone-50 border border-stone-200/70 text-center text-stone-500">
                      No refunds have been processed for this order.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: AUDIT TIMELINE & MODIFICATIONS */}
              {activeDetailTab === "TIMELINE" && (
                <div className="space-y-4">
                  {/* Modifications History */}
                  <div>
                    <h5 className="font-bold text-stone-800 text-2xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-stone-500" />
                      Order Modifications & Price Amendments
                    </h5>
                    {orderDetails.modification_history && orderDetails.modification_history.length > 0 ? (
                      <div className="space-y-2">
                        {orderDetails.modification_history.map((mod) => (
                          <div
                            key={mod.id}
                            className="p-3 rounded-lg border border-stone-200 bg-white space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-stone-900 text-xs">
                                Total Changed: {formatCurrency(mod.previous_total)} →{" "}
                                {formatCurrency(mod.new_total)}
                              </span>
                              <span className="text-3xs text-stone-400">
                                {new Date(mod.created_at).toLocaleString("en-IN")}
                              </span>
                            </div>
                            <p className="text-stone-700 text-2xs">
                              <strong>Reason:</strong> {mod.modification_reason || mod.change_summary}
                            </p>
                            <p className="text-3xs text-stone-400">
                              Modified by {mod.modifier?.name || "Staff"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-stone-400 italic bg-stone-50 p-3 rounded-lg border border-stone-200/60">
                        No post-creation amendments recorded.
                      </p>
                    )}
                  </div>

                  {/* Lifecycle Status Timeline */}
                  <div>
                    <h5 className="font-bold text-stone-800 text-2xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-stone-500" />
                      Lifecycle Status Transitions
                    </h5>
                    {orderDetails.status_history && orderDetails.status_history.length > 0 ? (
                      <div className="space-y-2">
                        {orderDetails.status_history.map((sh) => (
                          <div
                            key={sh.id}
                            className="p-2.5 rounded-lg border border-stone-200/70 bg-stone-50 flex items-start justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-3xs font-semibold text-stone-500">
                                  {sh.from_status ? `${sh.from_status} → ` : ""}
                                </span>
                                <span className="font-bold text-stone-900 text-xs">{sh.to_status}</span>
                              </div>
                              {sh.note && <p className="text-stone-600 text-2xs mt-0.5">{sh.note}</p>}
                              <p className="text-3xs text-stone-400 mt-0.5">
                                {sh.user?.name ? `By ${sh.user.name}` : ""}
                              </p>
                            </div>
                            <span className="text-3xs text-stone-400 font-mono">
                              {new Date(sh.created_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-stone-400 italic">No status transition log.</p>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
        </DetailDrawer>
      )}

      {/* CREATE ORDER MODAL / WIZARD */}
      {isCreateOpen && (
        <FormDialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create New Craft Order"
          description="Support for multi-product orders, custom specifications, direct material costs, and variable advance."
          maxWidth="lg"
        >
          <form onSubmit={handleCreateOrderSubmit} className="space-y-4 text-xs">
            {createError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-2xs font-medium">{createError}</p>
              </div>
            )}

            {/* STEP 1: CUSTOMER IDENTIFICATION */}
            <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800 text-2xs uppercase tracking-wider">
                  Customer Profile
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomerMode("EXISTING")}
                    className={`px-2.5 py-1 rounded text-3xs font-semibold ${
                      customerMode === "EXISTING"
                        ? "bg-rose-700 text-white"
                        : "bg-white text-stone-600 border border-stone-200"
                    }`}
                  >
                    Select Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode("NEW")}
                    className={`px-2.5 py-1 rounded text-3xs font-semibold ${
                      customerMode === "NEW"
                        ? "bg-rose-700 text-white"
                        : "bg-white text-stone-600 border border-stone-200"
                    }`}
                  >
                    Create New Profile
                  </button>
                </div>
              </div>

              {customerMode === "EXISTING" ? (
                <div>
                  <label className="block text-2xs font-semibold text-stone-600 mb-1">
                    Select Customer *
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) =>
                      setSelectedCustomerId(e.target.value ? Number(e.target.value) : "")
                    }
                    required
                    className="w-full h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-xs focus:outline-rose-600"
                  >
                    <option value="">-- Choose verified client --</option>
                    {customerOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone}) - {c.city || "Alappuzha"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs font-semibold text-stone-600 mb-0.5">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      placeholder="e.g. Sandra Thomas"
                      className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs focus:outline-rose-600"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-stone-600 mb-0.5">
                      Phone Number (WhatsApp) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      placeholder="+91 98470 54321"
                      className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs focus:outline-rose-600"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-stone-600 mb-0.5">
                      Source Channel
                    </label>
                    <select
                      value={newCustChannel}
                      onChange={(e) => setNewCustChannel(e.target.value as any)}
                      className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs"
                    >
                      <option value="INSTAGRAM">Instagram DM</option>
                      <option value="WHATSAPP">WhatsApp Chat</option>
                      <option value="REFERRAL">Referral</option>
                      <option value="DIRECT">Direct Contact</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-stone-600 mb-0.5">
                      City / Delivery Location
                    </label>
                    <input
                      type="text"
                      value={newCustCity}
                      onChange={(e) => setNewCustCity(e.target.value)}
                      placeholder="Alappuzha, Kochi..."
                      className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: DYNAMIC MULTI-PRODUCT LINE ITEMS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800 text-2xs uppercase tracking-wider">
                  Product Items ({orderItems.length})
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOrderItems([
                        ...orderItems,
                        {
                          item_name: "",
                          item_type: "CUSTOM",
                          unit_price: 1000,
                          quantity: 1,
                          customization_details: "",
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-2xs font-semibold text-rose-700 hover:text-rose-800"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Item</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {orderItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-stone-200 bg-white space-y-2"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-5">
                        <label className="block text-3xs font-semibold text-stone-500 mb-0.5">
                          Item / Catalogue Offering *
                        </label>
                        <input
                          type="text"
                          required
                          value={item.item_name}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].item_name = e.target.value;
                            setOrderItems(updated);
                          }}
                          placeholder="e.g. 12x18 Acrylic Couple Plaque"
                          className="w-full h-8 rounded border border-stone-200 px-2 text-xs focus:outline-rose-600"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-3xs font-semibold text-stone-500 mb-0.5">
                          Catalogue Preset
                        </label>
                        <select
                          onChange={(e) => {
                            const prodId = Number(e.target.value);
                            const prod = catalogProducts.find((p) => p.id === prodId);
                            if (prod) {
                              const updated = [...orderItems];
                              updated[idx].product_id = prod.id;
                              updated[idx].item_name = prod.name;
                              updated[idx].unit_price = prod.base_price;
                              updated[idx].item_type = "CATALOG";
                              setOrderItems(updated);
                            }
                          }}
                          className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-3xs text-stone-600"
                        >
                          <option value="">-- Choose Catalogue --</option>
                          {catalogProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (₹{p.base_price})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-3xs font-semibold text-stone-500 mb-0.5">
                          Unit Price (₹) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={item.unit_price}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].unit_price = parseFloat(e.target.value) || 0;
                            setOrderItems(updated);
                          }}
                          className="w-full h-8 rounded border border-stone-200 px-2 text-xs font-semibold"
                        />
                      </div>

                      <div className="sm:col-span-2 flex items-center justify-between gap-1">
                        <div>
                          <label className="block text-3xs font-semibold text-stone-500 mb-0.5">
                            Qty *
                          </label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...orderItems];
                              updated[idx].quantity = parseInt(e.target.value) || 1;
                              setOrderItems(updated);
                            }}
                            className="w-full h-8 rounded border border-stone-200 px-2 text-xs font-bold text-center"
                          />
                        </div>
                        {orderItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setOrderItems(orderItems.filter((_, i) => i !== idx));
                            }}
                            className="text-stone-400 hover:text-red-700 mt-4"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={item.customization_details}
                        onChange={(e) => {
                          const updated = [...orderItems];
                          updated[idx].customization_details = e.target.value;
                          setOrderItems(updated);
                        }}
                        placeholder="Custom specifications (e.g., Anniversary date, matte archival glass, song code)..."
                        className="w-full h-7 rounded border border-stone-200 px-2 text-2xs text-stone-600"
                      />
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="number"
                          min="0"
                          value={item.direct_cost || ""}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].direct_cost = parseFloat(e.target.value) || undefined;
                            setOrderItems(updated);
                          }}
                          placeholder="Direct material cost (₹ optional)..."
                          className="flex-1 h-7 rounded border border-stone-200 px-2 text-2xs text-stone-500"
                        />
                        <select
                          value={item.cost_type || "RAW_MATERIAL"}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].cost_type = e.target.value as any;
                            setOrderItems(updated);
                          }}
                          className="h-7 rounded border border-stone-200 bg-white px-1.5 text-3xs text-stone-500"
                        >
                          <option value="RAW_MATERIAL">Material</option>
                          <option value="PRINT">Print</option>
                          <option value="FRAME">Frame</option>
                          <option value="PACKAGING">Pack</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* STEP 3: FINANCIAL BREAKDOWN */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-stone-50 p-3 rounded-lg border border-stone-200">
              <div>
                <label className="block text-3xs font-semibold text-stone-500 uppercase mb-0.5">
                  Shipping Charge (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={orderDeliveryCharge}
                  onChange={(e) => setOrderDeliveryCharge(e.target.value)}
                  className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-3xs font-semibold text-stone-500 uppercase mb-0.5">
                  Discount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={orderDiscount}
                  onChange={(e) => setOrderDiscount(e.target.value)}
                  className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-3xs font-semibold text-stone-500 uppercase mb-0.5">
                  Advance Required (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={orderAdvanceReq}
                  onChange={(e) => setOrderAdvanceReq(e.target.value)}
                  className="w-full h-8 rounded border border-rose-300 bg-white px-2 text-xs font-bold text-rose-800"
                />
              </div>
              <div>
                <label className="block text-3xs font-semibold text-stone-500 uppercase mb-0.5">
                  Target Delivery Date
                </label>
                <input
                  type="date"
                  value={orderTargetDate}
                  onChange={(e) => setOrderTargetDate(e.target.value)}
                  className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs"
                />
              </div>
            </div>

            {/* Calculated Grand Total */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-stone-100 border border-stone-200/80">
              <span className="font-bold text-stone-800 text-xs">
                Calculated Total Order Amount
              </span>
              <span className="font-mono text-base font-bold text-rose-900">
                {formatCurrency(calcTotal)}
              </span>
            </div>

            {/* Optional Immediate Advance Payment */}
            <div className="rounded-lg border border-stone-200 p-3 bg-stone-50 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="record_adv_toggle"
                  checked={recordAdvanceNow}
                  onChange={(e) => setRecordAdvanceNow(e.target.checked)}
                  className="rounded border-stone-300 text-rose-700"
                />
                <label htmlFor="record_adv_toggle" className="font-semibold text-stone-800 text-2xs cursor-pointer">
                  Client has already paid advance (Auto-confirms order now)
                </label>
              </div>

              {recordAdvanceNow && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-3xs font-semibold text-stone-500 mb-0.5">
                      Advance Paid (₹) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required={recordAdvanceNow}
                      value={directAdvanceAmount}
                      onChange={(e) => setDirectAdvanceAmount(e.target.value)}
                      className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs font-bold text-emerald-800"
                    />
                  </div>
                  <div>
                    <label className="block text-3xs font-semibold text-stone-500 mb-0.5">
                      Method
                    </label>
                    <select
                      value={directAdvanceMethod}
                      onChange={(e) => setDirectAdvanceMethod(e.target.value as PaymentMethod)}
                      className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs"
                    >
                      <option value="UPI">UPI (GooglePay / PhonePe / Paytm)</option>
                      <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                      <option value="CASH">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-3xs font-semibold text-stone-500 mb-0.5">
                      Transaction UTR (Optional for Cash)
                    </label>
                    <input
                      type="text"
                      value={directAdvanceRef}
                      onChange={(e) => setDirectAdvanceRef(e.target.value)}
                      placeholder="e.g. 123456789012"
                      className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-3xs font-semibold text-stone-500 uppercase mb-0.5">
                Internal Studio Notes
              </label>
              <textarea
                rows={2}
                value={orderInternalNotes}
                onChange={(e) => setOrderInternalNotes(e.target.value)}
                placeholder="Gift packaging requirements, recipient details, pickup notes..."
                className="w-full rounded border border-stone-200 p-2 text-xs focus:outline-rose-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-stone-700 hover:bg-stone-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createOrderMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-4 py-1.5 text-white font-semibold hover:bg-rose-800 disabled:opacity-50"
              >
                {createOrderMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>Generate Official Order</span>
              </button>
            </div>
          </form>
        </FormDialog>
      )}

      {/* RECORD PAYMENT MODAL */}
      {isPaymentOpen && orderDetails && (
        <FormDialog
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          title={`Record Payment for Order ${orderDetails.order_number}`}
          description={`Outstanding Balance: ${formatCurrency(orderDetails.balance_amount)}`}
          maxWidth="sm"
        >
          <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-xs">
            {payError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-2xs font-medium">{payError}</p>
              </div>
            )}

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Payment Type *
              </label>
              <select
                value={payType}
                onChange={(e) => setPayType(e.target.value as any)}
                className="w-full h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-xs focus:outline-rose-600"
              >
                <option value="ADVANCE">Advance Payment</option>
                <option value="PARTIAL">Partial Payment</option>
                <option value="BALANCE_FINAL">Final Settlement Balance</option>
                <option value="ADDITIONAL">Additional / Surplus Payment</option>
              </select>
            </div>

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Amount (₹ INR) *
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="1000"
                className="w-full h-9 rounded-lg border border-rose-300 px-3 text-xs font-bold text-rose-800 focus:outline-rose-600"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Payment Method *
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                className="w-full h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-xs focus:outline-rose-600"
              >
                <option value="UPI">UPI (GooglePay / PhonePe / Paytm)</option>
                <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                <option value="CASH">Cash</option>
              </select>
            </div>

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Transaction Reference (UTR) {payMethod === "CASH" ? "(Optional)" : "*"}
              </label>
              <input
                type="text"
                required={payMethod !== "CASH"}
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder={payMethod === "CASH" ? "Optional receipt / voucher #" : "12-digit UTR reference"}
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs font-mono focus:outline-rose-600"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Payment Notes
              </label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Paid by brother, screen confirmed on WhatsApp..."
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs focus:outline-rose-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsPaymentOpen(false)}
                className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-stone-700 hover:bg-stone-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recordPaymentMutation.isPending || !payAmount}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-4 py-1.5 text-white font-semibold hover:bg-rose-800 disabled:opacity-50"
              >
                {recordPaymentMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>Record Receipt</span>
              </button>
            </div>
          </form>
        </FormDialog>
      )}

      {/* PROCESS REFUND MODAL */}
      {isRefundOpen && orderDetails && (
        <FormDialog
          isOpen={isRefundOpen}
          onClose={() => setIsRefundOpen(false)}
          title={`Process Refund: Order ${orderDetails.order_number}`}
          description={`Maximum Eligible Refundable Amount: ${formatCurrency(orderDetails.total_paid)}`}
          maxWidth="sm"
        >
          <form onSubmit={handleProcessRefundSubmit} className="space-y-4 text-xs">
            {refundError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-2xs font-medium">{refundError}</p>
              </div>
            )}

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Refund Amount (₹ INR) *
              </label>
              <input
                type="number"
                min="0.01"
                max={orderDetails.total_paid}
                step="0.01"
                required
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="500"
                className="w-full h-9 rounded-lg border border-amber-300 px-3 text-xs font-bold text-amber-900 focus:outline-rose-600"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Refund Method *
              </label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as PaymentMethod)}
                className="w-full h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-xs focus:outline-rose-600"
              >
                <option value="UPI">UPI Refund</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash Refund</option>
              </select>
            </div>

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Reason for Refund *
              </label>
              <input
                type="text"
                required
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Client downsized frame size, or canceled order item"
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs focus:outline-rose-600"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Refund Reference / UTR
              </label>
              <input
                type="text"
                value={refundRef}
                onChange={(e) => setRefundRef(e.target.value)}
                placeholder="UPI reverse transaction ID"
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs font-mono focus:outline-rose-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsRefundOpen(false)}
                className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-stone-700 hover:bg-stone-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processRefundMutation.isPending || !refundAmount}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-4 py-1.5 text-white font-semibold hover:bg-amber-800 disabled:opacity-50"
              >
                {processRefundMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>Authorize Refund</span>
              </button>
            </div>
          </form>
        </FormDialog>
      )}

      {/* MODIFY ORDER & AMENDMENTS MODAL */}
      {isModifyOpen && orderDetails && (
        <FormDialog
          isOpen={isModifyOpen}
          onClose={() => setIsModifyOpen(false)}
          title={`Modify Order ${orderDetails.order_number}`}
          description="Amend line items, prices, discounts, or delivery fees. All changes are logged to Order Modification History."
          maxWidth="lg"
        >
          <form onSubmit={handleExecuteModify} className="space-y-4 text-xs">
            {modifyError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-2xs font-medium">{modifyError}</p>
              </div>
            )}

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Modification Reason (Mandatory for Audit Trail) *
              </label>
              <input
                type="text"
                required
                value={modifyReason}
                onChange={(e) => setModifyReason(e.target.value)}
                placeholder="e.g. Client requested upgrade to gold leaf frame and added mini keychain"
                className="w-full h-9 rounded-lg border border-rose-300 px-3 text-xs focus:outline-rose-600"
              />
            </div>

            {/* Line Items Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800 text-2xs uppercase tracking-wider">
                  Amended Line Items ({orderItems.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setOrderItems([
                      ...orderItems,
                      {
                        item_name: "",
                        item_type: "CUSTOM",
                        unit_price: 500,
                        quantity: 1,
                        customization_details: "",
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 text-2xs font-semibold text-rose-700 hover:text-rose-800"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-stone-200 bg-white space-y-1.5">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-6">
                        <label className="block text-3xs font-semibold text-stone-500 mb-0.5">
                          Item Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={item.item_name}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].item_name = e.target.value;
                            setOrderItems(updated);
                          }}
                          className="w-full h-8 rounded border border-stone-200 px-2 text-xs focus:outline-rose-600"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-3xs font-semibold text-stone-500 mb-0.5">
                          Unit Price (₹) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].unit_price = parseFloat(e.target.value) || 0;
                            setOrderItems(updated);
                          }}
                          className="w-full h-8 rounded border border-stone-200 px-2 text-xs font-semibold"
                        />
                      </div>
                      <div className="sm:col-span-3 flex items-center justify-between gap-1">
                        <div>
                          <label className="block text-3xs font-semibold text-stone-500 mb-0.5">
                            Qty *
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...orderItems];
                              updated[idx].quantity = parseInt(e.target.value) || 1;
                              setOrderItems(updated);
                            }}
                            className="w-full h-8 rounded border border-stone-200 px-2 text-xs font-bold text-center"
                          />
                        </div>
                        {orderItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}
                            className="text-stone-400 hover:text-red-700 mt-3"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <input
                        type="text"
                        value={item.customization_details}
                        onChange={(e) => {
                          const updated = [...orderItems];
                          updated[idx].customization_details = e.target.value;
                          setOrderItems(updated);
                        }}
                        placeholder="Custom specifications..."
                        className="w-full h-7 rounded border border-stone-200 px-2 text-2xs text-stone-600"
                      />
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.direct_cost || ""}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].direct_cost = parseFloat(e.target.value) || undefined;
                            setOrderItems(updated);
                          }}
                          placeholder="Direct material cost (₹ optional)..."
                          className="flex-1 h-7 rounded border border-stone-200 px-2 text-2xs text-stone-500"
                        />
                        <select
                          value={item.cost_type || "RAW_MATERIAL"}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].cost_type = e.target.value as any;
                            setOrderItems(updated);
                          }}
                          className="h-7 rounded border border-stone-200 bg-white px-1.5 text-3xs text-stone-500"
                        >
                          <option value="RAW_MATERIAL">Material</option>
                          <option value="PRINT">Print</option>
                          <option value="FRAME">Frame</option>
                          <option value="PACKAGING">Pack</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 p-3 rounded-lg border border-stone-200">
              <div>
                <label className="block text-3xs font-semibold text-stone-500 uppercase mb-0.5">
                  Shipping (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={orderDeliveryCharge}
                  onChange={(e) => setOrderDeliveryCharge(e.target.value)}
                  className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-3xs font-semibold text-stone-500 uppercase mb-0.5">
                  Discount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={orderDiscount}
                  onChange={(e) => setOrderDiscount(e.target.value)}
                  className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-3xs font-semibold text-stone-500 uppercase mb-0.5">
                  Advance Required (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={orderAdvanceReq}
                  onChange={(e) => setOrderAdvanceReq(e.target.value)}
                  className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs font-bold text-rose-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-stone-100 font-bold text-stone-900 text-xs">
              <span>Amended Total Amount:</span>
              <span className="text-base text-rose-900">{formatCurrency(calcTotal)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsModifyOpen(false)}
                className="rounded-xl border border-[#E7E1D8] px-3.5 py-1.5 text-[#34312F] hover:bg-[#F7F4F0] font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modifyOrderMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#34312F] px-4 py-1.5 text-white font-semibold hover:bg-[#1F1D1C] disabled:opacity-50"
              >
                {modifyOrderMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>Save Modifications</span>
              </button>
            </div>
          </form>
        </FormDialog>
      )}

      {/* CANCEL ORDER CONFIRMATION DIALOG */}
      <ConfirmationDialog
        isOpen={!!orderToCancel}
        onClose={() => setOrderToCancel(null)}
        onConfirm={() => {
          if (orderToCancel) {
            statusChangeMutation.mutate({
              orderId: orderToCancel.id,
              status: "CANCELLED",
              note: "Order cancelled by studio operator",
            });
          }
        }}
        title={orderToCancel ? `Cancel Order ${orderToCancel.order_number}?` : "Cancel Order"}
        message="Cancelling removes this order from active revenue and production tracking while keeping payment and refund audit records intact."
        confirmText={statusChangeMutation.isPending ? "Cancelling..." : "Confirm Cancellation"}
        variant="danger"
      />
    </div>
  );
}
