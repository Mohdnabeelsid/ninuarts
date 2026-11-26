import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Briefcase,
  Truck,
  IndianRupee,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Star,
  MapPin,
  Phone,
  Mail,
  Landmark,
  CheckCircle2,
  AlertCircle,
  Power,
  FileText,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { StatCard } from "../components/shared/StatCard";
import { DataTable, Column } from "../components/shared/DataTable";
import { SearchInput } from "../components/shared/SearchInput";
import { FilterDropdown } from "../components/shared/FilterDropdown";
import { FormDialog } from "../components/shared/FormDialog";
import { DetailDrawer } from "../components/shared/DetailDrawer";
import { ConfirmationDialog } from "../components/shared/ConfirmationDialog";
import { StatusBadge } from "../components/shared/StatusBadge";
import { LoadingState } from "../components/shared/LoadingState";
import { ErrorState } from "../components/shared/ErrorState";
import { EmptyState } from "../components/shared/EmptyState";
import { formatCurrency, formatDate, getApiErrorMessage } from "../lib/utils";
import { apiClient } from "../lib/api";
import {
  ActivityLog,
  BusinessEntity,
  BusinessEntityType,
  Delivery,
  Expense,
  PaymentTermsType,
  VendorEntity,
  VendorEntityType,
} from "../types";
import { useDashboardSearch } from "../layouts/DashboardLayout";

type ActiveTab = "VENDORS" | "STUDIO_ENTITIES";

const PAYMENT_TERM_LABELS: Record<PaymentTermsType, string> = {
  IMMEDIATE: "Immediate",
  NET_7: "Net 7 Days",
  NET_15: "Net 15 Days",
  NET_30: "Net 30 Days",
  ADVANCE: "Advance Required",
};

export function EntityManagementPage() {
  const queryClient = useQueryClient();
  const globalSearch = useDashboardSearch();

  const [activeTab, setActiveTab] = useState<ActiveTab>("VENDORS");
  const [search, setSearch] = useState("");
  const [vendorTypeFilter, setVendorTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Vendor Modals & Drawers
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorEntity | null>(null);
  const [viewingVendorId, setViewingVendorId] = useState<number | null>(null);
  const [deletingVendor, setDeletingVendor] = useState<VendorEntity | null>(null);

  // Business Entity Modals & Drawers
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<BusinessEntity | null>(null);
  const [viewingBusinessId, setViewingBusinessId] = useState<number | null>(null);
  const [deletingBusiness, setDeletingBusiness] = useState<BusinessEntity | null>(null);

  // Vendor Form States
  const [vName, setVName] = useState("");
  const [vCode, setVCode] = useState("");
  const [vType, setVType] = useState<VendorEntityType>("SUPPLIER");
  const [vContactPerson, setVContactPerson] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vCity, setVCity] = useState("");
  const [vAddress, setVAddress] = useState("");
  const [vGstin, setVGstin] = useState("");
  const [vUpiId, setVUpiId] = useState("");
  const [vPaymentTerms, setVPaymentTerms] = useState<PaymentTermsType>("IMMEDIATE");
  const [vDefaultCategory, setVDefaultCategory] = useState("MATERIALS");
  const [vTrackingTemplate, setVTrackingTemplate] = useState("");
  const [vNotes, setVNotes] = useState("");
  const [vIsActive, setVIsActive] = useState(true);
  const [vendorFormError, setVendorFormError] = useState("");

  // Business Entity Form States
  const [bName, setBName] = useState("");
  const [bLegalName, setBLegalName] = useState("");
  const [bCode, setBCode] = useState("");
  const [bType, setBType] = useState<BusinessEntityType>("STUDIO");
  const [bGstin, setBGstin] = useState("");
  const [bPan, setBPan] = useState("");
  const [bEmail, setBEmail] = useState("");
  const [bPhone, setBPhone] = useState("");
  const [bAddress, setBAddress] = useState("");
  const [bCity, setBCity] = useState("");
  const [bState, setBState] = useState("Kerala");
  const [bPincode, setBPincode] = useState("");
  const [bUpiId, setBUpiId] = useState("");
  const [bBankName, setBBankName] = useState("");
  const [bBankAccount, setBBankAccount] = useState("");
  const [bBankIfsc, setBBankIfsc] = useState("");
  const [bIsPrimary, setBIsPrimary] = useState(false);
  const [bIsActive, setBIsActive] = useState(true);
  const [bNotes, setBNotes] = useState("");
  const [businessFormError, setBusinessFormError] = useState("");
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const effectiveSearch = search || globalSearch;

  // Fetch Business Entities
  const {
    data: businessResp,
    isLoading: isLoadingBusiness,
    isError: isErrorBusiness,
    refetch: refetchBusiness,
  } = useQuery({
    queryKey: ["business-entities", effectiveSearch, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveSearch) params.append("search", effectiveSearch);
      if (statusFilter === "ACTIVE") params.append("is_active", "true");
      if (statusFilter === "INACTIVE") params.append("is_active", "false");
      const res = await apiClient.get(`/business-entities?${params.toString()}`);
      return {
        entities: (res.data?.data || []) as BusinessEntity[],
        meta: res.data?.meta || { total: 0, active_count: 0 },
      };
    },
  });

  // Fetch Vendors Directory
  const {
    data: vendorResp,
    isLoading: isLoadingVendors,
    isError: isErrorVendors,
    refetch: refetchVendors,
  } = useQuery({
    queryKey: ["vendors", effectiveSearch, vendorTypeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveSearch) params.append("search", effectiveSearch);
      if (vendorTypeFilter !== "ALL") params.append("entity_type", vendorTypeFilter);
      if (statusFilter === "ACTIVE") params.append("is_active", "true");
      if (statusFilter === "INACTIVE") params.append("is_active", "false");
      const res = await apiClient.get(`/vendors?${params.toString()}`);
      return {
        vendors: (res.data?.data || []) as VendorEntity[],
        meta: res.data?.meta || {
          total: 0,
          active_count: 0,
          suppliers_count: 0,
          couriers_count: 0,
          total_tracked_spend: 0,
        },
      };
    },
  });

  // Fetch Single Vendor Details
  const { data: vendorDetail, isLoading: isLoadingVendorDetail } = useQuery({
    queryKey: ["vendor-detail", viewingVendorId],
    enabled: viewingVendorId !== null,
    queryFn: async () => {
      const res = await apiClient.get(`/vendors/${viewingVendorId}`);
      return res.data?.data as {
        vendor: VendorEntity;
        stats: { total_spent: number; expense_count: number; delivery_count: number };
        recent_expenses: Expense[];
        recent_deliveries: Delivery[];
        audit_trail: ActivityLog[];
      };
    },
  });

  // Fetch Single Business Entity Details
  const { data: businessDetail, isLoading: isLoadingBusinessDetail } = useQuery({
    queryKey: ["business-entity-detail", viewingBusinessId],
    enabled: viewingBusinessId !== null,
    queryFn: async () => {
      const res = await apiClient.get(`/business-entities/${viewingBusinessId}`);
      return res.data?.data as {
        entity: BusinessEntity;
        audit_trail: ActivityLog[];
      };
    },
  });

  const businessEntities = businessResp?.entities || [];
  const businessMeta = businessResp?.meta || { total: 0, active_count: 0 };
  const vendors = vendorResp?.vendors || [];
  const vendorMeta = vendorResp?.meta || {
    total: 0,
    active_count: 0,
    suppliers_count: 0,
    couriers_count: 0,
    total_tracked_spend: 0,
  };

  // Vendor Mutations
  const saveVendorMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingVendor) {
        return apiClient.put(`/vendors/${editingVendor.id}`, payload);
      }
      return apiClient.post("/vendors", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-detail"] });
      closeVendorModal();
      setActionFeedback({
        type: "success",
        message: editingVendor ? "Vendor entity updated." : "New vendor entity registered.",
      });
    },
    onError: (err: any) => {
      setVendorFormError(getApiErrorMessage(err, "Failed to save vendor entity."));
    },
  });

  const toggleVendorActiveMutation = useMutation({
    mutationFn: async (vendor: VendorEntity) => {
      return apiClient.put(`/vendors/${vendor.id}`, { is_active: !vendor.is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-detail"] });
    },
    onError: (err: any) => {
      setActionFeedback({
        type: "error",
        message: getApiErrorMessage(err, "Unable to update vendor status."),
      });
    },
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setDeletingVendor(null);
      setActionFeedback({ type: "success", message: "Vendor entity deleted." });
    },
    onError: (err: any) => {
      setDeletingVendor(null);
      setActionFeedback({
        type: "error",
        message: getApiErrorMessage(err, "Unable to delete vendor entity."),
      });
    },
  });

  // Business Entity Mutations
  const saveBusinessMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingBusiness) {
        return apiClient.put(`/business-entities/${editingBusiness.id}`, payload);
      }
      return apiClient.post("/business-entities", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-entities"] });
      queryClient.invalidateQueries({ queryKey: ["business-entity-detail"] });
      closeBusinessModal();
      setActionFeedback({
        type: "success",
        message: editingBusiness ? "Business entity updated." : "New business entity added.",
      });
    },
    onError: (err: any) => {
      setBusinessFormError(getApiErrorMessage(err, "Failed to save business entity."));
    },
  });

  const promotePrimaryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.put(`/business-entities/${id}`, { is_primary: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-entities"] });
      setActionFeedback({ type: "success", message: "Primary studio entity updated." });
    },
    onError: (err: any) => {
      setActionFeedback({
        type: "error",
        message: getApiErrorMessage(err, "Unable to update primary studio entity."),
      });
    },
  });

  const deleteBusinessMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/business-entities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-entities"] });
      setDeletingBusiness(null);
      setActionFeedback({ type: "success", message: "Business entity removed." });
    },
    onError: (err: any) => {
      setDeletingBusiness(null);
      setActionFeedback({
        type: "error",
        message: getApiErrorMessage(err, "Unable to delete business entity."),
      });
    },
  });

  // Vendor Form Helpers
  const openAddVendor = () => {
    setEditingVendor(null);
    setVName("");
    setVCode("");
    setVType("SUPPLIER");
    setVContactPerson("");
    setVPhone("");
    setVEmail("");
    setVCity("");
    setVAddress("");
    setVGstin("");
    setVUpiId("");
    setVPaymentTerms("IMMEDIATE");
    setVDefaultCategory("MATERIALS");
    setVTrackingTemplate("");
    setVNotes("");
    setVIsActive(true);
    setVendorFormError("");
    setIsVendorModalOpen(true);
  };

  const openEditVendor = (vendor: VendorEntity) => {
    setEditingVendor(vendor);
    setVName(vendor.name);
    setVCode(vendor.code);
    setVType(vendor.entity_type);
    setVContactPerson(vendor.contact_person || "");
    setVPhone(vendor.phone || "");
    setVEmail(vendor.email || "");
    setVCity(vendor.city || "");
    setVAddress(vendor.address || "");
    setVGstin(vendor.gstin || "");
    setVUpiId(vendor.upi_id || "");
    setVPaymentTerms(vendor.payment_terms || "IMMEDIATE");
    setVDefaultCategory(vendor.default_category || "");
    setVTrackingTemplate(vendor.tracking_url_template || "");
    setVNotes(vendor.notes || "");
    setVIsActive(vendor.is_active);
    setVendorFormError("");
    setIsVendorModalOpen(true);
  };

  const closeVendorModal = () => {
    setIsVendorModalOpen(false);
    setEditingVendor(null);
    setVendorFormError("");
  };

  const handleVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim()) {
      setVendorFormError("Entity name is required.");
      return;
    }

    saveVendorMutation.mutate({
      name: vName.trim(),
      ...(vCode.trim() ? { code: vCode.trim() } : {}),
      entity_type: vType,
      contact_person: vContactPerson.trim() || null,
      phone: vPhone.trim() || null,
      email: vEmail.trim() || null,
      city: vCity.trim() || null,
      address: vAddress.trim() || null,
      gstin: vGstin.trim() || null,
      upi_id: vUpiId.trim() || null,
      payment_terms: vPaymentTerms,
      default_category: vDefaultCategory.trim() || null,
      tracking_url_template: vTrackingTemplate.trim() || null,
      is_active: vIsActive,
      notes: vNotes.trim() || null,
    });
  };

  // Business Entity Form Helpers
  const openAddBusiness = () => {
    setEditingBusiness(null);
    setBName("");
    setBLegalName("");
    setBCode("");
    setBType("BRANCH");
    setBGstin("");
    setBPan("");
    setBEmail("");
    setBPhone("");
    setBAddress("");
    setBCity("Alappuzha");
    setBState("Kerala");
    setBPincode("");
    setBUpiId("");
    setBBankName("");
    setBBankAccount("");
    setBBankIfsc("");
    setBIsPrimary(false);
    setBIsActive(true);
    setBNotes("");
    setBusinessFormError("");
    setIsBusinessModalOpen(true);
  };

  const openEditBusiness = (entity: BusinessEntity) => {
    setEditingBusiness(entity);
    setBName(entity.name);
    setBLegalName(entity.legal_name || "");
    setBCode(entity.code);
    setBType(entity.entity_type);
    setBGstin(entity.gstin || "");
    setBPan(entity.pan || "");
    setBEmail(entity.email || "");
    setBPhone(entity.phone || "");
    setBAddress(entity.address || "");
    setBCity(entity.city || "");
    setBState(entity.state || "");
    setBPincode(entity.pincode || "");
    setBUpiId(entity.upi_id || "");
    setBBankName(entity.bank_name || "");
    setBBankAccount(entity.bank_account_number || "");
    setBBankIfsc(entity.bank_ifsc || "");
    setBIsPrimary(entity.is_primary);
    setBIsActive(entity.is_active);
    setBNotes(entity.notes || "");
    setBusinessFormError("");
    setIsBusinessModalOpen(true);
  };

  const closeBusinessModal = () => {
    setIsBusinessModalOpen(false);
    setEditingBusiness(null);
    setBusinessFormError("");
  };

  const handleBusinessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName.trim()) {
      setBusinessFormError("Entity display name is required.");
      return;
    }

    saveBusinessMutation.mutate({
      name: bName.trim(),
      legal_name: bLegalName.trim() || null,
      ...(bCode.trim() ? { code: bCode.trim() } : {}),
      entity_type: bType,
      gstin: bGstin.trim() || null,
      pan: bPan.trim() || null,
      email: bEmail.trim() || null,
      phone: bPhone.trim() || null,
      address: bAddress.trim() || null,
      city: bCity.trim() || null,
      state: bState.trim() || null,
      pincode: bPincode.trim() || null,
      upi_id: bUpiId.trim() || null,
      bank_name: bBankName.trim() || null,
      bank_account_number: bBankAccount.trim() || null,
      bank_ifsc: bBankIfsc.trim() || null,
      is_primary: bIsPrimary,
      is_active: bIsPrimary ? true : bIsActive,
      notes: bNotes.trim() || null,
    });
  };

  const vendorColumns: Column<VendorEntity>[] = [
    {
      header: "Entity & Code",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-[#34312F]">{row.name}</span>
          <span className="text-[10px] font-mono text-[#817872]">{row.code}</span>
        </div>
      ),
    },
    {
      header: "Classification",
      cell: (row) => <StatusBadge status={row.entity_type} size="sm" />,
    },
    {
      header: "Contact & Location",
      cell: (row) => (
        <div className="text-xs text-[#34312F] space-y-0.5">
          <div>{row.contact_person || "—"}</div>
          <div className="text-[11px] text-[#817872]">
            {[row.phone, row.city].filter(Boolean).join(" • ") || "No contact info"}
          </div>
        </div>
      ),
    },
    {
      header: "Terms & Category",
      cell: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="text-[#34312F] font-medium">
            {PAYMENT_TERM_LABELS[row.payment_terms] || row.payment_terms}
          </div>
          {row.default_category && (
            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-[#F7F4F0] border border-[#E7E1D8] text-[#6B635B]">
              {row.default_category}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Activity / Spend",
      cell: (row) => (
        <div className="text-xs">
          {row.entity_type === "COURIER" && (row.delivery_count || 0) > 0 ? (
            <>
              <div className="font-medium text-[#34312F]">{row.delivery_count} dispatches</div>
              <div className="text-[11px] text-[#817872]">
                {formatCurrency(row.total_spent || 0)} billed
              </div>
            </>
          ) : (
            <>
              <div className="font-serif text-sm text-[#34312F]">
                {formatCurrency(row.total_spent || 0)}
              </div>
              <div className="text-[11px] text-[#817872]">{row.expense_count || 0} bills</div>
            </>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      cell: (row) => <StatusBadge status={row.is_active ? "ACTIVE" : "INACTIVE"} size="sm" />,
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setViewingVendorId(row.id)}
            className="p-1.5 rounded-lg text-[#6B635B] hover:text-[#34312F] hover:bg-[#F7F4F0] transition-colors"
            title="Inspect Entity"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openEditVendor(row)}
            className="p-1.5 rounded-lg text-[#6B635B] hover:text-[#34312F] hover:bg-[#F7F4F0] transition-colors"
            title="Edit Entity"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggleVendorActiveMutation.mutate(row)}
            className="p-1.5 rounded-lg text-[#6B635B] hover:text-[#34312F] hover:bg-[#F7F4F0] transition-colors"
            title={row.is_active ? "Deactivate" : "Activate"}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDeletingVendor(row)}
            className="p-1.5 rounded-lg text-[#6B635B] hover:text-[#8F352A] hover:bg-[#FAECEB] transition-colors"
            title="Delete Entity"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const isLoading = activeTab === "VENDORS" ? isLoadingVendors : isLoadingBusiness;
  const isError = activeTab === "VENDORS" ? isErrorVendors : isErrorBusiness;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Entity Management"
        description="Manage Ninu Arts studio profiles, legal tax units, material suppliers, print partners, and courier entities."
        actions={
          <button
            type="button"
            onClick={activeTab === "VENDORS" ? openAddVendor : openAddBusiness}
            className="inline-flex items-center gap-2 rounded-xl bg-[#34312F] px-4 py-2.5 text-xs font-medium text-white shadow-soft hover:bg-[#1F1D1C] transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>
              {activeTab === "VENDORS" ? "Register Vendor / Partner" : "Add Studio Entity"}
            </span>
          </button>
        }
      />

      {actionFeedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs ${
            actionFeedback.type === "success"
              ? "border-[#D1E0CE] bg-[#EAF0E8] text-[#475E42]"
              : "border-[#F2D0CE] bg-[#FAECEB] text-[#8F352A]"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Studio & Legal Units"
          value={businessMeta.active_count || 0}
          subtitle={`${businessMeta.total || 0} total studio entities`}
          icon={Building2}
          onClick={() => setActiveTab("STUDIO_ENTITIES")}
        />
        <StatCard
          title="Suppliers & Presses"
          value={vendorMeta.suppliers_count || 0}
          subtitle={`${vendorMeta.active_count || 0} active partner entities`}
          icon={Briefcase}
          onClick={() => {
            setActiveTab("VENDORS");
            setVendorTypeFilter("SUPPLIER");
          }}
        />
        <StatCard
          title="Courier Partners"
          value={vendorMeta.couriers_count || 0}
          subtitle="Shipping & dispatch operators"
          icon={Truck}
          onClick={() => {
            setActiveTab("VENDORS");
            setVendorTypeFilter("COURIER");
          }}
        />
        <StatCard
          title="Tracked Partner Spend"
          value={formatCurrency(vendorMeta.total_tracked_spend || 0)}
          subtitle="Across linked & matched bills"
          icon={IndianRupee}
          highlight
        />
      </div>

      {/* Tab Navigation + Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="inline-flex rounded-xl border border-[#E7E1D8] bg-white p-1 shadow-card self-start">
          <button
            type="button"
            onClick={() => setActiveTab("VENDORS")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
              activeTab === "VENDORS"
                ? "bg-[#34312F] text-white shadow-soft"
                : "text-[#6B635B] hover:text-[#34312F]"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>Vendors & Partners ({vendorMeta.total || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("STUDIO_ENTITIES")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
              activeTab === "STUDIO_ENTITIES"
                ? "bg-[#34312F] text-white shadow-soft"
                : "text-[#6B635B] hover:text-[#34312F]"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Studio & Legal Entities ({businessMeta.total || 0})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={
              activeTab === "VENDORS"
                ? "Search vendors, contacts, city..."
                : "Search studios, codes, GSTIN..."
            }
            className="w-full sm:w-64"
          />

          {activeTab === "VENDORS" && (
            <FilterDropdown
              label="Type"
              selectedValue={vendorTypeFilter}
              onChange={setVendorTypeFilter}
              options={[
                { label: "All Entities", value: "ALL" },
                { label: "Material Suppliers", value: "SUPPLIER" },
                { label: "Print Partners", value: "PRINT_PARTNER" },
                { label: "Courier Partners", value: "COURIER" },
                { label: "Service Vendors", value: "SERVICE" },
              ]}
            />
          )}

          <FilterDropdown
            label="Status"
            selectedValue={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: "All Statuses", value: "ALL" },
              { label: "Active Only", value: "ACTIVE" },
              { label: "Inactive Only", value: "INACTIVE" },
            ]}
          />
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <LoadingState message="Loading studio entities..." />
      ) : isError ? (
        <ErrorState
          message="Unable to load entity records."
          onRetry={() => (activeTab === "VENDORS" ? refetchVendors() : refetchBusiness())}
        />
      ) : activeTab === "VENDORS" ? (
        <DataTable
          data={vendors}
          columns={vendorColumns}
          pageSize={10}
          emptyTitle="No vendor or partner entities registered"
          emptyMessage="Register your raw material suppliers, print houses, and courier partners here to track studio spend."
          onRowClick={(row) => setViewingVendorId(row.id)}
        />
      ) : businessEntities.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-8 shadow-card">
          <EmptyState
            title="No studio entities found"
            message="Add your primary studio profile, framing workshop, or brand branch."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {businessEntities.map((entity) => (
            <div
              key={entity.id}
              className={`rounded-2xl border bg-white p-6 shadow-card transition-all hover:shadow-soft flex flex-col justify-between gap-4 ${
                entity.is_primary ? "border-[#D1E0CE] bg-gradient-to-br from-white to-[#F9FBF8]" : "border-[#E7E1D8]"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-lg text-[#34312F]">{entity.name}</h3>
                      {entity.is_primary && <StatusBadge status="PRIMARY" size="sm" />}
                      <StatusBadge status={entity.entity_type} size="sm" />
                      {!entity.is_active && <StatusBadge status="INACTIVE" size="sm" />}
                    </div>
                    <p className="text-xs text-[#817872] mt-0.5">
                      {entity.legal_name || "No legal title specified"} •{" "}
                      <span className="font-mono text-[#34312F]">{entity.code}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#6B635B] pt-2 border-t border-[#F0ECE7]">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-[#817872] shrink-0" />
                    <span className="truncate">
                      {[entity.city, entity.state, entity.pincode].filter(Boolean).join(", ") ||
                        "Location not set"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-[#817872] shrink-0" />
                    <span>{entity.phone || "No phone"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-[#817872] shrink-0" />
                    <span className="truncate">{entity.email || "No email"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Landmark className="h-3.5 w-3.5 text-[#817872] shrink-0" />
                    <span className="truncate">
                      {entity.upi_id || entity.gstin || "No UPI / GSTIN"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#F0ECE7]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setViewingBusinessId(entity.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E1D8] bg-white px-3 py-1.5 text-xs font-medium text-[#34312F] hover:bg-[#F7F4F0] transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5 text-[#817872]" />
                    <span>View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditBusiness(entity)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E1D8] bg-white px-3 py-1.5 text-xs font-medium text-[#34312F] hover:bg-[#F7F4F0] transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-[#817872]" />
                    <span>Edit</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {!entity.is_primary && (
                    <>
                      <button
                        type="button"
                        onClick={() => promotePrimaryMutation.mutate(entity.id)}
                        disabled={promotePrimaryMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#D1E0CE] bg-[#EAF0E8] px-3 py-1.5 text-xs font-medium text-[#475E42] hover:bg-[#DCE7D9] transition-colors"
                      >
                        <Star className="h-3.5 w-3.5" />
                        <span>Set Primary</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingBusiness(entity)}
                        className="p-1.5 rounded-xl text-[#817872] hover:text-[#8F352A] hover:bg-[#FAECEB] transition-colors"
                        title="Delete Business Entity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vendor Create / Edit Modal */}
      <FormDialog
        isOpen={isVendorModalOpen}
        onClose={closeVendorModal}
        title={editingVendor ? "Edit Vendor / Partner Entity" : "Register Vendor / Partner Entity"}
        description="Maintain centralized supplier, printing press, courier, and service contacts."
        maxWidth="lg"
      >
        <form onSubmit={handleVendorSubmit} className="space-y-4">
          {vendorFormError && (
            <div className="rounded-xl border border-[#F2D0CE] bg-[#FAECEB] px-3.5 py-2.5 text-xs text-[#8F352A] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{vendorFormError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#34312F] mb-1">
                Entity / Business Name <span className="text-[#8F352A]">*</span>
              </label>
              <input
                type="text"
                value={vName}
                onChange={(e) => setVName(e.target.value)}
                placeholder="e.g. Kerala Glass & Frame Mart"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">
                Short Code (optional)
              </label>
              <input
                type="text"
                value={vCode}
                onChange={(e) => setVCode(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] font-mono uppercase focus:outline-[#34312F]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">
                Entity Type <span className="text-[#8F352A]">*</span>
              </label>
              <select
                value={vType}
                onChange={(e) => setVType(e.target.value as VendorEntityType)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white focus:outline-[#34312F]"
              >
                <option value="SUPPLIER">Material Supplier</option>
                <option value="PRINT_PARTNER">Print Partner</option>
                <option value="COURIER">Courier Partner</option>
                <option value="SERVICE">Service Vendor</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">
                Payment Terms
              </label>
              <select
                value={vPaymentTerms}
                onChange={(e) => setVPaymentTerms(e.target.value as PaymentTermsType)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white focus:outline-[#34312F]"
              >
                <option value="IMMEDIATE">Immediate</option>
                <option value="ADVANCE">Advance Required</option>
                <option value="NET_7">Net 7 Days</option>
                <option value="NET_15">Net 15 Days</option>
                <option value="NET_30">Net 30 Days</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">
                Default Expense Category
              </label>
              <select
                value={vDefaultCategory}
                onChange={(e) => setVDefaultCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white focus:outline-[#34312F]"
              >
                <option value="">None</option>
                <option value="MATERIALS">MATERIALS</option>
                <option value="PRINTING">PRINTING</option>
                <option value="PACKAGING">PACKAGING</option>
                <option value="COURIER">COURIER</option>
                <option value="MARKETING">MARKETING</option>
                <option value="TRANSPORTATION">TRANSPORTATION</option>
                <option value="SOFTWARE">SOFTWARE</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">Contact Person</label>
              <input
                type="text"
                value={vContactPerson}
                onChange={(e) => setVContactPerson(e.target.value)}
                placeholder="e.g. Ramesh Nair"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">Phone</label>
              <input
                type="text"
                value={vPhone}
                onChange={(e) => setVPhone(e.target.value)}
                placeholder="+91 98470 00000"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">City</label>
              <input
                type="text"
                value={vCity}
                onChange={(e) => setVCity(e.target.value)}
                placeholder="e.g. Alappuzha"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">Email</label>
              <input
                type="email"
                value={vEmail}
                onChange={(e) => setVEmail(e.target.value)}
                placeholder="accounts@vendor.in"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">UPI ID</label>
              <input
                type="text"
                value={vUpiId}
                onChange={(e) => setVUpiId(e.target.value)}
                placeholder="vendor@upi"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">GSTIN</label>
              <input
                type="text"
                value={vGstin}
                onChange={(e) => setVGstin(e.target.value)}
                placeholder="32AAAAA0000A1Z5"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] font-mono uppercase focus:outline-[#34312F]"
              />
            </div>
          </div>

          {vType === "COURIER" && (
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">
                Tracking URL Template (use <code className="text-[#7A4B43]">{"{tracking}"}</code> placeholder)
              </label>
              <input
                type="text"
                value={vTrackingTemplate}
                onChange={(e) => setVTrackingTemplate(e.target.value)}
                placeholder="https://www.dtdc.in/tracking.asp?strCnno={tracking}"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] font-mono focus:outline-[#34312F]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#34312F] mb-1">Address</label>
            <input
              type="text"
              value={vAddress}
              onChange={(e) => setVAddress(e.target.value)}
              placeholder="Street, industrial estate, landmark..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#34312F] mb-1">Notes</label>
            <textarea
              rows={2}
              value={vNotes}
              onChange={(e) => setVNotes(e.target.value)}
              placeholder="Material specialties, lead times, or account numbers..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-[#34312F] cursor-pointer">
            <input
              type="checkbox"
              checked={vIsActive}
              onChange={(e) => setVIsActive(e.target.checked)}
              className="rounded border-[#E7E1D8] text-[#34312F] focus:ring-[#34312F]"
            />
            <span>Active entity (available for expense and dispatch selection)</span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F0ECE7]">
            <button
              type="button"
              onClick={closeVendorModal}
              className="px-4 py-2 text-xs font-medium text-[#6B635B] hover:text-[#34312F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveVendorMutation.isPending}
              className="px-4.5 py-2 rounded-xl bg-[#34312F] hover:bg-[#1F1D1C] text-white text-xs font-medium shadow-soft disabled:opacity-50 transition-colors"
            >
              {saveVendorMutation.isPending
                ? "Saving..."
                : editingVendor
                ? "Save Changes"
                : "Register Entity"}
            </button>
          </div>
        </form>
      </FormDialog>

      {/* Business Entity Create / Edit Modal */}
      <FormDialog
        isOpen={isBusinessModalOpen}
        onClose={closeBusinessModal}
        title={editingBusiness ? "Edit Studio / Legal Entity" : "Add Studio / Legal Entity"}
        description="Configure Ninu Arts legal entity details, studio locations, tax registrations, and settlement accounts."
        maxWidth="lg"
      >
        <form onSubmit={handleBusinessSubmit} className="space-y-4">
          {businessFormError && (
            <div className="rounded-xl border border-[#F2D0CE] bg-[#FAECEB] px-3.5 py-2.5 text-xs text-[#8F352A] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{businessFormError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#34312F] mb-1">
                Display Name <span className="text-[#8F352A]">*</span>
              </label>
              <input
                type="text"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                placeholder="e.g. Ninu Arts Studio"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">
                Entity Code
              </label>
              <input
                type="text"
                value={bCode}
                onChange={(e) => setBCode(e.target.value)}
                placeholder="NINU-HQ"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] font-mono uppercase focus:outline-[#34312F]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#34312F] mb-1">
                Registered Legal Name
              </label>
              <input
                type="text"
                value={bLegalName}
                onChange={(e) => setBLegalName(e.target.value)}
                placeholder="e.g. Ninu Arts Custom Framing & Gifts"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">
                Entity Type <span className="text-[#8F352A]">*</span>
              </label>
              <select
                value={bType}
                onChange={(e) => setBType(e.target.value as BusinessEntityType)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white focus:outline-[#34312F]"
              >
                <option value="STUDIO">Studio</option>
                <option value="WORKSHOP">Workshop</option>
                <option value="BRANCH">Branch</option>
                <option value="BRAND">Brand / Label</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">Phone</label>
              <input
                type="text"
                value={bPhone}
                onChange={(e) => setBPhone(e.target.value)}
                placeholder="+91 94471 00000"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">Email</label>
              <input
                type="email"
                value={bEmail}
                onChange={(e) => setBEmail(e.target.value)}
                placeholder="nidha@ninuarts.com"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">GSTIN</label>
              <input
                type="text"
                value={bGstin}
                onChange={(e) => setBGstin(e.target.value)}
                placeholder="32AAAAA0000A1Z5"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] font-mono uppercase focus:outline-[#34312F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">PAN</label>
              <input
                type="text"
                value={bPan}
                onChange={(e) => setBPan(e.target.value)}
                placeholder="ABCDE1234F"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] font-mono uppercase focus:outline-[#34312F]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">City</label>
              <input
                type="text"
                value={bCity}
                onChange={(e) => setBCity(e.target.value)}
                placeholder="Alappuzha"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">State</label>
              <input
                type="text"
                value={bState}
                onChange={(e) => setBState(e.target.value)}
                placeholder="Kerala"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">Pincode</label>
              <input
                type="text"
                value={bPincode}
                onChange={(e) => setBPincode(e.target.value)}
                placeholder="688001"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#34312F] mb-1">Full Address</label>
            <input
              type="text"
              value={bAddress}
              onChange={(e) => setBAddress(e.target.value)}
              placeholder="Building, street, studio floor..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-[#F7F4F0] border border-[#E7E1D8]">
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">Primary UPI ID</label>
              <input
                type="text"
                value={bUpiId}
                onChange={(e) => setBUpiId(e.target.value)}
                placeholder="ninuarts@okaxis"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white focus:outline-[#34312F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">Bank Name</label>
              <input
                type="text"
                value={bBankName}
                onChange={(e) => setBBankName(e.target.value)}
                placeholder="Federal Bank / SBI"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white focus:outline-[#34312F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">Account Number</label>
              <input
                type="text"
                value={bBankAccount}
                onChange={(e) => setBBankAccount(e.target.value)}
                placeholder="Account number"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white font-mono focus:outline-[#34312F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">IFSC Code</label>
              <input
                type="text"
                value={bBankIfsc}
                onChange={(e) => setBBankIfsc(e.target.value)}
                placeholder="FDRL0001234"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white font-mono uppercase focus:outline-[#34312F]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#34312F] mb-1">Notes</label>
            <textarea
              rows={2}
              value={bNotes}
              onChange={(e) => setBNotes(e.target.value)}
              placeholder="Invoice footer remarks, workshop hours..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="inline-flex items-center gap-2 text-xs text-[#34312F] cursor-pointer">
              <input
                type="checkbox"
                checked={bIsPrimary}
                onChange={(e) => setBIsPrimary(e.target.checked)}
                className="rounded border-[#E7E1D8] text-[#34312F] focus:ring-[#34312F]"
              />
              <span>Set as Primary Studio Entity</span>
            </label>
            {!bIsPrimary && (
              <label className="inline-flex items-center gap-2 text-xs text-[#34312F] cursor-pointer">
                <input
                  type="checkbox"
                  checked={bIsActive}
                  onChange={(e) => setBIsActive(e.target.checked)}
                  className="rounded border-[#E7E1D8] text-[#34312F] focus:ring-[#34312F]"
                />
                <span>Active</span>
              </label>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F0ECE7]">
            <button
              type="button"
              onClick={closeBusinessModal}
              className="px-4 py-2 text-xs font-medium text-[#6B635B] hover:text-[#34312F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveBusinessMutation.isPending}
              className="px-4.5 py-2 rounded-xl bg-[#34312F] hover:bg-[#1F1D1C] text-white text-xs font-medium shadow-soft disabled:opacity-50 transition-colors"
            >
              {saveBusinessMutation.isPending
                ? "Saving..."
                : editingBusiness
                ? "Save Changes"
                : "Create Entity"}
            </button>
          </div>
        </form>
      </FormDialog>

      {/* Vendor Detail Drawer */}
      <DetailDrawer
        isOpen={viewingVendorId !== null}
        onClose={() => setViewingVendorId(null)}
        title={vendorDetail?.vendor?.name || "Vendor Entity"}
        subtitle={
          vendorDetail?.vendor
            ? `${vendorDetail.vendor.code} • ${
                PAYMENT_TERM_LABELS[vendorDetail.vendor.payment_terms] ||
                vendorDetail.vendor.payment_terms
              }`
            : undefined
        }
        badge={
          vendorDetail?.vendor && (
            <StatusBadge status={vendorDetail.vendor.entity_type} size="sm" />
          )
        }
        footer={
          vendorDetail?.vendor && (
            <>
              <button
                type="button"
                onClick={() => {
                  const v = vendorDetail.vendor;
                  setViewingVendorId(null);
                  openEditVendor(v);
                }}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-[#E7E1D8] text-[#34312F] hover:bg-[#F7F4F0]"
              >
                Edit Entity
              </button>
              <button
                type="button"
                onClick={() => setViewingVendorId(null)}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-[#34312F] text-white hover:bg-[#1F1D1C]"
              >
                Close
              </button>
            </>
          )
        }
      >
        {isLoadingVendorDetail ? (
          <LoadingState message="Loading vendor dossier..." />
        ) : vendorDetail?.vendor ? (
          <div className="space-y-6 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[#F7F4F0] border border-[#E7E1D8]">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#817872]">
                  Total Tracked Outflow
                </span>
                <div className="text-2xl font-serif text-[#34312F] mt-1">
                  {formatCurrency(vendorDetail.stats.total_spent || 0)}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-[#F7F4F0] border border-[#E7E1D8]">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#817872]">
                  {vendorDetail.vendor.entity_type === "COURIER"
                    ? "Dispatches Handled"
                    : "Recent Expense Bills"}
                </span>
                <div className="text-2xl font-serif text-[#34312F] mt-1">
                  {vendorDetail.vendor.entity_type === "COURIER"
                    ? vendorDetail.stats.delivery_count
                    : vendorDetail.stats.expense_count}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Contact Person</span>
                <span className="font-medium text-[#34312F]">
                  {vendorDetail.vendor.contact_person || "—"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Phone & Email</span>
                <span className="font-medium text-[#34312F]">
                  {[vendorDetail.vendor.phone, vendorDetail.vendor.email]
                    .filter(Boolean)
                    .join(" • ") || "—"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Location</span>
                <span className="font-medium text-[#34312F]">
                  {[vendorDetail.vendor.address, vendorDetail.vendor.city]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">UPI / GSTIN</span>
                <span className="font-medium text-[#34312F]">
                  {[vendorDetail.vendor.upi_id, vendorDetail.vendor.gstin]
                    .filter(Boolean)
                    .join(" • ") || "—"}
                </span>
              </div>
              {vendorDetail.vendor.tracking_url_template && (
                <div className="flex justify-between items-center py-2 border-b border-[#F0ECE7] gap-4">
                  <span className="text-[#817872]">Tracking URL Template</span>
                  <span className="font-mono text-[11px] text-[#34312F] truncate">
                    {vendorDetail.vendor.tracking_url_template}
                  </span>
                </div>
              )}
            </div>

            {vendorDetail.vendor.notes && (
              <div>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#817872] block mb-1.5">
                  Entity Notes
                </span>
                <p className="p-3.5 rounded-xl bg-[#FDFBF7] border border-[#E7E1D8] text-[#34312F] leading-relaxed">
                  {vendorDetail.vendor.notes}
                </p>
              </div>
            )}

            {vendorDetail.recent_expenses.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase font-semibold tracking-wider text-[#817872] mb-2">
                  Recent Linked Expenses
                </h4>
                <div className="space-y-2">
                  {vendorDetail.recent_expenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#FDFBF7] border border-[#E7E1D8]"
                    >
                      <div>
                        <p className="font-medium text-[#34312F]">{exp.description}</p>
                        <p className="text-[11px] text-[#817872]">
                          {formatDate(exp.expense_date)} • {exp.category?.name || "Expense"}
                        </p>
                      </div>
                      <span className="font-serif text-sm text-[#34312F]">
                        {formatCurrency(exp.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {vendorDetail.recent_deliveries.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase font-semibold tracking-wider text-[#817872] mb-2">
                  Recent Courier Dispatches
                </h4>
                <div className="space-y-2">
                  {vendorDetail.recent_deliveries.map((del) => (
                    <div
                      key={del.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#FDFBF7] border border-[#E7E1D8]"
                    >
                      <div>
                        <p className="font-medium text-[#34312F]">
                          {del.order?.order_number || `Order #${del.order_id}`}
                        </p>
                        <p className="text-[11px] text-[#817872]">
                          {del.tracking_number || "No tracking ID"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {del.tracking_number &&
                          vendorDetail.vendor.tracking_url_template && (
                            <a
                              href={vendorDetail.vendor.tracking_url_template.replace(
                                "{tracking}",
                                encodeURIComponent(del.tracking_number)
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded-lg hover:bg-[#F0ECE7] text-[#6B635B]"
                              title="Open Carrier Tracking"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        <StatusBadge status={del.status} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {vendorDetail.audit_trail.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase font-semibold tracking-wider text-[#817872] mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Audit History</span>
                </h4>
                <div className="space-y-1.5">
                  {vendorDetail.audit_trail.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-[#F7F4F0] border border-[#E7E1D8] text-[11px] text-[#6B635B]"
                    >
                      <span className="font-medium text-[#34312F]">{log.description}</span>
                      <div className="text-[10px] text-[#817872] mt-0.5">
                        {formatDate(log.created_at)} • {log.user?.name || "System"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DetailDrawer>

      {/* Business Entity Detail Drawer */}
      <DetailDrawer
        isOpen={viewingBusinessId !== null}
        onClose={() => setViewingBusinessId(null)}
        title={businessDetail?.entity?.name || "Business Entity"}
        subtitle={
          businessDetail?.entity
            ? `${businessDetail.entity.code} • ${
                businessDetail.entity.legal_name || "Legal title unset"
              }`
            : undefined
        }
        badge={
          businessDetail?.entity && (
            <div className="flex items-center gap-1.5">
              {businessDetail.entity.is_primary && <StatusBadge status="PRIMARY" size="sm" />}
              <StatusBadge status={businessDetail.entity.entity_type} size="sm" />
            </div>
          )
        }
        footer={
          businessDetail?.entity && (
            <>
              <button
                type="button"
                onClick={() => {
                  const ent = businessDetail.entity;
                  setViewingBusinessId(null);
                  openEditBusiness(ent);
                }}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-[#E7E1D8] text-[#34312F] hover:bg-[#F7F4F0]"
              >
                Edit Studio Entity
              </button>
              <button
                type="button"
                onClick={() => setViewingBusinessId(null)}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-[#34312F] text-white hover:bg-[#1F1D1C]"
              >
                Close
              </button>
            </>
          )
        }
      >
        {isLoadingBusinessDetail ? (
          <LoadingState message="Loading entity profile..." />
        ) : businessDetail?.entity ? (
          <div className="space-y-5 text-xs">
            <div className="space-y-2.5">
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Registered Legal Name</span>
                <span className="font-medium text-[#34312F]">
                  {businessDetail.entity.legal_name || "—"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">GSTIN / PAN</span>
                <span className="font-mono text-[#34312F]">
                  {[businessDetail.entity.gstin, businessDetail.entity.pan]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Contact</span>
                <span className="font-medium text-[#34312F]">
                  {[businessDetail.entity.phone, businessDetail.entity.email]
                    .filter(Boolean)
                    .join(" • ") || "—"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Studio Address</span>
                <span className="font-medium text-[#34312F] text-right max-w-xs">
                  {[
                    businessDetail.entity.address,
                    businessDetail.entity.city,
                    businessDetail.entity.state,
                    businessDetail.entity.pincode,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#F7F4F0] border border-[#E7E1D8] space-y-2">
              <h4 className="text-[10px] uppercase font-semibold tracking-wider text-[#817872]">
                Settlement & Banking Coordinates
              </h4>
              <div className="flex justify-between">
                <span className="text-[#817872]">UPI ID</span>
                <span className="font-medium text-[#34312F]">
                  {businessDetail.entity.upi_id || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#817872]">Bank</span>
                <span className="font-medium text-[#34312F]">
                  {businessDetail.entity.bank_name || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#817872]">Account / IFSC</span>
                <span className="font-mono text-[#34312F]">
                  {[
                    businessDetail.entity.bank_account_number,
                    businessDetail.entity.bank_ifsc,
                  ]
                    .filter(Boolean)
                    .join(" • ") || "—"}
                </span>
              </div>
            </div>

            {businessDetail.entity.notes && (
              <div>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#817872] block mb-1.5">
                  Notes
                </span>
                <p className="p-3.5 rounded-xl bg-[#FDFBF7] border border-[#E7E1D8] text-[#34312F] leading-relaxed">
                  {businessDetail.entity.notes}
                </p>
              </div>
            )}

            {businessDetail.audit_trail.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase font-semibold tracking-wider text-[#817872] mb-2">
                  Audit History
                </h4>
                <div className="space-y-1.5">
                  {businessDetail.audit_trail.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-[#F7F4F0] border border-[#E7E1D8] text-[11px] text-[#6B635B]"
                    >
                      <span className="font-medium text-[#34312F]">{log.description}</span>
                      <div className="text-[10px] text-[#817872] mt-0.5">
                        {formatDate(log.created_at)} • {log.user?.name || "System"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DetailDrawer>

      {/* Delete Vendor Confirmation */}
      <ConfirmationDialog
        isOpen={deletingVendor !== null}
        onClose={() => setDeletingVendor(null)}
        onConfirm={() => deletingVendor && deleteVendorMutation.mutate(deletingVendor.id)}
        title="Delete Vendor Entity"
        message={
          deletingVendor
            ? `Delete "${deletingVendor.name}"? Vendors with linked expense bills cannot be deleted and should be deactivated instead.`
            : ""
        }
        confirmText={deleteVendorMutation.isPending ? "Deleting..." : "Delete Vendor"}
        variant="danger"
      />

      {/* Delete Business Entity Confirmation */}
      <ConfirmationDialog
        isOpen={deletingBusiness !== null}
        onClose={() => setDeletingBusiness(null)}
        onConfirm={() => deletingBusiness && deleteBusinessMutation.mutate(deletingBusiness.id)}
        title="Delete Studio Entity"
        message={
          deletingBusiness
            ? `Are you sure you want to remove studio entity "${deletingBusiness.name}"?`
            : ""
        }
        confirmText={deleteBusinessMutation.isPending ? "Deleting..." : "Remove Entity"}
        variant="danger"
      />
    </div>
  );
}
