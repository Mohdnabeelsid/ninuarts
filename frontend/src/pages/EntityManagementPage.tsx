import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  ShieldCheck,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  Eye,
  KeyRound,
  Power,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  Check,
  X,
  ShieldAlert,
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
import { formatDate, getApiErrorMessage } from "../lib/utils";
import { apiClient } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { User, UserDossier, UserRole } from "../types";
import { useDashboardSearch } from "../layouts/DashboardLayout";

type ActiveTab = "OPERATORS" | "ROLES_PERMISSIONS";

interface PermissionItem {
  name: string;
  granted: boolean;
}

interface RoleConfig {
  name: string;
  code: UserRole;
  badge: string;
  description: string;
  permissions: PermissionItem[];
}

const DEFAULT_ROLES_CONFIG: Record<UserRole, RoleConfig> = {
  OWNER: {
    name: "Proprietor (Owner)",
    code: "OWNER",
    badge: "OWNER",
    description: "Full administrative, financial, operational, and team governance authority.",
    permissions: [
      { name: "Financial P&L & Cash Collections", granted: true },
      { name: "Expense Ledger & Receipt Audits", granted: true },
      { name: "Customer CRM & Lifetime Value", granted: true },
      { name: "Order Management & Price Modifications", granted: true },
      { name: "Refund Processing & Adjustments", granted: true },
      { name: "Deliveries, Logistics & Courier Tracking", granted: true },
      { name: "Product Catalog & Pricing Control", granted: true },
      { name: "Activity Audit Logs (Immutable Trail)", granted: true },
      { name: "Operator & Role Management", granted: true },
      { name: "Workspace Settings & Active Month Scope", granted: true },
    ],
  },
  STAFF: {
    name: "Staff Member",
    code: "STAFF",
    badge: "STAFF",
    description: "Assists with customer inquiries, daily order intake, catalog updates, and shipping dispatches.",
    permissions: [
      { name: "Financial P&L & Cash Collections", granted: false },
      { name: "Expense Ledger & Receipt Audits", granted: false },
      { name: "Customer CRM & Contact Info", granted: true },
      { name: "Order Intake & Status Progressions", granted: true },
      { name: "Refund Processing & Adjustments", granted: false },
      { name: "Deliveries, Logistics & Courier Tracking", granted: true },
      { name: "Product Catalog & Offerings View", granted: true },
      { name: "Activity Audit Logs (Immutable Trail)", granted: false },
      { name: "Operator & Role Management", granted: false },
      { name: "Workspace Settings & Active Month Scope", granted: false },
    ],
  },
};

export function EntityManagementPage() {
  const queryClient = useQueryClient();
  const globalSearch = useDashboardSearch();
  const { user: currentOperator } = useAuth();

  // Active view: Operators directory vs Roles & Permissions matrix
  const [activeTab, setActiveTab] = useState<ActiveTab>("OPERATORS");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Notifications feedback
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modals & Drawers
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [togglingUser, setTogglingUser] = useState<User | null>(null);
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

  const effectiveSearch = search || globalSearch;

  // ----------------------------------------------------
  // Query: Fetch Dashboard Users / Operators
  // ----------------------------------------------------
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

  // Query: Fetch Single User Dossier
  const { data: userDossier, isLoading: isLoadingUserDossier } = useQuery({
    queryKey: ["user-dossier", viewingUserId],
    enabled: viewingUserId !== null,
    queryFn: async () => {
      const res = await apiClient.get(`/users/${viewingUserId}`);
      return res.data?.data as UserDossier;
    },
  });

  const users = usersResp?.users || [];
  const userMeta = usersResp?.meta || { total: 0, active_count: 0, owner_count: 0, staff_count: 0 };
  const rolesMatrix = (usersResp?.meta?.roles_matrix as Record<UserRole, RoleConfig>) || DEFAULT_ROLES_CONFIG;

  // ----------------------------------------------------
  // Mutations
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
        message: editingUser ? "Operator profile updated." : "New operator account created.",
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
      setTogglingUser(null);
      setActionFeedback({ type: "success", message: "Operator active status updated." });
    },
    onError: (err: any) => {
      setTogglingUser(null);
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
      header: "Assigned Role",
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
      header: "Account Status",
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
            title="Edit Operator Profile & Role"
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
            title="Reset Password Credentials"
          >
            <KeyRound className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setTogglingUser(row)}
            disabled={currentOperator?.id === row.id}
            className="p-1.5 rounded-lg text-[#6B635B] hover:text-[#34312F] hover:bg-[#F7F4F0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={row.is_active ? "Deactivate Operator Account" : "Activate Operator Account"}
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
        description="Manage dashboard users, operator credentials, roles, and access permissions for Ninu Arts workspace."
        actions={
          <button
            type="button"
            onClick={openAddUser}
            className="inline-flex items-center gap-2 rounded-xl bg-[#34312F] px-4 py-2.5 text-xs font-medium text-white shadow-soft hover:bg-[#1F1D1C] transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Operator / User</span>
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

      {/* KPI Cards — Dashboard User & Role Governance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Dashboard Operators"
          value={userMeta.total || 0}
          subtitle={`${userMeta.active_count || 0} active workspace users`}
          icon={Users}
          onClick={() => {
            setActiveTab("OPERATORS");
            setRoleFilter("ALL");
          }}
        />
        <StatCard
          title="Active Sessions"
          value={userMeta.active_count || 0}
          subtitle="Permitted to sign in"
          icon={CheckCircle2}
          onClick={() => {
            setActiveTab("OPERATORS");
            setStatusFilter("ACTIVE");
          }}
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
          subtitle="Orders, CRM & logistics access"
          icon={UserCheck}
          onClick={() => {
            setActiveTab("OPERATORS");
            setRoleFilter("STAFF");
          }}
          highlight
        />
      </div>

      {/* Navigation Pills: Users vs Roles & Permissions */}
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
            <span>Dashboard Operators ({userMeta.total || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ROLES_PERMISSIONS")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
              activeTab === "ROLES_PERMISSIONS"
                ? "bg-[#34312F] text-white shadow-soft"
                : "text-[#6B635B] hover:text-[#34312F]"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Roles & Permissions Matrix</span>
          </button>
        </div>

        {activeTab === "OPERATORS" && (
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search operators by name, email, phone..."
              className="w-full sm:w-64"
            />

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
        )}
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
      ) : (
        /* Roles & Permissions Matrix View */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(["OWNER", "STAFF"] as UserRole[]).map((roleKey) => {
            const role = rolesMatrix[roleKey] || DEFAULT_ROLES_CONFIG[roleKey];
            const usersWithRole = users.filter((u) => u.role === roleKey);
            const isOwnerRole = roleKey === "OWNER";

            return (
              <div
                key={roleKey}
                className="rounded-2xl border border-[#E7E1D8] bg-white p-6 shadow-card flex flex-col justify-between gap-6"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                            isOwnerRole
                              ? "bg-[#F5ECE9] text-[#7A4B43]"
                              : "bg-[#EBF2F7] text-[#3D5B73]"
                          }`}
                        >
                          {isOwnerRole ? (
                            <ShieldCheck className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </div>
                        <h3 className="font-serif text-lg text-[#34312F]">{role.name}</h3>
                      </div>
                      <p className="text-xs text-[#817872] leading-relaxed pt-1">
                        {role.description}
                      </p>
                    </div>

                    <span className="rounded-full bg-[#F7F4F0] border border-[#E7E1D8] px-3 py-1 text-xs font-medium text-[#34312F]">
                      {usersWithRole.length} {usersWithRole.length === 1 ? "User" : "Users"}
                    </span>
                  </div>

                  {/* Assigned Operators Chips */}
                  <div className="pt-2 border-t border-[#F0ECE7]">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#817872] block mb-2">
                      Assigned Operators
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {usersWithRole.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setViewingUserId(u.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7E1D8] bg-[#FDFBF7] px-2.5 py-1 text-xs text-[#34312F] hover:bg-[#F7F4F0] transition-colors"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-[#8B9B86]" />
                          <span>{u.name}</span>
                          {!u.is_active && (
                            <span className="text-[10px] text-[#8F352A]">(Inactive)</span>
                          )}
                        </button>
                      ))}
                      {usersWithRole.length === 0 && (
                        <span className="text-xs text-[#817872] italic">No operators currently assigned</span>
                      )}
                    </div>
                  </div>

                  {/* Permissions Checklist */}
                  <div className="pt-2 border-t border-[#F0ECE7]">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#817872] block mb-2.5">
                      Permissions & Module Access
                    </span>
                    <div className="space-y-2">
                      {role.permissions.map((perm, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-[#FDFBF7]/60"
                        >
                          <span className={perm.granted ? "text-[#34312F]" : "text-[#817872]"}>
                            {perm.name}
                          </span>
                          {perm.granted ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#475E42]">
                              <Check className="h-3.5 w-3.5 text-[#8B9B86]" /> Granted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#817872]">
                              <Lock className="h-3 w-3 text-[#9E958C]" /> Restricted
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F0ECE7] flex items-center justify-between">
                  <span className="text-[11px] text-[#817872]">
                    Role ID: <code className="font-mono text-[#34312F]">{role.code}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("OPERATORS");
                      setRoleFilter(roleKey);
                    }}
                    className="text-xs font-medium text-[#7A4B43] hover:text-[#34312F] transition-colors"
                  >
                    View assigned operators →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* User Create / Edit Modal */}
      <FormDialog
        isOpen={isUserModalOpen}
        onClose={closeUserModal}
        title={editingUser ? "Edit Operator Account" : "Add Dashboard User / Operator"}
        description="Configure operator login credentials and access roles for the Ninu Arts workspace."
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
              Assigned Dashboard Role <span className="text-[#8F352A]">*</span>
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
                Sign-In Password <span className="text-[#8F352A]">*</span>
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

      {/* Toggle Active Confirmation */}
      <ConfirmationDialog
        isOpen={togglingUser !== null}
        onClose={() => setTogglingUser(null)}
        onConfirm={() => togglingUser && toggleUserActiveMutation.mutate(togglingUser)}
        title={togglingUser?.is_active ? "Deactivate Operator Account" : "Activate Operator Account"}
        message={
          togglingUser?.is_active
            ? `Deactivate ${togglingUser.name}? Their active sessions will be terminated and they will not be able to sign in until re-activated.`
            : `Re-activate ${togglingUser?.name}? They will be able to sign in with their existing credentials.`
        }
        confirmText={togglingUser?.is_active ? "Deactivate" : "Activate"}
        variant={togglingUser?.is_active ? "warning" : "info"}
      />

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
    </div>
  );
}
