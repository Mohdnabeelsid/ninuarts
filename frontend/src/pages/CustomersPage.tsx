import React, { useState } from "react";
import {
  Plus,
  Users,
  Phone,
  Instagram,
  MapPin,
  Upload,
  AlertCircle,
  Clock,
  FileText,
  ShoppingBag,
  ExternalLink,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
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
import { Customer, LeadSource } from "../types";
import { useDashboardSearch } from "../layouts/DashboardLayout";

interface ImportPreviewRow {
  row_number: number;
  name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  delivery_address?: string | null;
  source_channel?: string | null;
  notes?: string | null;
  validation_status: "VALID" | "DUPLICATE" | "INVALID";
  error?: string | null;
}

interface ImportPreviewResponse {
  preview: ImportPreviewRow[];
  total_rows: number;
  valid_count: number;
  duplicate_count: number;
  invalid_count: number;
}

export function CustomersPage() {
  const queryClient = useQueryClient();
  const globalSearch = useDashboardSearch();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formChannel, setFormChannel] = useState<LeadSource>("INSTAGRAM");
  const [formCity, setFormCity] = useState("Alappuzha");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Internal Note form state
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  // CSV Import States
  const [csvContent, setCsvContent] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
  const [isInspectingCsv, setIsInspectingCsv] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Fetch Customers list
  const effectiveSearch = search || globalSearch;
  const {
    data: customers = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Customer[]>({
    queryKey: ["customers", effectiveSearch, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (effectiveSearch) params.search = effectiveSearch;
      if (statusFilter !== "ALL") params.status = statusFilter;
      const res = await apiClient.get("/customers", { params });
      return res.data?.data?.data || res.data?.data || [];
    },
  });

  // Fetch Selected Customer Details (with notes and orders)
  const { data: customerDetails, isLoading: isDetailsLoading } = useQuery<Customer | null>({
    queryKey: ["customer", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return null;
      const res = await apiClient.get(`/customers/${selectedCustomerId}`);
      return res.data?.data || null;
    },
    enabled: !!selectedCustomerId,
  });

  // Create Customer Mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (payload: Partial<Customer>) => {
      const res = await apiClient.post("/customers", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(getApiErrorMessage(err, "Failed to create customer profile."));
    },
  });

  // Update Customer Mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<Customer> }) => {
      const res = await apiClient.put(`/customers/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", editingCustomer?.id] });
      setIsEditOpen(false);
      setEditingCustomer(null);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(getApiErrorMessage(err, "Failed to update customer."));
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormChannel("INSTAGRAM");
    setFormCity("Alappuzha");
    setFormAddress("");
    setFormNotes("");
    setFormStatus("ACTIVE");
    setFormError(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setFormName(cust.name);
    setFormPhone(cust.phone);
    setFormEmail(cust.email || "");
    setFormChannel(cust.source_channel || "INSTAGRAM");
    setFormCity(cust.city || "Alappuzha");
    setFormAddress(cust.delivery_address || "");
    setFormNotes(cust.notes || "");
    setFormStatus(cust.status || "ACTIVE");
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload = {
      name: formName.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim() || null,
      source_channel: formChannel,
      city: formCity.trim(),
      delivery_address: formAddress.trim() || null,
      notes: formNotes.trim() || null,
      status: formStatus,
    };

    if (editingCustomer) {
      updateCustomerMutation.mutate({ id: editingCustomer.id, payload });
    } else {
      createCustomerMutation.mutate(payload);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !newNote.trim()) return;

    try {
      setIsAddingNote(true);
      await apiClient.post(`/customers/${selectedCustomerId}/notes`, {
        note: newNote.trim(),
      });
      setNewNote("");
      queryClient.invalidateQueries({ queryKey: ["customer", selectedCustomerId] });
    } catch (err: any) {
      alert("Could not append internal note: " + (err.response?.data?.message || err.message));
    } finally {
      setIsAddingNote(false);
    }
  };

  // CSV Parsing and Preview Handler
  const handleInspectCsv = async () => {
    setImportError(null);
    setImportSuccessMessage(null);
    if (!csvContent.trim()) {
      setImportError("Please upload or paste CSV content first.");
      return;
    }

    try {
      setIsInspectingCsv(true);
      // Parse CSV text into array of objects
      const lines = csvContent
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        setImportError("CSV must include a header row and at least one data row.");
        setIsInspectingCsv(false);
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
      const nameIdx = headers.findIndex((h) => h.includes("name"));
      const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("mobile"));
      const emailIdx = headers.findIndex((h) => h.includes("email"));
      const cityIdx = headers.findIndex((h) => h.includes("city") || h.includes("location"));
      const addressIdx = headers.findIndex((h) => h.includes("address"));
      const notesIdx = headers.findIndex((h) => h.includes("note") || h.includes("preference"));
      const channelIdx = headers.findIndex((h) => h.includes("source") || h.includes("channel"));

      if (nameIdx === -1 || phoneIdx === -1) {
        setImportError("CSV must contain 'name' and 'phone' columns.");
        setIsInspectingCsv(false);
        return;
      }

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
        if (!parts[nameIdx] && !parts[phoneIdx]) continue;
        rows.push({
          name: parts[nameIdx] || "",
          phone: parts[phoneIdx] || "",
          email: emailIdx !== -1 ? parts[emailIdx] || null : null,
          city: cityIdx !== -1 ? parts[cityIdx] || "Alappuzha" : "Alappuzha",
          delivery_address: addressIdx !== -1 ? parts[addressIdx] || null : null,
          notes: notesIdx !== -1 ? parts[notesIdx] || null : null,
          source_channel: channelIdx !== -1 ? parts[channelIdx] || "DIRECT" : "DIRECT",
        });
      }

      const res = await apiClient.post("/customers/import-preview", { rows });
      setImportPreview(res.data?.data);
    } catch (err: any) {
      setImportError(getApiErrorMessage(err, "Failed to inspect and validate CSV."));
    } finally {
      setIsInspectingCsv(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!importPreview) return;
    setImportError(null);
    try {
      setIsInspectingCsv(true);
      // Filter out duplicate and invalid rows matching backend validation_status
      const validRows = importPreview.preview
        .filter((r) => r.validation_status === "VALID")
        .map((r) => ({
          name: r.name,
          phone: r.phone,
          email: r.email || null,
          city: r.city || "Alappuzha",
          delivery_address: r.delivery_address || null,
          source_channel: r.source_channel || "INSTAGRAM",
          notes: r.notes || null,
        }));

      if (validRows.length === 0) {
        setImportError("No valid unique rows to import.");
        setIsInspectingCsv(false);
        return;
      }

      const res = await apiClient.post("/customers/import", { rows: validRows });
      const summary = res.data?.data;
      setImportSuccessMessage(
        `Successfully imported ${summary?.imported_count ?? validRows.length} customers. ${
          summary?.skipped_count ?? 0
        } duplicates/invalid rows skipped.`
      );
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setImportPreview(null);
      setCsvContent("");
    } catch (err: any) {
      setImportError(getApiErrorMessage(err, "Import execution failed."));
    } finally {
      setIsInspectingCsv(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      setImportPreview(null);
      setImportError(null);
      setImportSuccessMessage(null);
    };
    reader.readAsText(file);
  };

  const columns: Column<Customer>[] = [
    {
      header: "Code & Customer Name",
      cell: (row) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-3xs font-bold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
              {row.customer_code || `CUST-${String(row.id).padStart(5, "0")}`}
            </span>
            <span className="font-semibold text-stone-900">{row.name}</span>
          </div>
          {row.instagram_handle && (
            <p className="text-3xs text-rose-700 font-medium">{row.instagram_handle}</p>
          )}
        </div>
      ),
    },
    {
      header: "Contact Details",
      cell: (row) => (
        <div>
          <p className="font-mono text-stone-700 flex items-center gap-1">
            <Phone className="h-3 w-3 text-stone-400" />
            {row.phone}
          </p>
          {row.email && <p className="text-3xs text-stone-400">{row.email}</p>}
        </div>
      ),
    },
    {
      header: "Location",
      cell: (row) => (
        <span className="text-stone-600 flex items-center gap-1">
          <MapPin className="h-3 w-3 text-stone-400" />
          {row.city || "Alappuzha"}
        </span>
      ),
    },
    {
      header: "Orders",
      cell: (row) => (
        <span className="font-semibold text-stone-800 bg-stone-50 px-2 py-0.5 rounded border border-stone-200/60">
          {row.orders_count ?? 0}
        </span>
      ),
    },
    {
      header: "Lifetime Value",
      cell: (row) => (
        <span className="font-bold text-stone-900">
          {formatCurrency(row.lifetime_spend || 0)}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (row) => <StatusBadge status={row.status || "ACTIVE"} size="sm" />,
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setSelectedCustomerId(row.id)}
            className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-colors"
            title="View Details"
          >
            <FileText className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openEditModal(row)}
            className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-colors"
            title="Edit Profile"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer CRM"
        description="Centralized contact profiles, gift preferences, delivery addresses, and repeat histories with phone duplicate detection."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCsvContent("");
                setImportPreview(null);
                setImportError(null);
                setImportSuccessMessage(null);
                setIsImportOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E1D8] bg-white px-3.5 py-2 text-xs font-medium text-[#34312F] shadow-soft hover:bg-[#F7F4F0] transition-colors"
            >
              <Upload className="h-3.5 w-3.5 text-[#817872]" />
              <span>Import CSV</span>
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#34312F] px-4 py-2 text-xs font-medium text-white shadow-soft hover:bg-[#1F1D1C] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Customer</span>
            </button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by customer name, phone, code..."
        />
        <div className="flex items-center gap-2">
          <FilterDropdown
            label="Status"
            selectedValue={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: "All Statuses", value: "ALL" },
              { label: "Active", value: "ACTIVE" },
              { label: "Inactive", value: "INACTIVE" },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading verified customer profiles..." />
      ) : isError ? (
        <ErrorState
          title="Could not load customers"
          message={(error as any)?.message || "Failed to communicate with Laravel CRM service."}
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          data={customers}
          columns={columns}
          onRowClick={(cust) => setSelectedCustomerId(cust.id)}
          emptyTitle="No customer profiles found"
          emptyMessage="No customer records match your filter criteria or search query."
        />
      )}

      {/* CUSTOMER DETAILS DRAWER */}
      {selectedCustomerId && (
        <DetailDrawer
          isOpen={!!selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          title={
            customerDetails
              ? customerDetails.name
              : "Customer Profile"
          }
          subtitle={customerDetails ? (customerDetails.customer_code || `CUST-${customerDetails.id}`) : undefined}
          badge={customerDetails && <StatusBadge status={customerDetails.status || "ACTIVE"} size="sm" />}
          width="lg"
          footer={
            customerDetails && (
              <div className="flex items-center justify-end gap-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    const c = customerDetails;
                    setSelectedCustomerId(null);
                    openEditModal(c);
                  }}
                  className="rounded-xl border border-[#E7E1D8] px-4 py-2 text-xs font-medium text-[#34312F] hover:bg-[#F7F4F0] transition-colors"
                >
                  Edit Customer Profile
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId(null)}
                  className="rounded-xl bg-[#34312F] px-4 py-2 text-xs font-medium text-white hover:bg-[#1F1D1C] transition-colors shadow-soft"
                >
                  Close Drawer
                </button>
              </div>
            )
          }
        >
          {isDetailsLoading || !customerDetails ? (
            <div className="py-8">
              <LoadingState message="Fetching client details and order histories..." />
            </div>
          ) : (
            <div className="space-y-6 text-xs">
              {/* Profile Overview Card */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200/70 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-stone-900">{customerDetails.name}</h4>
                      <StatusBadge status={customerDetails.status || "ACTIVE"} size="sm" />
                    </div>
                    <span className="font-mono text-3xs font-semibold text-stone-500">
                      ID: {customerDetails.customer_code || `CUST-${String(customerDetails.id).padStart(5, "0")}`}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-3xs uppercase tracking-wider text-stone-400 font-semibold">
                      Lifetime Spend
                    </p>
                    <p className="text-sm font-bold text-rose-800">
                      {formatCurrency(customerDetails.lifetime_spend || 0)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-stone-600">
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 font-mono text-stone-800">
                      <Phone className="h-3.5 w-3.5 text-stone-400" />
                      {customerDetails.phone}
                    </p>
                    {customerDetails.email && (
                      <p className="text-stone-500">{customerDetails.email}</p>
                    )}
                    {customerDetails.instagram_handle && (
                      <p className="text-rose-700 flex items-center gap-1 font-medium">
                        <Instagram className="h-3.5 w-3.5" />
                        {customerDetails.instagram_handle}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 text-stone-700">
                      <MapPin className="h-3.5 w-3.5 text-stone-400" />
                      {customerDetails.city || "Alappuzha"}
                    </p>
                    {customerDetails.delivery_address && (
                      <p className="text-stone-500 text-2xs leading-relaxed bg-white p-2 rounded border border-stone-200/50">
                        {customerDetails.delivery_address}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Purchase History Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-stone-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <ShoppingBag className="h-3.5 w-3.5 text-stone-500" />
                    Purchase History ({customerDetails.orders?.length || 0})
                  </h5>
                  <span className="text-3xs text-stone-500 italic">
                    Historical imported records are distinguished from live orders.
                  </span>
                </div>

                {customerDetails.orders && customerDetails.orders.length > 0 ? (
                  <div className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white overflow-hidden">
                    {customerDetails.orders.map((order: any) => (
                      <div
                        key={order.id}
                        className="flex flex-wrap items-center justify-between p-3 gap-2 hover:bg-stone-50"
                      >
                        <div>
                          <p className="font-mono font-semibold text-stone-900">
                            {order.order_number}
                          </p>
                          <p className="text-3xs text-stone-400">
                            {new Date(order.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={order.status} size="sm" />
                          <div className="text-right">
                            <p className="font-bold text-stone-900">
                              {formatCurrency(order.total_amount)}
                            </p>
                            <p
                              className={`text-3xs font-medium ${
                                order.balance_amount > 0 ? "text-amber-700" : "text-emerald-700"
                              }`}
                            >
                              Balance: {formatCurrency(order.balance_amount)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-stone-50 border border-stone-200/60 text-center text-stone-500">
                    No confirmed orders recorded for this customer profile yet.
                  </div>
                )}
              </div>

              {/* Internal Notes History */}
              <div className="space-y-3">
                <h5 className="font-bold text-stone-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5 text-stone-500" />
                  Internal Notes & Preferences
                </h5>

                {/* New note input */}
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add an internal note (e.g., Prefers ivory packaging, gifted to sister)..."
                    className="flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs focus:outline-rose-600"
                  />
                  <button
                    type="submit"
                    disabled={isAddingNote || !newNote.trim()}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-700 px-3 py-1.5 text-white font-semibold disabled:opacity-50 hover:bg-rose-800"
                  >
                    {isAddingNote ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>Add</span>
                  </button>
                </form>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {customerDetails.notes_history && customerDetails.notes_history.length > 0 ? (
                    customerDetails.notes_history.map((noteItem) => (
                      <div
                        key={noteItem.id}
                        className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/60 text-xs"
                      >
                        <p className="text-stone-800">{noteItem.note}</p>
                        <p className="text-3xs text-stone-400 mt-1 flex items-center justify-between">
                          <span>Recorded by {noteItem.user?.name || "Team Member"}</span>
                          <span>{new Date(noteItem.created_at).toLocaleString("en-IN")}</span>
                        </p>
                      </div>
                    ))
                  ) : customerDetails.notes ? (
                    <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/60 text-xs">
                      <p className="text-stone-800">{customerDetails.notes}</p>
                      <p className="text-3xs text-stone-400 mt-1">Initial Profile Note</p>
                    </div>
                  ) : (
                    <p className="text-stone-400 italic">No notes recorded yet.</p>
                  )}
                </div>
              </div>

            </div>
          )}
        </DetailDrawer>
      )}

      {/* ADD / EDIT CUSTOMER DIALOG */}
      {(isAddOpen || isEditOpen) && (
        <FormDialog
          isOpen={isAddOpen || isEditOpen}
          onClose={() => {
            setIsAddOpen(false);
            setIsEditOpen(false);
            setEditingCustomer(null);
            resetForm();
          }}
          title={editingCustomer ? `Edit Customer: ${editingCustomer.name}` : "Add Customer Profile"}
          description="Customer ID is generated automatically. Duplicate phone numbers are prevented."
          maxWidth="md"
        >
          <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
            {formError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-2xs font-medium">{formError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sandra Thomas"
                  className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs focus:outline-rose-600"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                  Phone Number (WhatsApp) *
                </label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+91 98470 54321"
                  className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs focus:outline-rose-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="sandra@example.com"
                  className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs focus:outline-rose-600"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                  Source Channel
                </label>
                <select
                  value={formChannel}
                  onChange={(e) => setFormChannel(e.target.value as LeadSource)}
                  className="w-full h-9 rounded-lg border border-stone-200 px-2 text-xs focus:outline-rose-600 bg-white"
                >
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="REFERRAL">Referral / Word of mouth</option>
                  <option value="DIRECT">Direct Contact / Walk-in</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                  Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                  className="w-full h-9 rounded-lg border border-stone-200 px-2 text-xs focus:outline-rose-600 bg-white"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                  City / Town
                </label>
                <input
                  type="text"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="Alappuzha, Kochi, Trivandrum..."
                  className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs focus:outline-rose-600"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                  Delivery Address
                </label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Door/House #, Street name, PIN code..."
                  className="w-full rounded-lg border border-stone-200 p-2 text-xs focus:outline-rose-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Initial Notes & Preferences
              </label>
              <textarea
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Gift preferences, anniversary, occasion dates..."
                className="w-full rounded-lg border border-stone-200 p-2 text-xs focus:outline-rose-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setIsEditOpen(false);
                  setEditingCustomer(null);
                  resetForm();
                }}
                className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-stone-700 hover:bg-stone-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createCustomerMutation.isPending || updateCustomerMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-4 py-1.5 text-white font-semibold hover:bg-rose-800 disabled:opacity-50"
              >
                {(createCustomerMutation.isPending || updateCustomerMutation.isPending) && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>{editingCustomer ? "Update Profile" : "Save Customer"}</span>
              </button>
            </div>
          </form>
        </FormDialog>
      )}

      {/* CSV IMPORT MODAL */}
      {isImportOpen && (
        <FormDialog
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          title="Import Customers from CSV"
          description="Bulk import historical customer contact directories with automatic duplicate detection."
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Historical Import Compliance Alert */}
            <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 p-3.5 text-amber-900 border border-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-2xs">CRM Data Integrity Rule</p>
                <p className="text-3xs text-amber-800 leading-relaxed">
                  Imported historical customer records are imported for contact retention and are
                  <strong> not automatically treated as verified financial purchases</strong>. Verified
                  revenue is recorded exclusively through confirmed orders and verified receipts.
                </p>
              </div>
            </div>

            {importError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-2xs font-medium">{importError}</p>
              </div>
            )}

            {importSuccessMessage && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <p className="text-2xs font-medium">{importSuccessMessage}</p>
              </div>
            )}

            {!importPreview ? (
              <div className="space-y-3">
                <div className="rounded-lg border-2 border-dashed border-stone-200 p-4 text-center hover:bg-stone-50 transition-colors">
                  <Upload className="h-6 w-6 text-stone-400 mx-auto mb-1.5" />
                  <p className="font-semibold text-stone-700">Select CSV file from device</p>
                  <p className="text-3xs text-stone-400 mb-2">Supported columns: name, phone, email, city, address, notes</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="text-2xs text-stone-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-2xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                    Or Paste CSV Data Directly
                  </label>
                  <textarea
                    rows={6}
                    value={csvContent}
                    onChange={(e) => setCsvContent(e.target.value)}
                    placeholder={`name,phone,email,city\nSandra Thomas,+91 98470 54321,sandra@gmail.com,Alappuzha\nVivek Anand,+91 94950 11223,vivek@yahoo.com,Kochi`}
                    className="w-full font-mono text-2xs rounded-lg border border-stone-200 p-2.5 focus:outline-rose-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsImportOpen(false)}
                    className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-stone-700 hover:bg-stone-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleInspectCsv}
                    disabled={isInspectingCsv || !csvContent.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-4 py-1.5 text-white font-semibold hover:bg-rose-800 disabled:opacity-50"
                  >
                    {isInspectingCsv && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Preview & Validate Duplicates</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-xl bg-[#F7F4F0] border border-[#E7E1D8]">
                    <p className="text-3xs text-[#817872] uppercase font-semibold">Total Rows</p>
                    <p className="text-base font-bold text-[#34312F]">
                      {importPreview.total_rows}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#EAF0E8] border border-[#D1E0CE]">
                    <p className="text-3xs text-[#475E42] uppercase font-semibold">Valid & Ready</p>
                    <p className="text-base font-bold text-[#475E42]">
                      {importPreview.valid_count}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAF0E6] border border-[#F0DDC7]">
                    <p className="text-3xs text-[#8C6239] uppercase font-semibold">
                      Duplicates
                    </p>
                    <p className="text-base font-bold text-[#8C6239]">
                      {importPreview.duplicate_count}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAECEB] border border-[#F2D0CE]">
                    <p className="text-3xs text-[#8F352A] uppercase font-semibold">Invalid Rows</p>
                    <p className="text-base font-bold text-[#8F352A]">
                      {importPreview.invalid_count}
                    </p>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="max-h-56 overflow-y-auto rounded-xl border border-[#E7E1D8]">
                  <table className="w-full text-left text-2xs">
                    <thead className="bg-[#FDFBF7] text-[#817872] border-b border-[#E7E1D8] sticky top-0">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Phone</th>
                        <th className="p-2">City</th>
                        <th className="p-2">Validation Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0ECE7]">
                      {importPreview.preview.map((row) => (
                        <tr key={row.row_number} className="hover:bg-[#FDFBF7]">
                          <td className="p-2 font-mono text-[#817872]">{row.row_number}</td>
                          <td className="p-2 font-semibold text-[#34312F]">{row.name}</td>
                          <td className="p-2 font-mono text-[#6B635B]">{row.phone}</td>
                          <td className="p-2 text-[#817872]">{row.city || "Alappuzha"}</td>
                          <td className="p-2">
                            {row.validation_status === "VALID" ? (
                              <span className="inline-flex items-center gap-1 text-[#475E42] font-semibold bg-[#EAF0E8] px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="h-3 w-3" />
                                Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[#8C6239] font-semibold bg-[#FAF0E6] px-2 py-0.5 rounded-full">
                                <AlertTriangle className="h-3 w-3" />
                                {row.error || row.validation_status}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-[#F0ECE7]">
                  <button
                    type="button"
                    onClick={() => setImportPreview(null)}
                    className="rounded-xl border border-[#E7E1D8] px-3.5 py-1.5 text-[#34312F] hover:bg-[#F7F4F0] font-medium"
                  >
                    Back to Edit CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isInspectingCsv || importPreview.valid_count === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#34312F] px-4 py-1.5 text-white font-semibold hover:bg-[#1F1D1C] disabled:opacity-50"
                  >
                    {isInspectingCsv && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Confirm Import ({importPreview.valid_count} Records)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </FormDialog>
      )}
    </div>
  );
}
