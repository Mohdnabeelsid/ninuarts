import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Receipt,
  IndianRupee,
  Building2,
  Upload,
  Edit,
  Trash2,
  Eye,
  Tag,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { DataTable, Column } from "../components/shared/DataTable";
import { SearchInput } from "../components/shared/SearchInput";
import { FilterDropdown } from "../components/shared/FilterDropdown";
import { FormDialog } from "../components/shared/FormDialog";
import { DetailDrawer } from "../components/shared/DetailDrawer";
import { ConfirmationDialog } from "../components/shared/ConfirmationDialog";
import { StatCard } from "../components/shared/StatCard";
import { LoadingState } from "../components/shared/LoadingState";
import { ErrorState } from "../components/shared/ErrorState";
import { EmptyState } from "../components/shared/EmptyState";
import { formatCurrency, formatDate, getApiErrorMessage } from "../lib/utils";
import { apiClient } from "../lib/api";
import { Expense, ExpenseCategory, PaymentMethod, VendorEntity } from "../types";
import { useActivePeriod } from "../contexts/ActivePeriodContext";
import { useDashboardSearch } from "../layouts/DashboardLayout";

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const { activePeriod } = useActivePeriod();
  const globalSearch = useDashboardSearch();

  // Filters state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Modal & Drawer states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Form State
  const [formCategory, setFormCategory] = useState<string>("MATERIALS");
  const [customCategory, setCustomCategory] = useState<string>("");
  const [formAmount, setFormAmount] = useState<string>("");
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formMethod, setFormMethod] = useState<PaymentMethod>("UPI");
  const [formVendorId, setFormVendorId] = useState<number | "">("");
  const [formVendor, setFormVendor] = useState<string>("");
  const [formBillRef, setFormBillRef] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formAttachment, setFormAttachment] = useState<string>("");
  const [uploadingReceipt, setUploadingReceipt] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>("");

  // 1. Fetch Categories & Active Vendors
  const { data: categories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const res = await apiClient.get("/expenses/categories");
      return res.data?.data || [];
    },
  });

  const { data: activeVendors = [] } = useQuery<VendorEntity[]>({
    queryKey: ["vendors", "active-lookup"],
    queryFn: async () => {
      const res = await apiClient.get("/vendors?is_active=true");
      return res.data?.data || [];
    },
  });

  // 2. Fetch Expenses with query params and global active period
  const effectiveSearch = search || globalSearch;
  const { data: expenseData, isLoading, isError, refetch } = useQuery({
    queryKey: ["expenses", activePeriod.formatted, { effectiveSearch, categoryFilter, methodFilter, fromDate, toDate }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveSearch) params.append("search", effectiveSearch);
      if (categoryFilter !== "ALL") params.append("category_code", categoryFilter);
      if (methodFilter !== "ALL") params.append("payment_method", methodFilter);
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      params.append("per_page", "50");

      const res = await apiClient.get(`/expenses?${params.toString()}`);
      return {
        expenses: (res.data?.data || []) as Expense[],
        meta: res.data?.meta || {},
        summary: res.data?.meta?.summary || { total_amount: 0, expense_count: 0, category_breakdown: [] },
      };
    },
  });

  const expenses = expenseData?.expenses || [];
  const summary = expenseData?.summary || { total_amount: 0, expense_count: 0, category_breakdown: [] };

  // Receipt Upload Handler
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("receipt", file);

    setUploadingReceipt(true);
    setFormError("");
    try {
      const res = await apiClient.post("/expenses/upload-receipt", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.success && res.data?.data?.path) {
        setFormAttachment(res.data.data.path);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || "Failed to upload receipt.");
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.post("/expenses", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      closeForm();
    },
    onError: (err: any) => {
      setFormError(getApiErrorMessage(err, "Failed to record expense."));
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      return apiClient.put(`/expenses/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      closeForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error?.message || err.message || "Failed to update expense.");
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setDeletingId(null);
    },
  });

  const openAdd = () => {
    setEditingExpense(null);
    setFormCategory(categories[0]?.code || "MATERIALS");
    setCustomCategory("");
    setFormAmount("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormMethod("UPI");
    setFormVendorId("");
    setFormVendor("");
    setFormBillRef("");
    setFormDescription("");
    setFormNotes("");
    setFormAttachment("");
    setFormError("");
    setIsAddOpen(true);
  };

  const openEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setFormCategory(exp.category?.code || "OTHER");
    setCustomCategory("");
    setFormAmount(exp.amount.toString());
    setFormDate(exp.expense_date ? exp.expense_date.split("T")[0] : "");
    setFormMethod(exp.payment_method);
    setFormVendorId(exp.vendor_id || "");
    setFormVendor(exp.vendor_name || "");
    setFormBillRef(exp.bill_reference || "");
    setFormDescription(exp.description);
    setFormNotes(exp.notes || "");
    setFormAttachment(exp.attachment_path || "");
    setFormError("");
    setIsAddOpen(true);
  };

  const closeForm = () => {
    setIsAddOpen(false);
    setEditingExpense(null);
    setFormError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const parsedAmount = parseFloat(formAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Please enter a valid expense amount in INR.");
      return;
    }

    if (!formDescription.trim()) {
      setFormError("Please provide an expense description.");
      return;
    }

    // Resolve category id
    let catId: number | undefined;
    let customCatName: string | undefined;

    if (formCategory === "CUSTOM") {
      if (!customCategory.trim()) {
        setFormError("Please enter your custom category name.");
        return;
      }
      customCatName = customCategory.trim();
    } else {
      const match = categories.find((c) => c.code === formCategory);
      if (match) {
        catId = match.id;
      }
    }

    const payload = {
      category_id: catId,
      custom_category: customCatName,
      amount: parsedAmount,
      expense_date: formDate,
      payment_method: formMethod,
      vendor_id: formVendorId || null,
      vendor_name: formVendor.trim() || null,
      bill_reference: formBillRef.trim() || null,
      description: formDescription.trim(),
      notes: formNotes.trim() || null,
      attachment_path: formAttachment || null,
    };

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Table Columns
  const columns: Column<Expense>[] = [
    {
      header: "Date & Channel",
      cell: (exp: Expense) => (
        <div className="flex flex-col">
          <span className="font-medium text-[#34312F]">{formatDate(exp.expense_date)}</span>
          <span className="text-[10px] text-[#817872]">{exp.payment_method}</span>
        </div>
      ),
    },
    {
      header: "Category",
      cell: (exp: Expense) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F7F4F0] text-[#34312F] border border-[#E7E1D8]">
          <Tag className="w-3 h-3 text-[#7A4B43]" />
          {exp.category?.name || exp.category_name || "General"}
        </span>
      ),
    },
    {
      header: "Description & Vendor",
      cell: (exp: Expense) => (
        <div className="flex flex-col max-w-sm">
          <span className="font-medium text-[#34312F] truncate">{exp.description}</span>
          <div className="flex items-center gap-2 text-[10px] text-[#817872] mt-0.5">
            {exp.vendor_name && (
              <span className="flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5" />
                {exp.vendor_name}
              </span>
            )}
            {exp.bill_reference && (
              <span className="bg-[#F7F4F0] px-1.5 py-0.5 rounded border border-[#E7E1D8]">
                Ref: {exp.bill_reference}
              </span>
            )}
            {exp.attachment_path && (
              <span className="inline-flex items-center gap-0.5 text-[#7A4B43] font-medium">
                <Paperclip className="w-2.5 h-2.5" /> Receipt
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Amount (INR)",
      cell: (exp: Expense) => (
        <span className="font-serif text-[#34312F] text-sm">
          {formatCurrency(exp.amount)}
        </span>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (exp: Expense) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setViewingExpense(exp)}
            className="p-1.5 text-[#817872] hover:text-[#34312F] hover:bg-[#F7F4F0] rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => openEdit(exp)}
            className="p-1.5 text-[#817872] hover:text-[#7A4B43] hover:bg-[#F5ECE9] rounded-lg transition-colors"
            title="Edit Expense"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeletingId(exp.id)}
            className="p-1.5 text-[#817872] hover:text-[#8F352A] hover:bg-[#FAECEB] rounded-lg transition-colors"
            title="Delete Expense"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Expense Ledger"
        description="Comprehensive studio outflows, raw material acquisitions, courier overheads, and receipt attachments."
        actions={
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#34312F] hover:bg-[#1F1D1C] text-white rounded-xl text-xs font-medium shadow-soft transition-colors"
          >
            <Plus className="w-4 h-4" />
            Record Expense
          </button>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Operating Outflows"
          value={formatCurrency(summary.total_amount)}
          icon={IndianRupee}
          highlight={true}
          subtitle={`Across ${summary.expense_count} recorded expenses`}
        />
        <StatCard
          title="Top Expense Category"
          value={
            summary.category_breakdown?.length > 0
              ? summary.category_breakdown[0].name
              : "Materials"
          }
          icon={Tag}
          subtitle={
            summary.category_breakdown?.length > 0
              ? formatCurrency(summary.category_breakdown[0].total_amount)
              : "₹0.00"
          }
        />
        <StatCard
          title="Total Expense Vouchers"
          value={summary.expense_count.toString()}
          icon={Receipt}
          subtitle="Audit-verified entries"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-[#E7E1D8] shadow-card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px]">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by vendor, description, or bill ref..."
            />
          </div>

          <div className="w-44">
            <FilterDropdown
              label="Category"
              selectedValue={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: "ALL", label: "All Categories" },
                ...categories.map((c) => ({ value: c.code, label: c.name })),
              ]}
            />
          </div>

          <div className="w-40">
            <FilterDropdown
              label="Payment Method"
              selectedValue={methodFilter}
              onChange={setMethodFilter}
              options={[
                { value: "ALL", label: "All Methods" },
                { value: "UPI", label: "UPI" },
                { value: "BANK_TRANSFER", label: "Bank Transfer" },
                { value: "CASH", label: "Cash" },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F] text-[#34312F]"
              title="From Date"
            />
            <span className="text-xs text-[#817872]">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F] text-[#34312F]"
              title="To Date"
            />
          </div>

          {(search || categoryFilter !== "ALL" || methodFilter !== "ALL" || fromDate || toDate) && (
            <button
              onClick={() => {
                setSearch("");
                setCategoryFilter("ALL");
                setMethodFilter("ALL");
                setFromDate("");
                setToDate("");
              }}
              className="text-xs font-medium text-[#34312F] hover:text-[#817872] px-2 py-1 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Expense Table */}
      {isLoading ? (
        <LoadingState message="Loading operating expenses..." />
      ) : isError ? (
        <ErrorState message="Failed to load expense records." onRetry={() => refetch()} />
      ) : expenses.length === 0 ? (
        <EmptyState
          title="No expenses found"
          message="Record raw material purchases, printing costs, or courier charges to track business outflows."
          actionText="Record First Expense"
          onAction={openAdd}
        />
      ) : (
        <DataTable data={expenses} columns={columns} />
      )}

      {/* Create / Edit Expense Form Dialog */}
      <FormDialog
        isOpen={isAddOpen}
        onClose={closeForm}
        title={editingExpense ? `Edit Expense #${editingExpense.id}` : "Record Operating Outflow"}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3.5 rounded-xl bg-[#FAECEB] text-[#8F352A] text-xs flex items-center gap-2 border border-[#F2D0CE]">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#8F352A]" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Expense Category <span className="text-[#8F352A]">*</span>
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white focus:outline-[#34312F] font-medium text-[#34312F]"
                required
              >
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.code}>
                      {cat.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="MATERIALS">Materials</option>
                    <option value="PRINTING">Printing</option>
                    <option value="PACKAGING">Packaging</option>
                    <option value="COURIER">Courier</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="TRANSPORTATION">Transportation</option>
                    <option value="SOFTWARE">Software</option>
                    <option value="OTHER">Other</option>
                  </>
                )}
                <option value="CUSTOM">+ Create Custom Category</option>
              </select>
            </div>

            {/* Custom Category Input (if chosen) */}
            {formCategory === "CUSTOM" && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                  Custom Category Name <span className="text-[#8F352A]">*</span>
                </label>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Workshop Tools, Studio Rent"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
                  required
                />
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Amount (₹ INR) <span className="text-[#8F352A]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2 text-xs font-medium text-[#817872]">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="500.00"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F] font-serif"
                  required
                />
              </div>
            </div>

            {/* Expense Date */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Expense Date <span className="text-[#8F352A]">*</span>
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F] text-[#34312F]"
                required
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Payment Method <span className="text-[#8F352A]">*</span>
              </label>
              <select
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white focus:outline-[#34312F] font-medium text-[#34312F]"
                required
              >
                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT / IMPS)</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[#34312F] mb-1.5">
              Description <span className="text-[#8F352A]">*</span>
            </label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="e.g. 50 A4 wooden photo frames from Alappuzha Craft Store"
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Vendor Entity Picker + Name */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Vendor / Supplier Entity
              </label>
              {activeVendors.length > 0 && (
                <select
                  value={formVendorId}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : "";
                    setFormVendorId(id);
                    const matched = activeVendors.find((v) => v.id === id);
                    if (matched) {
                      setFormVendor(matched.name);
                      if (
                        !editingExpense &&
                        matched.default_category &&
                        categories.some((c) => c.code === matched.default_category)
                      ) {
                        setFormCategory(matched.default_category);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-[#FDFBF7] mb-2 focus:outline-[#34312F]"
                >
                  <option value="">-- Select registered vendor (optional) --</option>
                  {activeVendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.entity_type.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={formVendor}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormVendor(val);
                  if (formVendorId) {
                    const matched = activeVendors.find((v) => v.id === formVendorId);
                    if (!matched || matched.name.toLowerCase() !== val.trim().toLowerCase()) {
                      setFormVendorId("");
                    }
                  }
                }}
                placeholder="e.g. Kerala Glass & Frame Mart"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>

            {/* Bill / Invoice Reference */}
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1.5">
                Bill / Invoice Reference
              </label>
              <input
                type="text"
                value={formBillRef}
                onChange={(e) => setFormBillRef(e.target.value)}
                placeholder="e.g. INV-2026-904"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
          </div>

          {/* Receipt Attachment */}
          <div>
            <label className="block text-xs font-medium text-[#34312F] mb-1.5">
              Receipt Attachment (File or URL)
            </label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E7E1D8] bg-[#F7F4F0] hover:bg-[#F0ECE7] text-xs font-medium text-[#34312F] transition-colors">
                <Upload className="w-3.5 h-3.5" />
                {uploadingReceipt ? "Uploading..." : "Upload Receipt"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleReceiptUpload}
                  className="hidden"
                />
              </label>
              <input
                type="text"
                value={formAttachment}
                onChange={(e) => setFormAttachment(e.target.value)}
                placeholder="Or paste receipt file path / URL"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
            {formAttachment && (
              <span className="text-[10px] text-[#475E42] flex items-center gap-1 mt-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#8B9B86]" /> Attached: {formAttachment}
              </span>
            )}
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-xs font-medium text-[#34312F] mb-1.5">
              Internal Notes
            </label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Additional remarks or batch details..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F0ECE7]">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 text-xs font-medium text-[#6B635B] hover:text-[#34312F] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4.5 py-2 bg-[#34312F] hover:bg-[#1F1D1C] text-white rounded-xl text-xs font-medium shadow-soft disabled:opacity-50 transition-colors"
            >
              {editingExpense
                ? updateMutation.isPending
                  ? "Saving..."
                  : "Update Expense"
                : createMutation.isPending
                ? "Recording..."
                : "Confirm Expense"}
            </button>
          </div>
        </form>
      </FormDialog>

      {/* View Expense Details Drawer */}
      <DetailDrawer
        isOpen={!!viewingExpense}
        onClose={() => setViewingExpense(null)}
        title={viewingExpense ? `Expense #${viewingExpense.id}` : "Expense Details"}
        subtitle={viewingExpense ? formatDate(viewingExpense.expense_date) : undefined}
        badge={
          viewingExpense && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#E8D8D4] text-[#7A4B43]">
              {viewingExpense.category?.name || viewingExpense.category_name || "General"}
            </span>
          )
        }
        footer={
          viewingExpense && (
            <>
              <button
                type="button"
                onClick={() => {
                  const exp = viewingExpense;
                  setViewingExpense(null);
                  openEdit(exp);
                }}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-[#E7E1D8] text-[#34312F] hover:bg-[#F7F4F0] transition-colors"
              >
                Edit Expense
              </button>
              <button
                type="button"
                onClick={() => setViewingExpense(null)}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-[#34312F] text-white hover:bg-[#1F1D1C] transition-colors shadow-soft"
              >
                Close Drawer
              </button>
            </>
          )
        }
      >
        {viewingExpense && (
          <div className="space-y-6">
            <div className="p-4.5 rounded-2xl bg-[#F7F4F0] border border-[#E7E1D8] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#817872]">
                  Total Outflow Amount
                </span>
                <div className="text-3xl font-serif text-[#34312F] mt-0.5">
                  {formatCurrency(viewingExpense.amount)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#817872]">
                  Method
                </span>
                <div className="text-xs font-medium text-[#34312F] mt-0.5">
                  {viewingExpense.payment_method}
                </div>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Recorded Date</span>
                <span className="font-medium text-[#34312F]">{formatDate(viewingExpense.expense_date)}</span>
              </div>
              {viewingExpense.vendor_name && (
                <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                  <span className="text-[#817872]">Vendor / Supplier</span>
                  <span className="font-medium text-[#34312F]">{viewingExpense.vendor_name}</span>
                </div>
              )}
              {viewingExpense.bill_reference && (
                <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                  <span className="text-[#817872]">Invoice / Bill Reference</span>
                  <span className="font-medium text-[#34312F]">{viewingExpense.bill_reference}</span>
                </div>
              )}
              <div className="pt-2">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#817872] block mb-1.5">
                  Description
                </span>
                <p className="p-3.5 rounded-xl bg-[#FDFBF7] text-[#34312F] border border-[#E7E1D8] leading-relaxed">
                  {viewingExpense.description}
                </p>
              </div>
              {viewingExpense.notes && (
                <div className="pt-2">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-[#817872] block mb-1.5">
                    Internal Studio Remarks
                  </span>
                  <p className="p-3.5 rounded-xl bg-[#FDFBF7] text-[#6B635B] border border-[#E7E1D8] leading-relaxed">
                    {viewingExpense.notes}
                  </p>
                </div>
              )}
              {viewingExpense.attachment_path && (
                <div className="pt-2">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-[#817872] block mb-1.5">
                    Verified Receipt Attachment
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const path = viewingExpense.attachment_path!;
                      if (path.startsWith("http")) {
                        window.open(path, "_blank", "noopener,noreferrer");
                        return;
                      }
                      try {
                        const relPath = path.replace(/^\/api\/v1/, "");
                        const res = await apiClient.get(relPath, { responseType: "blob" });
                        const blobUrl = URL.createObjectURL(res.data);
                        window.open(blobUrl, "_blank", "noopener,noreferrer");
                      } catch {
                        alert("Unable to load private receipt file.");
                      }
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E7E1D8] text-xs font-medium text-[#34312F] hover:bg-[#F7F4F0] transition-colors shadow-soft"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#817872]" /> View Uploaded Receipt Voucher
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
        title="Delete Expense Record"
        message="Are you sure you want to delete this expense record? This will adjust financial statements and log an audit trail entry."
        confirmText={deleteMutation.isPending ? "Deleting..." : "Delete Record"}
        variant="danger"
      />
    </div>
  );
}
