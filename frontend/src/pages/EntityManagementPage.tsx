import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  Plus,
  Edit2,
  Trash2,
  Eye,
  KeyRound,
  Power,
  Building2,
  Briefcase,
  Truck,
  IndianRupee,
  Star,
  MapPin,
  Phone,
  Mail,
  Landmark,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  Unlock,
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
import { useAuth } from "../contexts/AuthContext";
import {
  ActivityLog,
  BusinessEntity,
  BusinessEntityType,
  Delivery,
  Expense,
  PaymentTermsType,
  User,
  UserDossier,
  UserRole,
  VendorEntity,
  VendorEntityType,
} from "../types";
import { useDashboardSearch } from "../layouts/DashboardLayout";

type ActiveTab = "OPERATORS" | "STUDIO_ENTITIES" | "VENDORS";

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
  const { user: currentOperator } = useAuth();

  // Active Tab state — Defaults to OPERATORS as requested
  const [activeTab, setActiveTab] = useState<ActiveTab>("OPERATORS");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [vendorTypeFilter, setVendorTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Notifications feedback
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // ----------------------------------------------------
  // 1. Dashboard User / Operator State & Modals
  // ----------------------------------------------------
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordResetError, setPasswordResetError] = useState("");

  // User Form fields
  const [uName, setUName] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uPhone, setUPhone] = useState("");
  const [uPassword, setUPassword] = useState("");
  const [uRole, setURole] = useState<UserRole>("STAFF");
  const [uIsActive, setUIsActive] = useState(true);
  const [userFormError, setUserFormError] = useState("");

  // ----------------------------------------------------
  // 2. Vendor & Business Entities State & Modals
  // ----------------------------------------------------
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorEntity | null>(null);
  const [viewingVendorId, setViewingVendorId] = useState<number | null>(null);
  const [deletingVendor, setDeletingVendor] = useState<VendorEntity | null>(null);

  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<BusinessEntity | null>(null);
  const [viewingBusinessId, setViewingBusinessId] = useState<number | null>(null);
  const [deletingBusiness, setDeletingBusiness] = useState<BusinessEntity | null>(null);

  // Vendor Form
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

  // Business Entity Form
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

  const effectiveSearch = search || globalSearch;

  // ----------------------------------------------------
  // Queries
  // ----------------------------------------------------
  // Fetch Dashboard Users / Operators
  const {
    data: usersResp,
    isLoading: isLoadingUsers,
    isError: isErrorUsers,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ["users", effectiveSearch, roleFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveSearch) params.append("search", effectiveSearch);
      if (roleFilter !== "ALL") params.append("role", roleFilter);
      if (statusFilter === "ACTIVE") params.append("is_active", "true");
      if (statusFilter === "INACTIVE") params.append("is_active", "false");
      const res = await apiClient.get(`/users?${params.toString()}`);
      return {
        users: (res.data?.data || []) as User[],
        meta: res.data?.meta || { total: 0, active_count: 0, owner_count: 0, staff_count: 0 },
      };
    },
  });

  // Fetch Single User Dossier
  const { data: userDossier, isLoading: isLoadingUserDossier } = useQuery({
    queryKey: ["user-dossier", viewingUserId],
    enabled: viewingUserId !== null,
    queryFn: async () => {
      const res = await apiClient.get(`/users/${viewingUserId}`);
      return res.data?.data as UserDossier;
    },
  });

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

  // Fetch Vendors
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
        meta: res.data?.meta || { total: 0, active_count: 0, suppliers_count: 0, couriers_count: 0, total_tracked_spend: 0 },
      };
    },
  });

  const users = usersResp?.users || [];
  const userMeta = usersResp?.meta || { total: 0, active_count: 0, owner_count: 0, staff_count: 0 };
  const businessEntities = businessResp?.entities || [];
  const businessMeta = businessResp?.meta || { total: 0, active_count: 0 };
  const vendors = vendorResp?.vendors || [];
  const vendorMeta = vendorResp?.meta || { total: 0, active_count: 0, suppliers_count: 0, couriers_count: 0, total_tracked_spend: 0 };

  // ----------------------------------------------------
  // User Mutations
  // ----------------------------------------------------
  const saveUserMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingUser) {
        return apiClient.put(`/users/${editingUser.id}`, payload);
      }
      return apiClient.post("/users", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-dossier"] });
      closeUserModal();
      setActionFeedback({
        type: "success",
        message: editingUser ? "Operator account updated." : "New operator account created.",
      });
    },
    onError: (err: any) => {
      setUserFormError(getApiErrorMessage(err, "Failed to save operator account."));
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      return apiClient.post(`/users/${id}/reset-password`, { password });
    },
    onSuccess: () => {
      setPasswordResetUser(null);
      setNewPassword("");
      setPasswordResetError("");
      setActionFeedback({ type: "success", message: "Operator password reset successfully." });
    },
    onError: (err: any) => {
      setPasswordResetError(getApiErrorMessage(err, "Failed to reset password."));
    },
  });

  const toggleUserActiveMutation = useMutation({
    mutationFn: async (u: User) => {
      return apiClient.put(`/users/${u.id}`, { is_active: !u.is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-dossier"] });
      setActionFeedback({ type: "success", message: "Operator status updated." });
    },
    onError: (err: any) => {
      setActionFeedback({ type: "error", message: getApiErrorMessage(err, "Cannot modify operator status.") });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeletingUser(null);
      setActionFeedback({ type: "success", message: "Operator account deleted." });
    },
    onError: (err: any) => {
      setDeletingUser(null);
      setActionFeedback({ type: "error", message: getApiErrorMessage(err, "Unable to delete operator account.") });
    },
  });

  // ----------------------------------------------------
  // Vendor & Business Mutations
  // ----------------------------------------------------
  const saveVendorMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingVendor) return apiClient.put(`/vendors/${editingVendor.id}`, payload);
      return apiClient.post("/vendors", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      closeVendorModal();
      setActionFeedback({ type: "success", message: editingVendor ? "Vendor updated." : "Vendor registered." });
    },
    onError: (err: any) => setVendorFormError(getApiErrorMessage(err, "Failed to save vendor.")),
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setDeletingVendor(null);
      setActionFeedback({ type: "success", message: "Vendor deleted." });
    },
    onError: (err: any) => {
      setDeletingVendor(null);
      setActionFeedback({ type: "error", message: getApiErrorMessage(err, "Unable to delete vendor.") });
    },
  });

  const saveBusinessMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingBusiness) return apiClient.put(`/business-entities/${editingBusiness.id}`, payload);
      return apiClient.post("/business-entities", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-entities"] });
      closeBusinessModal();
      setActionFeedback({ type: "success", message: editingBusiness ? "Studio entity updated." : "Studio entity added." });
    },
    onError: (err: any) => setBusinessFormError(getApiErrorMessage(err, "Failed to save studio entity.")),
  });

  const promotePrimaryMutation = useMutation({
    mutationFn: async (id: number) => apiClient.put(`/business-entities/${id}`, { is_primary: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-entities"] });
      setActionFeedback({ type: "success", message: "Primary studio entity updated." });
    },
    onError: (err: any) => setActionFeedback({ type: "error", message: getApiErrorMessage(err, "Failed to set primary.") }),
  });

  const deleteBusinessMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/business-entities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-entities"] });
      setDeletingBusiness(null);
      setActionFeedback({ type: "success", message: "Studio entity removed." });
    },
    onError: (err: any) => {
      setDeletingBusiness(null);
      setActionFeedback({ type: "error", message: getApiErrorMessage(err, "Unable to delete studio entity.") });
    },
  });

  // ----------------------------------------------------
  // Form Handlers
  // ----------------------------------------------------
  const openAddUser = () => {
    setEditingUser(null);
    setUName("");
    setUEmail("");
    setUPhone("");
    setUPassword("");
    setURole("STAFF");
    setUIsActive(true);
    setUserFormError("");
    setIsUserModalOpen(true);
  };

  const openEditUser = (u: User) => {
    setEditingUser(u);
    setUName(u.name);
    setUEmail(u.email);
    setUPhone(u.phone || "");
    setUPassword("");
    setURole(u.role);
    setUIsActive(u.is_active);
    setUserFormError("");
    setIsUserModalOpen(true);
  };

  const closeUserModal = () => {
    setIsUserModalOpen(false);
    setEditingUser(null);
    setUserFormError("");
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uName.trim() || !uEmail.trim()) {
      setUserFormError("Name and email address are required.");
      return;
    }
    if (!editingUser && (!uPassword || uPassword.length < 6)) {
      setUserFormError("Password must be at least 6 characters.");
      return;
    }

    saveUserMutation.mutate({
      name: uName.trim(),
      email: uEmail.trim().toLowerCase(),
      phone: uPhone.trim() || null,
      role: uRole,
      is_active: uIsActive,
      ...(!editingUser ? { password: uPassword } : {}),
    });
  };

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

  const closeVendorModal = () => {
    setIsVendorModalOpen(false);
    setEditingVendor(null);
    setVendorFormError("");
  };

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

  const closeBusinessModal = () => {
    setIsBusinessModalOpen(false);
    setEditingBusiness(null);
    setBusinessFormError("");
  };

  // ----------------------------------------------------
  // User Table Columns
  // ----------------------------------------------------
  const userColumns: Column<User>[] = [
    {
      header: "Operator / User",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#34312F] text-white font-serif text-sm shadow-soft">
            {row.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col truncate">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-[#34312F] truncate">{row.name}</span>
              {currentOperator?.id === row.id && (
                <span className="rounded-md bg-[#F7F4F0] border border-[#E7E1D8] px-1.5 py-0.2 text-[9px] font-semibold text-[#7A4B43]">
                  You
                </span>
              )}
            </div>
            <span className="text-[11px] text-[#817872] truncate">{row.email}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Role & Access",
      cell: (row) => <StatusBadge status={row.role} size="sm" />,
    },
    {
      header: "Phone / Contact",
      cell: (row) => (
        <span className="text-xs text-[#6B635B]">{row.phone || "—"}</span>
      ),
    },
    {
      header: "Operational Activity",
      cell: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="text-[#34312F] font-medium">
            {row.orders_count || 0} orders created
          </div>
          <div className="text-[11px] text-[#817872]">
            {[
              `${row.payments_count || 0} payments`,
              `${row.expenses_count || 0} bills`,
            ].join(" • ")}
          </div>
        </div>
      ),
    },
    {
      header: "Last Session",
      cell: (row) => (
        <div className="text-xs text-[#817872]">
          {row.last_login_at ? formatDate(row.last_login_at) : "No login recorded"}
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
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setViewingUserId(row.id)}
            className="p-1.5 rounded-lg text-[#6B635B] hover:text-[#34312F] hover:bg-[#F7F4F0] transition-colors"
            title="Inspect Operator Dossier"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openEditUser(row)}
            className="p-1.5 rounded-lg text-[#6B635B] hover:text-[#34312F] hover:bg-[#F7F4F0] transition-colors"
            title="Edit Operator Profile"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setPasswordResetUser(row);
              setNewPassword("");
              setPasswordResetError("");
            }}
            className="p-1.5 rounded-lg text-[#6B635B] hover:text-[#34312F] hover:bg-[#F7F4F0] transition-colors"
            title="Reset Password"
          >
            <KeyRound className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggleUserActiveMutation.mutate(row)}
            disabled={currentOperator?.id === row.id}
            className="p-1.5 rounded-lg text-[#6B635B] hover:text-[#34312F] hover:bg-[#F7F4F0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={row.is_active ? "Deactivate Operator" : "Activate Operator"}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDeletingUser(row)}
            disabled={currentOperator?.id === row.id}
            className="p-1.5 rounded-lg text-[#6B635B] hover:text-[#8F352A] hover:bg-[#FAECEB] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Delete Operator Account"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Entity Management"
        description="Manage dashboard users, operator credentials, roles and permissions, operating studio profiles, and vendor partners."
        actions={
          <button
            type="button"
            onClick={() => {
              if (activeTab === "OPERATORS") openAddUser();
              else if (activeTab === "VENDORS") openAddVendor();
              else openAddBusiness();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#34312F] px-4 py-2.5 text-xs font-medium text-white shadow-soft hover:bg-[#1F1D1C] transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>
              {activeTab === "OPERATORS"
                ? "Add Operator / User"
                : activeTab === "VENDORS"
                ? "Register Vendor"
                : "Add Studio Entity"}
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

      {/* KPI Cards — Focused on Operators & Dashboard Users */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Dashboard Operators"
          value={userMeta.total || 0}
          subtitle={`${userMeta.active_count || 0} active workspace users`}
          icon={Users}
          onClick={() => setActiveTab("OPERATORS")}
        />
        <StatCard
          title="Proprietor (Owners)"
          value={userMeta.owner_count || 0}
          subtitle="Full operational & P&L control"
          icon={ShieldCheck}
          onClick={() => {
            setActiveTab("OPERATORS");
            setRoleFilter("OWNER");
          }}
        />
        <StatCard
          title="Staff Members"
          value={userMeta.staff_count || 0}
          subtitle="Orders, CRM, and catalog access"
          icon={UserCheck}
          onClick={() => {
            setActiveTab("OPERATORS");
            setRoleFilter("STAFF");
          }}
        />
        <StatCard
          title="Studio & Partners"
          value={`${businessMeta.total || 0} / ${vendorMeta.total || 0}`}
          subtitle="Studios & registered vendors"
          icon={Building2}
          onClick={() => setActiveTab("STUDIO_ENTITIES")}
          highlight
        />
      </div>

      {/* Tab Navigation + Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="inline-flex rounded-xl border border-[#E7E1D8] bg-white p-1 shadow-card self-start">
          <button
            type="button"
            onClick={() => setActiveTab("OPERATORS")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
              activeTab === "OPERATORS"
                ? "bg-[#34312F] text-white shadow-soft"
                : "text-[#6B635B] hover:text-[#34312F]"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Dashboard Users ({userMeta.total || 0})</span>
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
            <span>Studio Units ({businessMeta.total || 0})</span>
          </button>
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
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={
              activeTab === "OPERATORS"
                ? "Search users by name, email, phone..."
                : activeTab === "STUDIO_ENTITIES"
                ? "Search studios, codes, GSTIN..."
                : "Search vendors, contacts, city..."
            }
            className="w-full sm:w-64"
          />

          {activeTab === "OPERATORS" && (
            <FilterDropdown
              label="Role"
              selectedValue={roleFilter}
              onChange={setRoleFilter}
              options={[
                { label: "All Roles", value: "ALL" },
                { label: "Proprietor (Owner)", value: "OWNER" },
                { label: "Staff Members", value: "STAFF" },
              ]}
            />
          )}

          {activeTab === "VENDORS" && (
            <FilterDropdown
              label="Type"
              selectedValue={vendorTypeFilter}
              onChange={setVendorTypeFilter}
              options={[
                { label: "All Types", value: "ALL" },
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

      {/* Main Tab Content */}
      {activeTab === "OPERATORS" ? (
        isLoadingUsers ? (
          <LoadingState message="Loading dashboard operators..." />
        ) : isErrorUsers ? (
          <ErrorState message="Unable to load operator accounts." onRetry={() => refetchUsers()} />
        ) : (
          <DataTable
            data={users}
            columns={userColumns}
            pageSize={10}
            emptyTitle="No operator accounts found"
            emptyMessage="No dashboard users match the selected filters. Invite staff members to assist with order processing."
            onRowClick={(row) => setViewingUserId(row.id)}
          />
        )
      ) : activeTab === "STUDIO_ENTITIES" ? (
        isLoadingBusiness ? (
          <LoadingState message="Loading studio profiles..." />
        ) : isErrorBusiness ? (
          <ErrorState message="Unable to load studio profiles." onRetry={() => refetchBusiness()} />
        ) : businessEntities.length === 0 ? (
          <div className="rounded-2xl border border-[#E7E1D8] bg-white p-8 shadow-card">
            <EmptyState title="No studio entities found" message="Add your primary studio profile or framing workshop." />
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
                        {[entity.city, entity.state, entity.pincode].filter(Boolean).join(", ") || "Location not set"}
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
                      <span className="truncate">{entity.upi_id || entity.gstin || "No UPI / GSTIN"}</span>
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
                  </div>
                  {!entity.is_primary && (
                    <button
                      type="button"
                      onClick={() => promotePrimaryMutation.mutate(entity.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#D1E0CE] bg-[#EAF0E8] px-3 py-1.5 text-xs font-medium text-[#475E42] hover:bg-[#DCE7D9] transition-colors"
                    >
                      <Star className="h-3.5 w-3.5" />
                      <span>Set Primary</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Vendors Tab */
        isLoadingVendors ? (
          <LoadingState message="Loading vendors..." />
        ) : isErrorVendors ? (
          <ErrorState message="Unable to load vendors." onRetry={() => refetchVendors()} />
        ) : (
          <div className="rounded-2xl border border-[#E7E1D8] bg-white p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg text-[#34312F]">Vendor & Partner Entities</h3>
                <p className="text-xs text-[#817872]">
                  Registered material suppliers, printing houses, and couriers linked to expense records.
                </p>
              </div>
              <button
                type="button"
                onClick={openAddVendor}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E1D8] bg-[#F7F4F0] px-3.5 py-2 text-xs font-medium text-[#34312F] hover:bg-[#F0ECE7]"
              >
                <Plus className="h-3.5 w-3.5" /> Register Vendor
              </button>
            </div>
            <div className="divide-y divide-[#F0ECE7]">
              {vendors.map((v) => (
                <div key={v.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#34312F]">{v.name}</span>
                      <StatusBadge status={v.entity_type} size="sm" />
                      {!v.is_active && <StatusBadge status="INACTIVE" size="sm" />}
                    </div>
                    <p className="text-[11px] text-[#817872] mt-0.5">
                      {[v.contact_person, v.phone, v.city].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-serif text-sm text-[#34312F]">{formatCurrency(v.total_spent || 0)}</span>
                    <p className="text-[10px] text-[#817872]">{v.expense_count || 0} bills recorded</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* User Create / Edit Modal */}
      <FormDialog
        isOpen={isUserModalOpen}
        onClose={closeUserModal}
        title={editingUser ? "Edit Operator Account" : "Invite / Add Dashboard User"}
        description="Configure account access credentials and operational role for this workspace."
        maxWidth="md"
      >
        <form onSubmit={handleUserSubmit} className="space-y-4">
          {userFormError && (
            <div className="rounded-xl border border-[#F2D0CE] bg-[#FAECEB] px-3.5 py-2.5 text-xs text-[#8F352A] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{userFormError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#34312F] mb-1">
              Full Name <span className="text-[#8F352A]">*</span>
            </label>
            <input
              type="text"
              value={uName}
              onChange={(e) => setUName(e.target.value)}
              placeholder="e.g. Nidha or Arun"
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">
                Email Address <span className="text-[#8F352A]">*</span>
              </label>
              <input
                type="email"
                value={uEmail}
                onChange={(e) => setUEmail(e.target.value)}
                placeholder="operator@ninuarts.com"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={uPhone}
                onChange={(e) => setUPhone(e.target.value)}
                placeholder="+91 94471 00000"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#34312F] mb-1">
              Dashboard Role <span className="text-[#8F352A]">*</span>
            </label>
            <select
              value={uRole}
              onChange={(e) => setURole(e.target.value as UserRole)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] bg-white focus:outline-[#34312F]"
            >
              <option value="STAFF">Staff Member (Orders, CRM, Deliveries, Catalog)</option>
              <option value="OWNER">Proprietor / Owner (Full Administrative, Financial & P&L)</option>
            </select>
            <p className="text-[11px] text-[#817872] mt-1 leading-relaxed">
              {uRole === "OWNER"
                ? "Full administrative authority over finance, expenses, analytics, audit logs, and settings."
                : "Operational access for order intake, lead tracking, and packaging without financial visibility."}
            </p>
          </div>

          {!editingUser && (
            <div>
              <label className="block text-xs font-medium text-[#34312F] mb-1">
                Initial Account Password <span className="text-[#8F352A]">*</span>
              </label>
              <input
                type="password"
                value={uPassword}
                onChange={(e) => setUPassword(e.target.value)}
                placeholder="At least 6 characters..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
                required
              />
            </div>
          )}

          <label className="inline-flex items-center gap-2 text-xs text-[#34312F] cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={uIsActive}
              onChange={(e) => setUIsActive(e.target.checked)}
              disabled={currentOperator?.id === editingUser?.id}
              className="rounded border-[#E7E1D8] text-[#34312F] focus:ring-[#34312F]"
            />
            <span>Active operator account (can sign in to dashboard)</span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F0ECE7]">
            <button
              type="button"
              onClick={closeUserModal}
              className="px-4 py-2 text-xs font-medium text-[#6B635B] hover:text-[#34312F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveUserMutation.isPending}
              className="px-4.5 py-2 rounded-xl bg-[#34312F] hover:bg-[#1F1D1C] text-white text-xs font-medium shadow-soft disabled:opacity-50 transition-colors"
            >
              {saveUserMutation.isPending ? "Saving..." : editingUser ? "Save Changes" : "Create Operator"}
            </button>
          </div>
        </form>
      </FormDialog>

      {/* Password Reset Modal */}
      <FormDialog
        isOpen={passwordResetUser !== null}
        onClose={() => setPasswordResetUser(null)}
        title="Reset Operator Password"
        description={`Set new sign-in password for ${passwordResetUser?.name} (${passwordResetUser?.email}).`}
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!passwordResetUser || newPassword.length < 6) {
              setPasswordResetError("Password must be at least 6 characters.");
              return;
            }
            resetPasswordMutation.mutate({ id: passwordResetUser.id, password: newPassword });
          }}
          className="space-y-4"
        >
          {passwordResetError && (
            <div className="rounded-xl border border-[#F2D0CE] bg-[#FAECEB] px-3.5 py-2.5 text-xs text-[#8F352A]">
              {passwordResetError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[#34312F] mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter at least 6 characters..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#E7E1D8] focus:outline-[#34312F]"
              required
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0ECE7]">
            <button
              type="button"
              onClick={() => setPasswordResetUser(null)}
              className="px-3.5 py-1.5 text-xs text-[#6B635B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetPasswordMutation.isPending}
              className="px-4 py-2 rounded-xl bg-[#34312F] text-white text-xs font-medium shadow-soft"
            >
              {resetPasswordMutation.isPending ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </FormDialog>

      {/* Operator Dossier Drawer */}
      <DetailDrawer
        isOpen={viewingUserId !== null}
        onClose={() => setViewingUserId(null)}
        title={userDossier?.user?.name || "Operator Dossier"}
        subtitle={userDossier?.user?.email}
        badge={
          userDossier?.user && (
            <div className="flex items-center gap-1.5">
              <StatusBadge status={userDossier.user.role} size="sm" />
              <StatusBadge status={userDossier.user.is_active ? "ACTIVE" : "INACTIVE"} size="sm" />
            </div>
          )
        }
        footer={
          userDossier?.user && (
            <>
              <button
                type="button"
                onClick={() => {
                  const u = userDossier.user;
                  setViewingUserId(null);
                  openEditUser(u);
                }}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-[#E7E1D8] text-[#34312F] hover:bg-[#F7F4F0]"
              >
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => setViewingUserId(null)}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-[#34312F] text-white hover:bg-[#1F1D1C]"
              >
                Close
              </button>
            </>
          )
        }
      >
        {isLoadingUserDossier ? (
          <LoadingState message="Loading operator dossier..." />
        ) : userDossier?.user ? (
          <div className="space-y-6 text-xs">
            {/* Operational Counters */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#F7F4F0] border border-[#E7E1D8]">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#817872]">
                  Orders Created
                </span>
                <div className="text-2xl font-serif text-[#34312F] mt-1">
                  {userDossier.stats.orders_created}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F7F4F0] border border-[#E7E1D8]">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#817872]">
                  Payments Recorded
                </span>
                <div className="text-2xl font-serif text-[#34312F] mt-1">
                  {userDossier.stats.payments_recorded}
                </div>
              </div>
            </div>

            {/* Role & Access Permissions Matrix Card */}
            <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#E7E1D8] space-y-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#7A4B43]" />
                <h4 className="font-serif text-sm text-[#34312F]">
                  Permissions & Role Scoping
                </h4>
              </div>
              <p className="text-[#6B635B] leading-relaxed">
                {userDossier.user.role === "OWNER"
                  ? "Full administrative access: P&L financial analytics, operating expenses, user & entity management, master settings, and complete audit trail visibility."
                  : "Operational access: Customer CRM, lead intake, catalog management, order processing, and delivery status updates. Financial ledgers and settings are locked."}
              </p>
            </div>

            {/* Profile Coordinates */}
            <div className="space-y-2.5">
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Phone</span>
                <span className="font-medium text-[#34312F]">{userDossier.user.phone || "—"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Account Created</span>
                <span className="font-medium text-[#34312F]">{formatDate(userDossier.user.created_at || "")}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#F0ECE7]">
                <span className="text-[#817872]">Last Active Login</span>
                <span className="font-medium text-[#34312F]">
                  {userDossier.user.last_login_at ? formatDate(userDossier.user.last_login_at) : "No login recorded"}
                </span>
              </div>
            </div>

            {/* Recent Activity Trail */}
            {userDossier.recent_activity.length > 0 && (
              <div>
                <h4 className="text-[10px] uppercase font-semibold tracking-wider text-[#817872] mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Recent Operator Actions</span>
                </h4>
                <div className="space-y-1.5">
                  {userDossier.recent_activity.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-[#F7F4F0] border border-[#E7E1D8] text-[11px] text-[#6B635B]"
                    >
                      <span className="font-medium text-[#34312F]">{log.description}</span>
                      <div className="text-[10px] text-[#817872] mt-0.5">
                        {formatDate(log.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DetailDrawer>

      {/* Delete User Confirmation */}
      <ConfirmationDialog
        isOpen={deletingUser !== null}
        onClose={() => setDeletingUser(null)}
        onConfirm={() => deletingUser && deleteUserMutation.mutate(deletingUser.id)}
        title="Delete Operator Account"
        message={
          deletingUser
            ? `Delete operator "${deletingUser.name}"? If this operator has recorded past orders or payments, deletion is blocked to preserve audit records. Deactivate the account instead.`
            : ""
        }
        confirmText={deleteUserMutation.isPending ? "Deleting..." : "Delete Operator"}
        variant="danger"
      />

      {/* Delete Vendor Confirmation */}
      <ConfirmationDialog
        isOpen={deletingVendor !== null}
        onClose={() => setDeletingVendor(null)}
        onConfirm={() => deletingVendor && deleteVendorMutation.mutate(deletingVendor.id)}
        title="Delete Vendor Entity"
        message={deletingVendor ? `Delete vendor "${deletingVendor.name}"?` : ""}
        confirmText={deleteVendorMutation.isPending ? "Deleting..." : "Delete Vendor"}
        variant="danger"
      />
    </div>
  );
}
