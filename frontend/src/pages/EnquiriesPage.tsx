import React, { useState } from "react";
import {
  Plus,
  MessageSquare,
  ArrowUpRight,
  Check,
  Phone,
  Calendar,
  IndianRupee,
  AlertCircle,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Lock,
  Trash2,
  ShoppingBag,
  HelpCircle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/layout/PageHeader";
import { DataTable, Column } from "../components/shared/DataTable";
import { SearchInput } from "../components/shared/SearchInput";
import { FilterDropdown } from "../components/shared/FilterDropdown";
import { StatusBadge } from "../components/shared/StatusBadge";
import { FormDialog } from "../components/shared/FormDialog";
import { DetailDrawer } from "../components/shared/DetailDrawer";
import { LoadingState } from "../components/shared/LoadingState";
import { ErrorState } from "../components/shared/ErrorState";
import { formatCurrency, getApiErrorMessage } from "../lib/utils";
import { apiClient } from "../lib/api";
import { Enquiry, EnquiryStatus, Customer } from "../types";
import { useDashboardSearch } from "../layouts/DashboardLayout";

export function EnquiriesPage() {
  const queryClient = useQueryClient();
  const globalSearch = useDashboardSearch();
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Dialog toggles
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedEnquiryId, setSelectedEnquiryId] = useState<number | null>(null);
  const [convertEnquiry, setConvertEnquiry] = useState<Enquiry | null>(null);

  // New Lead Form States
  const [leadCustomerMode, setLeadCustomerMode] = useState<"NEW" | "EXISTING">("NEW");
  const [selectedExistingCustomerId, setSelectedExistingCustomerId] = useState<number | "">("");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadChannel, setLeadChannel] = useState<"INSTAGRAM" | "WHATSAPP" | "CALL" | "OTHER">(
    "INSTAGRAM"
  );
  const [leadInterest, setLeadInterest] = useState("");
  const [leadEstimatedValue, setLeadEstimatedValue] = useState("");
  const [leadRequirements, setLeadRequirements] = useState("");
  const [leadFollowUpDate, setLeadFollowUpDate] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Follow-up sub-form state
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

  // Status Change / Lost Reason Modal
  const [isLostReasonOpen, setIsLostReasonOpen] = useState(false);
  const [lostReasonText, setLostReasonText] = useState("");

  // Convert to Order Form States
  const [convertAdvance, setConvertAdvance] = useState("");
  const [convertDeliveryCharge, setConvertDeliveryCharge] = useState("100");
  const [convertDiscount, setConvertDiscount] = useState("0");
  const [convertTargetDate, setConvertTargetDate] = useState("");
  const [convertItems, setConvertItems] = useState<
    Array<{
      item_name: string;
      item_type: "CATALOG" | "CUSTOM";
      unit_price: number;
      quantity: number;
      customization_details: string;
    }>
  >([
    {
      item_name: "",
      item_type: "CUSTOM",
      unit_price: 1500,
      quantity: 1,
      customization_details: "",
    },
  ]);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertedSuccessInfo, setConvertedSuccessInfo] = useState<{
    orderNumber: string;
    orderId: number;
  } | null>(null);

  // Fetch Enquiries List
  const effectiveSearch = search || globalSearch;
  const {
    data: enquiries = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Enquiry[]>({
    queryKey: ["enquiries", effectiveSearch, channelFilter, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (effectiveSearch) params.search = effectiveSearch;
      if (channelFilter !== "ALL") params.channel = channelFilter;
      if (statusFilter !== "ALL") params.status = statusFilter;
      const res = await apiClient.get("/enquiries", { params });
      return res.data?.data?.data || res.data?.data || [];
    },
  });

  // Fetch Customers for existing dropdown
  const { data: customerOptions = [] } = useQuery<Customer[]>({
    queryKey: ["customers-dropdown"],
    queryFn: async () => {
      const res = await apiClient.get("/customers?per_page=100");
      return res.data?.data?.data || res.data?.data || [];
    },
    enabled: isAddOpen,
  });

  // Fetch Enquiry Details (with follow-ups and converted order)
  const { data: enquiryDetails, isLoading: isDetailsLoading } = useQuery<Enquiry | null>({
    queryKey: ["enquiry", selectedEnquiryId],
    queryFn: async () => {
      if (!selectedEnquiryId) return null;
      const res = await apiClient.get(`/enquiries/${selectedEnquiryId}`);
      return res.data?.data || null;
    },
    enabled: !!selectedEnquiryId,
  });

  // Create Enquiry Mutation
  const createEnquiryMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/enquiries", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsAddOpen(false);
      resetAddForm();
    },
    onError: (err: any) => {
      setFormError(getApiErrorMessage(err, "Failed to create enquiry."));
    },
  });

  // Convert Enquiry Mutation
  const convertEnquiryMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post(`/enquiries/${id}/convert`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      const order = data?.data?.order;
      setConvertedSuccessInfo({
        orderNumber: order?.order_number || "CONFIRMED",
        orderId: order?.id,
      });
      queryClient.invalidateQueries({ queryKey: ["enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["enquiry", convertEnquiry?.id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: any) => {
      const code = err.response?.data?.error?.code;
      const message = getApiErrorMessage(err, "Conversion failed.");
      if (code === "ENQUIRY_ALREADY_CONVERTED") {
        setConvertError("CRITICAL CHECK: " + message);
      } else {
        setConvertError(message);
      }
    },
  });

  const resetAddForm = () => {
    setLeadCustomerMode("NEW");
    setSelectedExistingCustomerId("");
    setLeadName("");
    setLeadPhone("");
    setLeadChannel("INSTAGRAM");
    setLeadInterest("");
    setLeadEstimatedValue("");
    setLeadRequirements("");
    setLeadFollowUpDate("");
    setLeadNotes("");
    setFormError(null);
  };

  const handleCreateEnquiry = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload: any = {
      channel: leadChannel,
      product_interest: leadInterest.trim(),
      estimated_value: leadEstimatedValue ? parseFloat(leadEstimatedValue) : null,
      requirements: leadRequirements.trim() || null,
      follow_up_date: leadFollowUpDate || null,
      notes: leadNotes.trim() || null,
      status: "NEW",
    };

    if (leadCustomerMode === "EXISTING") {
      if (!selectedExistingCustomerId) {
        setFormError("Please select an existing customer.");
        return;
      }
      payload.customer_id = Number(selectedExistingCustomerId);
    } else {
      if (!leadName.trim() || !leadPhone.trim()) {
        setFormError("Name and Phone are mandatory for new leads.");
        return;
      }
      payload.customer_name = leadName.trim();
      payload.customer_phone = leadPhone.trim();
    }

    createEnquiryMutation.mutate(payload);
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiryId || !followUpDate) return;

    try {
      setIsSubmittingFollowUp(true);
      await apiClient.post(`/enquiries/${selectedEnquiryId}/follow-ups`, {
        scheduled_date: followUpDate,
        notes: followUpNotes.trim() || null,
      });
      setFollowUpDate("");
      setFollowUpNotes("");
      queryClient.invalidateQueries({ queryKey: ["enquiry", selectedEnquiryId] });
      queryClient.invalidateQueries({ queryKey: ["enquiries"] });
    } catch (err: any) {
      alert("Follow-up error: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  const handleUpdateStatus = async (newStatus: EnquiryStatus) => {
    if (!selectedEnquiryId) return;

    if (newStatus === "LOST") {
      setIsLostReasonOpen(true);
      return;
    }

    try {
      await apiClient.patch(`/enquiries/${selectedEnquiryId}/status`, {
        status: newStatus,
      });
      queryClient.invalidateQueries({ queryKey: ["enquiry", selectedEnquiryId] });
      queryClient.invalidateQueries({ queryKey: ["enquiries"] });
    } catch (err: any) {
      alert("Status change error: " + (err.response?.data?.message || err.message));
    }
  };

  const handleConfirmLostStatus = async () => {
    if (!selectedEnquiryId) return;
    try {
      await apiClient.patch(`/enquiries/${selectedEnquiryId}/status`, {
        status: "LOST",
        lost_reason: lostReasonText.trim() || "Customer dropped / no response",
      });
      setIsLostReasonOpen(false);
      setLostReasonText("");
      queryClient.invalidateQueries({ queryKey: ["enquiry", selectedEnquiryId] });
      queryClient.invalidateQueries({ queryKey: ["enquiries"] });
    } catch (err: any) {
      alert("Error marking lost: " + (err.response?.data?.message || err.message));
    }
  };

  const openConvertModal = (enquiry: Enquiry) => {
    setConvertEnquiry(enquiry);
    setConvertError(null);
    setConvertedSuccessInfo(null);
    setConvertAdvance(
      enquiry.estimated_value ? String(Math.round(enquiry.estimated_value * 0.5)) : "500"
    );
    setConvertDeliveryCharge("100");
    setConvertDiscount("0");
    setConvertTargetDate("");
    setConvertItems([
      {
        item_name: enquiry.product_interest,
        item_type: "CUSTOM",
        unit_price: enquiry.estimated_value || 1500,
        quantity: 1,
        customization_details: enquiry.requirements || "",
      },
    ]);
  };

  const handleExecuteConvert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertEnquiry) return;
    setConvertError(null);

    const payload = {
      advance_amount_required: parseFloat(convertAdvance) || 0,
      delivery_charge: parseFloat(convertDeliveryCharge) || 0,
      discount_amount: parseFloat(convertDiscount) || 0,
      target_delivery_date: convertTargetDate || null,
      items: convertItems.map((item) => ({
        item_name: item.item_name.trim(),
        item_type: item.item_type,
        unit_price: parseFloat(String(item.unit_price)) || 0,
        quantity: parseInt(String(item.quantity)) || 1,
        customization_details: item.customization_details.trim() || null,
      })),
    };

    convertEnquiryMutation.mutate({ id: convertEnquiry.id, payload });
  };

  // Convert calculation
  const subtotal = convertItems.reduce(
    (sum, item) => sum + (parseFloat(String(item.unit_price)) || 0) * (item.quantity || 1),
    0
  );
  const delivery = parseFloat(convertDeliveryCharge) || 0;
  const discount = parseFloat(convertDiscount) || 0;
  const grandTotal = Math.max(0, subtotal + delivery - discount);

  const columns: Column<Enquiry>[] = [
    {
      header: "Channel",
      cell: (row) => (
        <span
          className={`rounded px-2 py-0.5 text-3xs font-bold uppercase tracking-wider ${
            row.channel === "INSTAGRAM"
              ? "bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200"
              : row.channel === "WHATSAPP"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-stone-100 text-stone-700 border border-stone-200"
          }`}
        >
          {row.channel}
        </span>
      ),
    },
    {
      header: "Lead / Prospect",
      cell: (row) => (
        <div>
          <p className="font-semibold text-stone-900">{row.customer?.name || "Direct Lead"}</p>
          <p className="text-3xs text-stone-500 font-mono flex items-center gap-1">
            <Phone className="h-2.5 w-2.5 text-stone-400" />
            {row.customer?.phone}
          </p>
        </div>
      ),
    },
    {
      header: "Product Interest",
      cell: (row) => (
        <div>
          <p className="max-w-xs text-stone-800 font-medium truncate">{row.product_interest}</p>
          {row.requirements && (
            <p className="text-3xs text-stone-400 line-clamp-1 max-w-xs">{row.requirements}</p>
          )}
        </div>
      ),
    },
    {
      header: "Est. Value",
      cell: (row) => (
        <span className="font-semibold text-stone-900">
          {row.estimated_value ? formatCurrency(row.estimated_value) : "—"}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      header: "Follow Up",
      cell: (row) => (
        <span className="text-2xs text-stone-500 flex items-center gap-1">
          <Calendar className="h-3 w-3 text-stone-400" />
          {row.follow_up_date
            ? new Date(row.follow_up_date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })
            : "None"}
        </span>
      ),
    },
    {
      header: "Action",
      cell: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setSelectedEnquiryId(row.id)}
            className="rounded-md border border-stone-200 px-2 py-1 text-2xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            Inspect
          </button>
          {row.status !== "CONVERTED" && !row.converted_order_id ? (
            <button
              type="button"
              onClick={() => openConvertModal(row)}
              className="rounded-md bg-rose-700 px-2 py-1 text-2xs font-semibold text-white hover:bg-rose-800 transition-colors"
            >
              Convert
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-3xs font-semibold text-emerald-800 border border-emerald-200"
              title="Already converted to Order"
            >
              <Check className="h-3 w-3" />
              Converted
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads & Enquiries Pipeline"
        description="Capture, qualify, schedule follow-ups, and convert Instagram and WhatsApp customer requests into orders."
        actions={
          <button
            type="button"
            onClick={() => {
              resetAddForm();
              setIsAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#34312F] px-4 py-2 text-xs font-medium text-white shadow-soft hover:bg-[#1F1D1C] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Capture New Lead</span>
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search leads, product interest, client..."
        />
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <FilterDropdown
            label="Channel"
            selectedValue={channelFilter}
            onChange={setChannelFilter}
            options={[
              { label: "All Channels", value: "ALL" },
              { label: "Instagram", value: "INSTAGRAM" },
              { label: "WhatsApp", value: "WHATSAPP" },
              { label: "Phone Call", value: "CALL" },
            ]}
          />
          <FilterDropdown
            label="Status"
            selectedValue={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: "All Statuses", value: "ALL" },
              { label: "New Lead", value: "NEW" },
              { label: "Contacted", value: "CONTACTED" },
              { label: "Discussing", value: "DISCUSSING" },
              { label: "Quoted", value: "QUOTED" },
              { label: "Converted", value: "CONVERTED" },
              { label: "Lost", value: "LOST" },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Fetching enquiries pipeline..." />
      ) : isError ? (
        <ErrorState
          title="Could not load enquiries"
          message={(error as any)?.message || "Failed to communicate with Laravel backend."}
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          data={enquiries}
          columns={columns}
          onRowClick={(row) => setSelectedEnquiryId(row.id)}
          emptyTitle="No leads in pipeline"
          emptyMessage="No enquiries match your channel or status criteria."
        />
      )}

      {/* CAPTURE NEW LEAD DIALOG */}
      {isAddOpen && (
        <FormDialog
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          title="Capture Incoming Lead"
          description="Log prospective client inquiry from Instagram DM, WhatsApp, or Direct call."
          maxWidth="md"
        >
          <form onSubmit={handleCreateEnquiry} className="space-y-4 text-xs">
            {formError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-2xs font-medium">{formError}</p>
              </div>
            )}

            {/* Source Channel Selector */}
            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Source Channel *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "INSTAGRAM", label: "Instagram DM" },
                  { id: "WHATSAPP", label: "WhatsApp" },
                  { id: "CALL", label: "Phone Call" },
                  { id: "OTHER", label: "Direct / Other" },
                ].map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setLeadChannel(ch.id as any)}
                    className={`py-2 rounded-lg border text-xs font-semibold transition-colors ${
                      leadChannel === ch.id
                        ? "border-rose-300 bg-rose-50 text-rose-800 font-bold"
                        : "border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Identification (Re-use or New) */}
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-800 uppercase tracking-wider text-2xs">
                  Customer Profile
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLeadCustomerMode("NEW")}
                    className={`px-2.5 py-1 rounded text-3xs font-semibold ${
                      leadCustomerMode === "NEW"
                        ? "bg-rose-700 text-white"
                        : "bg-white text-stone-600 border border-stone-200"
                    }`}
                  >
                    New Prospect
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeadCustomerMode("EXISTING")}
                    className={`px-2.5 py-1 rounded text-3xs font-semibold ${
                      leadCustomerMode === "EXISTING"
                        ? "bg-rose-700 text-white"
                        : "bg-white text-stone-600 border border-stone-200"
                    }`}
                  >
                    Existing Customer
                  </button>
                </div>
              </div>

              {leadCustomerMode === "EXISTING" ? (
                <div>
                  <label className="block text-2xs font-semibold text-stone-600 mb-1">
                    Select Existing Client *
                  </label>
                  <select
                    value={selectedExistingCustomerId}
                    onChange={(e) =>
                      setSelectedExistingCustomerId(
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                    className="w-full h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-xs focus:outline-rose-600"
                  >
                    <option value="">-- Choose verified customer --</option>
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
                    <label className="block text-2xs font-semibold text-stone-600 mb-1">
                      Prospect Name *
                    </label>
                    <input
                      type="text"
                      required={leadCustomerMode === "NEW"}
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="e.g. Athira Krishnan"
                      className="w-full h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs focus:outline-rose-600"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-semibold text-stone-600 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      required={leadCustomerMode === "NEW"}
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      placeholder="+91 97450 11223"
                      className="w-full h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs focus:outline-rose-600"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Product Interest & Value */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                  Product Interest *
                </label>
                <input
                  type="text"
                  required
                  value={leadInterest}
                  onChange={(e) => setLeadInterest(e.target.value)}
                  placeholder="e.g. 16x16 9-Grid Collage Frame"
                  className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs focus:outline-rose-600"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                  Estimated Value (₹ INR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={leadEstimatedValue}
                  onChange={(e) => setLeadEstimatedValue(e.target.value)}
                  placeholder="2500"
                  className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs focus:outline-rose-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                  Initial Follow-up Date
                </label>
                <input
                  type="date"
                  value={leadFollowUpDate}
                  onChange={(e) => setLeadFollowUpDate(e.target.value)}
                  className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs focus:outline-rose-600"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                  Client Requirements
                </label>
                <input
                  type="text"
                  value={leadRequirements}
                  onChange={(e) => setLeadRequirements(e.target.value)}
                  placeholder="e.g. Needs delivery by Dec 1st, wants black frame"
                  className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs focus:outline-rose-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Internal Conversation Notes
              </label>
              <textarea
                rows={2}
                value={leadNotes}
                onChange={(e) => setLeadNotes(e.target.value)}
                placeholder="Initial chat details, shared sample photos, coupon inquiry..."
                className="w-full rounded-lg border border-stone-200 p-2 text-xs focus:outline-rose-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-stone-700 hover:bg-stone-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createEnquiryMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-4 py-1.5 text-white font-semibold hover:bg-rose-800 disabled:opacity-50"
              >
                {createEnquiryMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>Capture Lead</span>
              </button>
            </div>
          </form>
        </FormDialog>
      )}

      {/* ENQUIRY DETAILS & FOLLOW-UP TIMELINE DRAWER */}
      {selectedEnquiryId && (
        <DetailDrawer
          isOpen={!!selectedEnquiryId}
          onClose={() => setSelectedEnquiryId(null)}
          title={
            enquiryDetails
              ? `Lead #${enquiryDetails.id}`
              : "Enquiry Details"
          }
          subtitle={enquiryDetails?.customer?.name}
          badge={enquiryDetails && <StatusBadge status={enquiryDetails.status} size="sm" />}
          width="lg"
          footer={
            enquiryDetails && (
              <div className="flex items-center justify-between w-full">
                {enquiryDetails.status !== "CONVERTED" && !enquiryDetails.converted_order_id ? (
                  <button
                    type="button"
                    onClick={() => {
                      const enq = enquiryDetails;
                      setSelectedEnquiryId(null);
                      openConvertModal(enq);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#34312F] px-4 py-2 text-white font-medium hover:bg-[#1F1D1C] text-xs shadow-soft transition-colors"
                  >
                    <span>Convert to Order</span>
                  </button>
                ) : (
                  <span className="text-xs text-[#475E42] font-medium">Order converted</span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedEnquiryId(null)}
                  className="rounded-xl border border-[#E7E1D8] px-4 py-2 text-[#34312F] hover:bg-[#F7F4F0] font-medium text-xs transition-colors"
                >
                  Close Drawer
                </button>
              </div>
            )
          }
        >
          {isDetailsLoading || !enquiryDetails ? (
            <div className="py-8">
              <LoadingState message="Fetching lead details and follow-ups..." />
            </div>
          ) : (
            <div className="space-y-5 text-xs">
              {/* Header card with status changer */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/70 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 text-sm">
                        {enquiryDetails.customer?.name}
                      </span>
                      <StatusBadge status={enquiryDetails.status} size="sm" />
                    </div>
                    <p className="font-mono text-stone-600 text-3xs mt-0.5">
                      {enquiryDetails.customer?.phone} • Channel: {enquiryDetails.channel}
                    </p>
                  </div>

                  {/* Status transition dropdown */}
                  <div className="flex items-center gap-2">
                    <label className="text-3xs font-semibold uppercase text-stone-500">
                      Pipeline Stage:
                    </label>
                    <select
                      value={enquiryDetails.status}
                      disabled={enquiryDetails.status === "CONVERTED"}
                      onChange={(e) => handleUpdateStatus(e.target.value as EnquiryStatus)}
                      className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800 focus:outline-rose-600 disabled:opacity-60"
                    >
                      <option value="NEW">New Lead</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="DISCUSSING">Discussing Specs</option>
                      <option value="QUOTED">Estimate / Quote Sent</option>
                      <option value="LOST">Mark as Lost</option>
                      {enquiryDetails.status === "CONVERTED" && (
                        <option value="CONVERTED">Converted to Order</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-stone-700">
                  <div>
                    <p className="text-3xs uppercase tracking-wider text-stone-400 font-semibold">
                      Product Interest
                    </p>
                    <p className="font-medium text-stone-900">{enquiryDetails.product_interest}</p>
                    {enquiryDetails.requirements && (
                      <p className="text-stone-600 text-2xs mt-1">
                        <strong>Requirements:</strong> {enquiryDetails.requirements}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-3xs uppercase tracking-wider text-stone-400 font-semibold">
                      Estimated Commercial Value
                    </p>
                    <p className="font-bold text-rose-800 text-sm">
                      {enquiryDetails.estimated_value
                        ? formatCurrency(enquiryDetails.estimated_value)
                        : "Open Range"}
                    </p>
                    {enquiryDetails.lost_reason && (
                      <p className="text-red-700 text-2xs mt-1 bg-red-50 p-1.5 rounded border border-red-200">
                        <strong>Lost Reason:</strong> {enquiryDetails.lost_reason}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Conversion Status Banner */}
              {enquiryDetails.status === "CONVERTED" || enquiryDetails.converted_order_id ? (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3.5 border border-emerald-200 text-emerald-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-xs">
                        Successfully Converted to Order{" "}
                        {enquiryDetails.converted_order?.order_number ||
                          `#${enquiryDetails.converted_order_id}`}
                      </p>
                      <p className="text-3xs text-emerald-700">
                        Double conversion is locked to protect financial ledgers.
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-xs text-emerald-900">
                    {enquiryDetails.converted_order?.total_amount
                      ? formatCurrency(enquiryDetails.converted_order.total_amount)
                      : "Verified"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg bg-rose-50/70 p-3 border border-rose-200/60">
                  <div>
                    <p className="font-bold text-stone-900 text-xs">Ready for Order Conversion?</p>
                    <p className="text-3xs text-stone-600">
                      Reuses verified customer profile and locks order parameters.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEnquiryId(null);
                      openConvertModal(enquiryDetails);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#34312F] px-3.5 py-1.5 text-white font-medium hover:bg-[#1F1D1C] text-xs shadow-soft transition-colors"
                  >
                    <span>Convert to Order</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Follow-up Timeline & Scheduler */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-stone-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <Clock className="h-3.5 w-3.5 text-stone-500" />
                    Follow-Up Schedule & Touchpoints
                  </h5>
                  <span className="text-3xs text-stone-400">
                    Records scheduled contact reminders
                  </span>
                </div>

                {/* Schedule follow-up subform */}
                <form
                  onSubmit={handleAddFollowUp}
                  className="flex flex-col sm:flex-row gap-2 bg-stone-50 p-2.5 rounded-lg border border-stone-200/60"
                >
                  <input
                    type="datetime-local"
                    required
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs focus:outline-rose-600"
                  />
                  <input
                    type="text"
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    placeholder="Notes (e.g. Call back after 6 PM to confirm size)..."
                    className="flex-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs focus:outline-rose-600"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingFollowUp || !followUpDate}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-rose-700 px-3 py-1 text-white font-semibold hover:bg-rose-800 disabled:opacity-50 text-xs shrink-0"
                  >
                    {isSubmittingFollowUp ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>Schedule</span>
                  </button>
                </form>

                {/* Follow-ups list */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {enquiryDetails.follow_ups && enquiryDetails.follow_ups.length > 0 ? (
                    enquiryDetails.follow_ups.map((f) => (
                      <div
                        key={f.id}
                        className="bg-white p-2.5 rounded-lg border border-stone-200/70 flex items-start justify-between gap-2"
                      >
                        <div>
                          <p className="font-semibold text-stone-900 text-xs">
                            Scheduled:{" "}
                            {new Date(f.scheduled_date).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {f.notes && <p className="text-stone-600 text-2xs mt-0.5">{f.notes}</p>}
                          <p className="text-3xs text-stone-400 mt-1">
                            Logged by {f.operator?.name || "Staff"}
                          </p>
                        </div>
                        <span className="rounded bg-stone-100 px-2 py-0.5 text-3xs font-semibold text-stone-700 uppercase">
                          {f.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-stone-400 text-center py-3 italic">
                      No follow-ups recorded yet. Schedule one above.
                    </p>
                  )}
                </div>
              </div>

            </div>
          )}
        </DetailDrawer>
      )}

      {/* MARK AS LOST MODAL */}
      {isLostReasonOpen && (
        <FormDialog
          isOpen={isLostReasonOpen}
          onClose={() => setIsLostReasonOpen(false)}
          title="Mark Lead as Lost"
          description="Record reason for drop-off to assist pricing and marketing optimization."
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Reason for Lost Deal *
              </label>
              <textarea
                rows={3}
                required
                value={lostReasonText}
                onChange={(e) => setLostReasonText(e.target.value)}
                placeholder="e.g. Price too high compared to local photo studio, delivery deadline too tight, or no response after 3 follow-ups..."
                className="w-full rounded-lg border border-stone-200 p-2.5 text-xs focus:outline-rose-600"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLostReasonOpen(false)}
                className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-stone-700 hover:bg-stone-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLostStatus}
                className="rounded-lg bg-red-700 px-4 py-1.5 text-white font-semibold hover:bg-red-800"
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </FormDialog>
      )}

      {/* CONVERT ENQUIRY TO ORDER MODAL */}
      {convertEnquiry && (
        <FormDialog
          isOpen={!!convertEnquiry}
          onClose={() => setConvertEnquiry(null)}
          title={`Convert Lead to Order (Enquiry #${convertEnquiry.id})`}
          description="Creates an official order linked to the existing customer profile with double-conversion protection."
          maxWidth="lg"
        >
          {convertedSuccessInfo ? (
            <div className="space-y-4 text-center py-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-stone-900">
                  Order Successfully Created: {convertedSuccessInfo.orderNumber}
                </h4>
                <p className="text-2xs text-stone-500 mt-1">
                  Enquiry #{convertEnquiry.id} is now linked and status set to CONVERTED.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setConvertEnquiry(null);
                    setConvertedSuccessInfo(null);
                  }}
                  className="rounded-lg bg-rose-700 px-5 py-2 text-white font-semibold text-xs hover:bg-rose-800"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleExecuteConvert} className="space-y-4 text-xs">
              {convertError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-800 border border-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p className="text-2xs font-medium">{convertError}</p>
                </div>
              )}

              {/* Customer Link Card (Read-only to prevent duplicate creation) */}
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200/70 flex items-center justify-between">
                <div>
                  <span className="text-3xs uppercase tracking-wider text-stone-400 font-semibold">
                    Linked Customer
                  </span>
                  <p className="font-bold text-stone-900 text-xs">
                    {convertEnquiry.customer?.name} ({convertEnquiry.customer?.phone})
                  </p>
                  <p className="text-3xs text-stone-500">
                    ID: {convertEnquiry.customer?.customer_code || "CUST-" + convertEnquiry.customer_id}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-stone-500 text-2xs bg-white px-2 py-1 rounded border border-stone-200">
                  <Lock className="h-3 w-3 text-stone-400" />
                  <span>Reusing Customer Profile</span>
                </div>
              </div>

              {/* Line Items Builder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-800 text-2xs uppercase tracking-wider">
                    Order Line Items ({convertItems.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setConvertItems([
                        ...convertItems,
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

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {convertItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-stone-200 bg-white space-y-2"
                    >
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
                              const updated = [...convertItems];
                              updated[idx].item_name = e.target.value;
                              setConvertItems(updated);
                            }}
                            placeholder="e.g. 12x18 Minimalist Pine Frame"
                            className="w-full h-8 rounded border border-stone-200 px-2 text-xs focus:outline-rose-600"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-3xs font-semibold text-stone-500 mb-0.5">
                            Type
                          </label>
                          <select
                            value={item.item_type}
                            onChange={(e) => {
                              const updated = [...convertItems];
                              updated[idx].item_type = e.target.value as any;
                              setConvertItems(updated);
                            }}
                            className="w-full h-8 rounded border border-stone-200 px-2 text-xs bg-white focus:outline-rose-600"
                          >
                            <option value="CUSTOM">Custom Craft</option>
                            <option value="CATALOG">Standard Catalogue</option>
                          </select>
                        </div>

                        <div className="sm:col-span-3 flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <label className="block text-3xs font-semibold text-stone-500 mb-0.5">
                              Unit Price (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => {
                                const updated = [...convertItems];
                                updated[idx].unit_price = parseFloat(e.target.value) || 0;
                                setConvertItems(updated);
                              }}
                              className="w-full h-8 rounded border border-stone-200 px-2 text-xs focus:outline-rose-600"
                            />
                          </div>

                          {convertItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setConvertItems(convertItems.filter((_, i) => i !== idx));
                              }}
                              className="text-stone-400 hover:text-red-700 mt-3"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={item.customization_details}
                          onChange={(e) => {
                            const updated = [...convertItems];
                            updated[idx].customization_details = e.target.value;
                            setConvertItems(updated);
                          }}
                          placeholder="Customization details (names, quote, matte archival finish)..."
                          className="w-full h-7 rounded border border-stone-200 px-2 text-2xs text-stone-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation & Advance */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-stone-50 p-3 rounded-lg border border-stone-200/70">
                <div>
                  <label className="block text-3xs font-semibold text-stone-500 uppercase mb-0.5">
                    Delivery Charge (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={convertDeliveryCharge}
                    onChange={(e) => setConvertDeliveryCharge(e.target.value)}
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
                    value={convertDiscount}
                    onChange={(e) => setConvertDiscount(e.target.value)}
                    className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-semibold text-stone-500 uppercase mb-0.5">
                    Advance Required (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={convertAdvance}
                    onChange={(e) => setConvertAdvance(e.target.value)}
                    className="w-full h-8 rounded border border-rose-300 bg-white px-2 text-xs font-bold text-rose-800"
                  />
                </div>

                <div>
                  <label className="block text-3xs font-semibold text-stone-500 uppercase mb-0.5">
                    Target Delivery Date
                  </label>
                  <input
                    type="date"
                    value={convertTargetDate}
                    onChange={(e) => setConvertTargetDate(e.target.value)}
                    className="w-full h-8 rounded border border-stone-200 bg-white px-2 text-xs"
                  />
                </div>
              </div>

              {/* Grand Total Summary */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-stone-100 font-bold text-stone-900 text-xs">
                <span>Calculated Total Order Value</span>
                <span className="text-base text-rose-900">{formatCurrency(grandTotal)}</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setConvertEnquiry(null)}
                  className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-stone-700 hover:bg-stone-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={convertEnquiryMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-4 py-1.5 text-white font-semibold hover:bg-rose-800 disabled:opacity-50"
                >
                  {convertEnquiryMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>Confirm & Generate Order</span>
                </button>
              </div>
            </form>
          )}
        </FormDialog>
      )}
    </div>
  );
}
