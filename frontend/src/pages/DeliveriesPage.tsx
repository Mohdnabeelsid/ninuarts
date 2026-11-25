import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Edit,
  Send,
  Copy,
  Phone,
  AlertCircle,
  Eye,
  MapPin,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { DataTable, Column } from "../components/shared/DataTable";
import { SearchInput } from "../components/shared/SearchInput";
import { FilterDropdown } from "../components/shared/FilterDropdown";
import { FormDialog } from "../components/shared/FormDialog";
import { DetailDrawer } from "../components/shared/DetailDrawer";
import { StatCard } from "../components/shared/StatCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { LoadingState } from "../components/shared/LoadingState";
import { ErrorState } from "../components/shared/ErrorState";
import { EmptyState } from "../components/shared/EmptyState";
import { formatCurrency, formatDate, getApiErrorMessage } from "../lib/utils";
import { apiClient } from "../lib/api";
import { Delivery, DeliveryStatus, Order } from "../types";
import { useDashboardSearch } from "../layouts/DashboardLayout";

export function DeliveriesPage() {
  const queryClient = useQueryClient();
  const globalSearch = useDashboardSearch();

  // Filters state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);

  // Modal dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [viewingDelivery, setViewingDelivery] = useState<Delivery | null>(null);
  const [updatingStatusDelivery, setUpdatingStatusDelivery] = useState<Delivery | null>(null);
  const [templateDelivery, setTemplateDelivery] = useState<Delivery | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [formError, setFormError] = useState("");

  // Create/Edit Form State
  const [formOrderId, setFormOrderId] = useState<string>("");
  const [formDeliveryType, setFormDeliveryType] = useState<"COURIER" | "LOCAL_DELIVERY">("COURIER");
  const [formRecipient, setFormRecipient] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCourier, setFormCourier] = useState("DTDC");
  const [formTracking, setFormTracking] = useState("");
  const [formShippingCharge, setFormShippingCharge] = useState("");
  const [formDispatchDate, setFormDispatchDate] = useState("");
  const [formEstDate, setFormEstDate] = useState("");
  const [formStatus, setFormStatus] = useState<DeliveryStatus>("READY_FOR_DISPATCH");
  const [formNotes, setFormNotes] = useState("");
  const [formDelayReason, setFormDelayReason] = useState("");

  // Status Update Dialog State
  const [newStatus, setNewStatus] = useState<DeliveryStatus>("DELIVERED");
  const [actualDeliveredDate, setActualDeliveredDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [statusDelayReason, setStatusDelayReason] = useState("");
  const [statusNotes, setStatusNotes] = useState("");

  // 1. Fetch Orders for Order Picker
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["orders-picker"],
    queryFn: async () => {
      const res = await apiClient.get("/orders?per_page=50");
      return res.data?.data || [];
    },
  });

  // 2. Fetch Deliveries
  const effectiveSearch = search || globalSearch;
  const { data: deliveryData, isLoading, isError, refetch } = useQuery({
    queryKey: ["deliveries", { effectiveSearch, statusFilter, typeFilter, isOverdueOnly }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveSearch) params.append("search", effectiveSearch);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (typeFilter !== "ALL") params.append("delivery_type", typeFilter);
      if (isOverdueOnly) params.append("is_overdue", "true");
      params.append("per_page", "50");

      const res = await apiClient.get(`/deliveries?${params.toString()}`);
      return {
        deliveries: (res.data?.data || []) as Delivery[],
        summary: res.data?.meta?.summary || {
          total: 0,
          pending: 0,
          ready_for_dispatch: 0,
          dispatched: 0,
          in_transit: 0,
          delivered: 0,
          overdue: 0,
        },
      };
    },
  });

  const deliveries = deliveryData?.deliveries || [];
  const summary = deliveryData?.summary || {
    total: 0,
    pending: 0,
    ready_for_dispatch: 0,
    dispatched: 0,
    in_transit: 0,
    delivered: 0,
    overdue: 0,
  };

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.post("/deliveries", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      closeCreate();
    },
    onError: (err: any) => {
      setFormError(getApiErrorMessage(err, "Failed to create delivery."));
    },
  });

  // Update Details Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      return apiClient.put(`/deliveries/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      closeCreate();
    },
    onError: (err: any) => {
      setFormError(getApiErrorMessage(err, "Failed to update delivery."));
    },
  });

  // Status Change Mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      return apiClient.patch(`/deliveries/${id}/status`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setUpdatingStatusDelivery(null);
    },
  });

  // Dispatch Template Query
  const { data: dispatchTemplate, isFetching: isTemplateLoading } = useQuery({
    queryKey: ["dispatch-template", templateDelivery?.id],
    queryFn: async () => {
      if (!templateDelivery) return null;
      const res = await apiClient.post(`/deliveries/${templateDelivery.id}/dispatch-template`);
      return res.data?.data || null;
    },
    enabled: !!templateDelivery,
  });

  const openCreate = () => {
    setEditingDelivery(null);
    setFormOrderId("");
    setFormDeliveryType("COURIER");
    setFormRecipient("");
    setFormPhone("");
    setFormAddress("");
    setFormCourier("DTDC");
    setFormTracking("");
    setFormShippingCharge("");
    setFormDispatchDate(new Date().toISOString().split("T")[0]);
    setFormEstDate("");
    setFormStatus("READY_FOR_DISPATCH");
    setFormNotes("");
    setFormDelayReason("");
    setFormError("");
    setIsCreateOpen(true);
  };

  const openEdit = (d: Delivery) => {
    setEditingDelivery(d);
    setFormOrderId(d.order_id.toString());
    setFormDeliveryType(d.delivery_type);
    setFormRecipient(d.recipient_name || d.order?.customer?.name || "");
    setFormPhone(d.recipient_phone || d.order?.customer?.phone || "");
    setFormAddress(d.delivery_address || d.order?.customer?.delivery_address || "");
    setFormCourier(d.courier_partner || "DTDC");
    setFormTracking(d.tracking_number || "");
    setFormShippingCharge(d.shipping_charge ? d.shipping_charge.toString() : "");
    setFormDispatchDate(d.dispatch_date ? d.dispatch_date.split("T")[0] : "");
    setFormEstDate(d.estimated_delivery_date ? d.estimated_delivery_date.split("T")[0] : "");
    setFormStatus(d.status);
    setFormNotes(d.delivery_notes || "");
    setFormDelayReason(d.delay_reason || "");
    setFormError("");
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    setIsCreateOpen(false);
    setEditingDelivery(null);
    setFormError("");
  };

  // Auto-fill recipient when order is selected
  const handleOrderSelect = (orderIdStr: string) => {
    setFormOrderId(orderIdStr);
    const selected = orders.find((o) => o.id.toString() === orderIdStr);
    if (selected && selected.customer) {
      setFormRecipient(selected.customer.name);
      setFormPhone(selected.customer.phone);
      setFormAddress(selected.customer.delivery_address || selected.customer.city);
      setFormShippingCharge(selected.delivery_charge ? selected.delivery_charge.toString() : "0");
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formOrderId) {
      setFormError("Please select an Order.");
      return;
    }

    const payload = {
      order_id: parseInt(formOrderId, 10),
      delivery_type: formDeliveryType,
      recipient_name: formRecipient.trim() || null,
      recipient_phone: formPhone.trim() || null,
      delivery_address: formAddress.trim() || null,
      courier_partner: formCourier.trim() || null,
      tracking_number: formTracking.trim() || null,
      shipping_charge: formShippingCharge ? parseFloat(formShippingCharge) : 0,
      dispatch_date: formDispatchDate || null,
      estimated_delivery_date: formEstDate || null,
      delivery_notes: formNotes.trim() || null,
      delay_reason: formDelayReason.trim() || null,
      status: formStatus,
    };

    if (editingDelivery) {
      updateMutation.mutate({ id: editingDelivery.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingStatusDelivery) return;

    statusMutation.mutate({
      id: updatingStatusDelivery.id,
      payload: {
        status: newStatus,
        actual_delivery_date: newStatus === "DELIVERED" ? actualDeliveredDate : null,
        delay_reason: statusDelayReason.trim() || null,
        notes: statusNotes.trim() || null,
      },
    });
  };

  const copyTemplateToClipboard = () => {
    if (dispatchTemplate?.template_text) {
      navigator.clipboard.writeText(dispatchTemplate.template_text);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    }
  };

  // Table Columns
  const columns: Column<Delivery>[] = [
    {
      header: "Order & Recipient",
      cell: (d: Delivery) => (
        <div className="flex flex-col">
          <span className="font-mono font-medium text-[#34312F] text-xs">
            {d.order?.order_number || `#ORD-${d.order_id}`}
          </span>
          <span className="font-medium text-[#6B635B] text-xs mt-0.5">
            {d.recipient_name || d.order?.customer?.name || "Customer"}
          </span>
          <span className="text-[10px] text-[#817872] flex items-center gap-1">
            <Phone className="w-2.5 h-2.5" />
            {d.recipient_phone || d.order?.customer?.phone}
          </span>
        </div>
      ),
    },
    {
      header: "Logistics & Partner",
      cell: (d: Delivery) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 font-medium text-[#34312F] text-xs">
            <Truck className="w-3.5 h-3.5 text-[#817872]" />
            {d.courier_partner || (d.delivery_type === "LOCAL_DELIVERY" ? "Local Courier" : "Standard Courier")}
          </div>
          {d.tracking_number ? (
            <span className="font-mono text-[10px] text-[#34312F] bg-[#F7F4F0] px-1.5 py-0.5 rounded-md border border-[#E7E1D8] mt-0.5 w-fit">
              AWB: {d.tracking_number}
            </span>
          ) : (
            <span className="text-[10px] text-[#817872]/60 italic">No tracking number</span>
          )}
        </div>
      ),
    },
    {
      header: "Timeline & Dates",
      cell: (d: Delivery) => (
        <div className="flex flex-col text-xs">
          <div className="flex items-center gap-1 text-[#6B635B]">
            <Clock className="w-3 h-3 text-[#817872]" />
            <span>Est: {d.estimated_delivery_date ? formatDate(d.estimated_delivery_date) : "Pending"}</span>
          </div>
          {d.is_overdue && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#8F352A] bg-[#FAECEB] border border-[#F2D0CE] px-1.5 py-0.5 rounded-full mt-0.5 w-fit">
              <AlertTriangle className="w-3 h-3 text-[#C96A5B]" /> {d.days_overdue} days overdue
            </span>
          )}
          {d.delivered_date && (
            <span className="text-[10px] text-[#475E42] font-medium mt-0.5">
              Delivered: {formatDate(d.delivered_date)}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      cell: (d: Delivery) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={d.status} size="sm" />
          {d.delay_reason && (
            <span className="text-[10px] text-[#817872] italic max-w-xs truncate" title={d.delay_reason}>
              Reason: {d.delay_reason}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (d: Delivery) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setViewingDelivery(d)}
            className="p-1.5 text-[#817872] hover:text-[#34312F] hover:bg-[#F7F4F0] rounded-lg transition-colors"
            title="Inspect Shipment"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setTemplateDelivery(d);
              setCopiedMessage(false);
            }}
            className="p-1.5 text-[#817872] hover:text-[#7A4B43] hover:bg-[#F5ECE9] rounded-lg transition-colors"
            title="Prepare Dispatch Message"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setUpdatingStatusDelivery(d);
              setNewStatus("DELIVERED");
              setStatusDelayReason(d.delay_reason || "");
              setStatusNotes("");
            }}
            className="p-1.5 text-[#817872] hover:text-[#475E42] hover:bg-[#EAF0E8] rounded-lg transition-colors"
            title="Quick Status Update"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => openEdit(d)}
            className="p-1.5 text-[#817872] hover:text-[#34312F] hover:bg-[#F7F4F0] rounded-lg transition-colors"
            title="Edit Shipment Details"
          >
            <Edit className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Delivery & Logistics"
        description="Courier tracking, local delivery routing, overdue shipment monitoring, and manual dispatch notification drafting."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#34312F] hover:bg-[#1F1D1C] text-white rounded-xl text-xs font-medium shadow-soft transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Shipment
          </button>
        }
      />

      {/* Overdue Shipments Alert Banner */}
      {summary.overdue > 0 && (
        <div className="p-4.5 rounded-2xl bg-[#FAECEB]/90 border border-[#F2D0CE] flex items-center justify-between shadow-card">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#F2D0CE] text-[#8F352A]">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8F352A]">
                {summary.overdue} Delivery {summary.overdue === 1 ? "Shipment is" : "Shipments are"} Overdue
              </h4>
              <p className="text-xs text-[#6B2A21] mt-0.5 leading-relaxed">
                Expected delivery dates have passed without confirmation of arrival. Follow up with couriers or update delay reasons.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOverdueOnly(!isOverdueOnly)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors shadow-soft ${
              isOverdueOnly
                ? "bg-[#8F352A] text-white"
                : "bg-white text-[#8F352A] border border-[#F2D0CE] hover:bg-[#FAECEB]"
            }`}
          >
            {isOverdueOnly ? "Showing Overdue" : "Filter Overdue"}
          </button>
        </div>
      )}

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Active Deliveries"
          value={(summary.ready_for_dispatch + summary.dispatched + summary.in_transit).toString()}
          icon={Truck}
          highlight={true}
          subtitle="Orders in fulfillment pipeline"
        />
        <StatCard
          title="In Transit"
          value={summary.in_transit.toString()}
          icon={Package}
          subtitle="With courier partners"
        />
        <StatCard
          title="Delivered Successfully"
          value={summary.delivered.toString()}
          icon={CheckCircle2}
          subtitle="Verified client handovers"
        />
        <StatCard
          title="Overdue Shipments"
          value={summary.overdue.toString()}
          icon={AlertTriangle}
          trend={
            summary.overdue > 0
              ? { value: summary.overdue, direction: "up", label: "Requires attention" }
              : undefined
          }
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-[#E7E1D8] shadow-card flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by order number, recipient, tracking no, or courier..."
          />
        </div>

        <div className="w-44">
          <FilterDropdown
            label="Shipment Status"
            selectedValue={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "ALL", label: "All Statuses" },
              { value: "READY_FOR_DISPATCH", label: "Ready for Dispatch" },
              { value: "DISPATCHED", label: "Dispatched" },
              { value: "IN_TRANSIT", label: "In Transit" },
              { value: "DELIVERED", label: "Delivered" },
              { value: "DELIVERY_FAILED", label: "Failed" },
              { value: "RETURNED", label: "Returned" },
            ]}
          />
        </div>

        <div className="w-40">
          <FilterDropdown
            label="Delivery Type"
            selectedValue={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: "ALL", label: "All Types" },
              { value: "COURIER", label: "Courier Partner" },
              { value: "LOCAL_DELIVERY", label: "Local Delivery" },
            ]}
          />
        </div>

        {(search || statusFilter !== "ALL" || typeFilter !== "ALL" || isOverdueOnly) && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("ALL");
              setTypeFilter("ALL");
              setIsOverdueOnly(false);
            }}
            className="text-xs font-medium text-[#34312F] hover:text-[#817872] px-2 py-1 transition-colors"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Deliveries Table */}
      {isLoading ? (
        <LoadingState message="Loading delivery shipments..." />
      ) : isError ? (
        <ErrorState message="Failed to load deliveries." onRetry={() => refetch()} />
      ) : deliveries.length === 0 ? (
        <EmptyState
          title="No shipments found"
          message="Prepare shipments for confirmed orders, generate tracking numbers, and manage dispatches."
          actionText="Create First Shipment"
          onAction={openCreate}
        />
      ) : (
        <DataTable data={deliveries} columns={columns} onRowClick={(row) => setViewingDelivery(row)} />
      )}

      {/* View Delivery Details Drawer */}
      <DetailDrawer
        isOpen={!!viewingDelivery}
        onClose={() => setViewingDelivery(null)}
        title={viewingDelivery ? `Shipment #${viewingDelivery.id}` : "Shipment Details"}
        subtitle={viewingDelivery?.order?.order_number}
        badge={viewingDelivery && <StatusBadge status={viewingDelivery.status} size="sm" />}
        footer={
          viewingDelivery && (
            <>
              <button
                type="button"
                onClick={() => {
                  const d = viewingDelivery;
                  setViewingDelivery(null);
                  openEdit(d);
                }}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-[#E7E1D8] text-[#34312F] hover:bg-[#F7F4F0] transition-colors"
              >
                Edit Shipment
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = viewingDelivery;
                  setViewingDelivery(null);
                  setTemplateDelivery(d);
                }}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-[#34312F] text-white hover:bg-[#1F1D1C] transition-colors shadow-soft"
              >
                Dispatch Message
              </button>
            </>
          )
        }
      >
        {viewingDelivery && (
          <div className="space-y-6">
            <div className="p-4.5 rounded-2xl bg-[#F7F4F0] border border-[#E7E1D8]">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-[#817872]">
                Recipient Details
              </span>
              <div className="font-serif text-xl text-[#34312F] mt-1">
                {viewingDelivery.recipient_name || viewingDelivery.order?.customer?.name}
              </div>
              <div className="text-xs text-[#6B635B] mt-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#817872]" />
                {viewingDelivery.recipient_phone || viewingDelivery.order?.customer?.phone || "No phone provided"}
              </div>
              <div className="text-xs text-[#6B635B] mt-2 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#817872] shrink-0 mt-0.5" />
                <span>{viewingDelivery.delivery_address || viewingDelivery.order?.customer?.delivery_address || "Alappuzha, Kerala"}</span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Courier / Partner</span>
                <span className="font-medium text-[#34312F]">{viewingDelivery.courier_partner || "Standard"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Tracking Number (AWB)</span>
                <span className="font-mono font-medium text-[#34312F]">{viewingDelivery.tracking_number || "Not assigned"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Shipping Charge</span>
                <span className="font-serif text-[#34312F]">{formatCurrency(viewingDelivery.shipping_charge ?? 0)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Dispatch Date</span>
                <span className="font-medium text-[#34312F]">{viewingDelivery.dispatch_date ? formatDate(viewingDelivery.dispatch_date) : "Pending"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Expected Target Arrival</span>
                <span className="font-medium text-[#34312F]">{viewingDelivery.estimated_delivery_date ? formatDate(viewingDelivery.estimated_delivery_date) : "Pending"}</span>
              </div>
              {viewingDelivery.delivered_date && (
                <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                  <span className="text-[#817872]">Actual Handover Date</span>
                  <span className="font-medium text-[#475E42]">{formatDate(viewingDelivery.delivered_date)}</span>
                </div>
              )}
              {viewingDelivery.delay_reason && (
                <div className="pt-2">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-[#8F352A] block mb-1">
                    Delay Note
                  </span>
                  <p className="p-3 rounded-xl bg-[#FAECEB] text-[#8F352A] border border-[#F2D0CE]">
                    {viewingDelivery.delay_reason}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Create / Edit Shipment Dialog */}
      <FormDialog
        isOpen={isCreateOpen}
        onClose={closeCreate}
        title={editingDelivery ? `Edit Shipment #${editingDelivery.id}` : "Create Delivery Shipment"}
        maxWidth="lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && (
            <div className="p-3.5 rounded-xl bg-[#FAECEB] text-[#8F352A] text-xs flex items-center gap-2 border border-[#F2D0CE]">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#8F352A]" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Order Selection */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Order <span className="text-[#8F352A]">*</span>
              </label>
              <select
                value={formOrderId}
                onChange={(e) => handleOrderSelect(e.target.value)}
                disabled={!!editingDelivery}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white focus:outline-[#34312F] font-mono text-[#34312F] disabled:bg-[#F7F4F0]"
                required
              >
                <option value="">-- Select Order --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order_number} ({o.customer?.name || "Customer"}) — ₹{o.total_amount}
                  </option>
                ))}
              </select>
            </div>

            {/* Delivery Type */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Delivery Mode <span className="text-[#8F352A]">*</span>
              </label>
              <select
                value={formDeliveryType}
                onChange={(e) => setFormDeliveryType(e.target.value as "COURIER" | "LOCAL_DELIVERY")}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white focus:outline-[#34312F] font-medium text-[#34312F]"
                required
              >
                <option value="COURIER">Courier Partner (Speed Post, DTDC, Professional)</option>
                <option value="LOCAL_DELIVERY">Local Delivery / Studio Handover (Alappuzha)</option>
              </select>
            </div>

            {/* Recipient Name */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Recipient Name <span className="text-[#8F352A]">*</span>
              </label>
              <input
                type="text"
                value={formRecipient}
                onChange={(e) => setFormRecipient(e.target.value)}
                placeholder="Client recipient full name"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
                required
              />
            </div>

            {/* Recipient Phone */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Recipient Contact Phone <span className="text-[#8F352A]">*</span>
              </label>
              <input
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
                required
              />
            </div>
          </div>

          {/* Delivery Address */}
          <div>
            <label className="block text-xs font-medium text-[#34312F] mb-1.5">
              Full Destination Address <span className="text-[#8F352A]">*</span>
            </label>
            <textarea
              rows={2}
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder="House name, street, landmarks, PIN code..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Courier Partner */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Courier Partner
              </label>
              <input
                type="text"
                value={formCourier}
                onChange={(e) => setFormCourier(e.target.value)}
                placeholder="e.g. DTDC, India Post, Professional"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>

            {/* Tracking Number */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Tracking Number (AWB / Consignment)
              </label>
              <input
                type="text"
                value={formTracking}
                onChange={(e) => setFormTracking(e.target.value)}
                placeholder="e.g. D12345678"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F] font-mono"
              />
            </div>

            {/* Shipping Charge */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Shipping Fee (₹ INR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formShippingCharge}
                onChange={(e) => setFormShippingCharge(e.target.value)}
                placeholder="100.00"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F] font-serif"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Dispatch Date */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Dispatch Date
              </label>
              <input
                type="date"
                value={formDispatchDate}
                onChange={(e) => setFormDispatchDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F] text-[#34312F]"
              />
            </div>

            {/* Estimated Delivery Date */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Target Arrival Date
              </label>
              <input
                type="date"
                value={formEstDate}
                onChange={(e) => setFormEstDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F] text-[#34312F]"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Current State <span className="text-[#8F352A]">*</span>
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as DeliveryStatus)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white focus:outline-[#34312F] font-medium text-[#34312F]"
                required
              >
                <option value="READY_FOR_DISPATCH">Ready for Dispatch</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="DELIVERED">Delivered</option>
                <option value="DELIVERY_FAILED">Delivery Failed</option>
                <option value="RETURNED">Returned</option>
              </select>
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-xs font-medium text-[#34312F] mb-1.5">
              Fulfillment Remarks
            </label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="e.g. Fragile glass packing, bubble wrap double layer..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F0ECE7]">
            <button
              type="button"
              onClick={closeCreate}
              className="px-4 py-2 text-xs font-medium text-[#6B635B] hover:text-[#34312F] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4.5 py-2 bg-[#34312F] hover:bg-[#1F1D1C] text-white rounded-xl text-xs font-medium shadow-soft disabled:opacity-50 transition-colors"
            >
              {editingDelivery
                ? updateMutation.isPending
                  ? "Saving..."
                  : "Update Shipment"
                : createMutation.isPending
                ? "Creating..."
                : "Confirm Shipment"}
            </button>
          </div>
        </form>
      </FormDialog>

      {/* Quick Status Update Dialog */}
      {updatingStatusDelivery && (
        <FormDialog
          isOpen={!!updatingStatusDelivery}
          onClose={() => setUpdatingStatusDelivery(null)}
          title={`Update Status: Order #${updatingStatusDelivery.order?.order_number}`}
          maxWidth="sm"
        >
          <form onSubmit={handleStatusSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                New Delivery Status <span className="text-[#8F352A]">*</span>
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as DeliveryStatus)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white focus:outline-[#34312F] font-medium text-[#34312F]"
                required
              >
                <option value="READY_FOR_DISPATCH">Ready for Dispatch</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="DELIVERED">Delivered (Handover Complete)</option>
                <option value="DELIVERY_FAILED">Delivery Failed</option>
                <option value="RETURNED">Returned</option>
              </select>
            </div>

            {newStatus === "DELIVERED" && (
              <div>
                <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                  Actual Delivery Date
                </label>
                <input
                  type="date"
                  value={actualDeliveredDate}
                  onChange={(e) => setActualDeliveredDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F] text-[#34312F]"
                />
              </div>
            )}

            {newStatus !== "DELIVERED" && (
              <div>
                <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                  Delay Reason (if delayed)
                </label>
                <input
                  type="text"
                  value={statusDelayReason}
                  onChange={(e) => setStatusDelayReason(e.target.value)}
                  placeholder="e.g. Courier transit hub delay, customer requested reschedule"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Status Transition Note
              </label>
              <textarea
                rows={2}
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Remarks about this state change..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#F0ECE7]">
              <button
                type="button"
                onClick={() => setUpdatingStatusDelivery(null)}
                className="px-4 py-2 text-xs font-medium text-[#6B635B] hover:text-[#34312F] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={statusMutation.isPending}
                className="px-4.5 py-2 bg-[#34312F] hover:bg-[#1F1D1C] text-white rounded-xl text-xs font-medium shadow-soft disabled:opacity-50 transition-colors"
              >
                {statusMutation.isPending ? "Updating..." : "Save Status"}
              </button>
            </div>
          </form>
        </FormDialog>
      )}

      {/* Prepare Dispatch Notification Dialog */}
      {templateDelivery && (
        <FormDialog
          isOpen={!!templateDelivery}
          onClose={() => setTemplateDelivery(null)}
          title={`Dispatch Notification Template (#${templateDelivery.order?.order_number})`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <p className="text-xs text-[#6B635B] leading-relaxed">
              Personalized customer message formatted for WhatsApp or Instagram Direct Message.
              Copy and send manually to update the client.
            </p>

            {isTemplateLoading ? (
              <LoadingState message="Generating dispatch message..." />
            ) : (
              <div className="relative">
                <textarea
                  readOnly
                  rows={8}
                  value={dispatchTemplate?.template_text || ""}
                  className="w-full p-3.5 font-mono text-xs rounded-xl border border-[#E7E1D8] bg-[#FDFBF7] text-[#34312F] focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[#F0ECE7]">
              <span className="text-[10px] text-[#817872]">
                Recipient: {dispatchTemplate?.recipient} ({dispatchTemplate?.phone})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateDelivery(null)}
                  className="px-4 py-2 text-xs font-medium text-[#6B635B] hover:text-[#34312F] transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={copyTemplateToClipboard}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#34312F] hover:bg-[#1F1D1C] text-white rounded-xl text-xs font-medium shadow-soft transition-colors"
                >
                  {copiedMessage ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#8B9B86]" />
                      Copied to Clipboard!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Message
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </FormDialog>
      )}
    </div>
  );
}
