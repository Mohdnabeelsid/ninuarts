import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/layout/PageHeader";
import { DataTable, Column } from "../components/shared/DataTable";
import { SearchInput } from "../components/shared/SearchInput";
import { FilterDropdown } from "../components/shared/FilterDropdown";
import { LoadingState } from "../components/shared/LoadingState";
import { ErrorState } from "../components/shared/ErrorState";
import { EmptyState } from "../components/shared/EmptyState";
import { apiClient } from "../lib/api";
import { ActivityLog } from "../types";
import { useDashboardSearch } from "../layouts/DashboardLayout";

export function ActivityLogsPage() {
  const globalSearch = useDashboardSearch();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  const { data: logs = [], isLoading, isError, refetch } = useQuery<ActivityLog[]>({
    queryKey: ["activity-logs", actionFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = { per_page: 100 };
      if (actionFilter !== "ALL") {
        params.action = actionFilter;
      }
      const res = await apiClient.get("/activity-logs", { params });
      return (res.data?.data || []) as ActivityLog[];
    },
  });

  const filtered = logs.filter((log) => {
    const q = (search || globalSearch).trim().toLowerCase();
    if (!q) return true;
    return (
      log.description?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.entity_type?.toLowerCase().includes(q) ||
      log.user?.name?.toLowerCase().includes(q)
    );
  });

  const columns: Column<ActivityLog>[] = [
    {
      header: "Timestamp",
      cell: (row) => (
        <span className="font-mono text-xs text-[#817872]">
          {new Date(row.created_at).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      header: "Operator",
      cell: (row) => (
        <span className="font-medium text-[#34312F]">{row.user?.name || "System"}</span>
      ),
    },
    {
      header: "Action Tag",
      cell: (row) => (
        <span className="rounded-full bg-[#F5ECE9] border border-[#E8D8D4] px-2.5 py-0.5 text-[10px] font-mono font-medium text-[#7A4B43]">
          {row.action}
        </span>
      ),
    },
    {
      header: "Entity",
      cell: (row) => (
        <span className="text-[#817872] font-medium">
          {row.entity_type} #{row.entity_id}
        </span>
      ),
    },
    {
      header: "Audit Description",
      cell: (row) => (
        <p className="text-[#34312F] text-xs font-normal max-w-md">{row.description}</p>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Immutable Activity & Audit Trail"
        description="Live database audit trail of order amendments, payments, refunds, expenses, and operator logins."
      />

      <div className="bg-white p-4 rounded-2xl border border-[#E7E1D8] shadow-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search activity records, operators, entities..."
        />
        <FilterDropdown
          label="Action Type"
          selectedValue={actionFilter}
          onChange={setActionFilter}
          options={[
            { label: "All Actions", value: "ALL" },
            { label: "Order Created", value: "ORDER_CREATED" },
            { label: "Order Modified", value: "ORDER_MODIFIED" },
            { label: "Order Status Changed", value: "ORDER_STATUS_CHANGED" },
            { label: "Payment Recorded", value: "PAYMENT_RECORDED" },
            { label: "Refund Processed", value: "REFUND_PROCESSED" },
            { label: "Expense Created", value: "EXPENSE_CREATED" },
            { label: "Delivery Status Changed", value: "DELIVERY_STATUS_CHANGED" },
            { label: "Lead Converted", value: "LEAD_CONVERTED" },
            { label: "User Login", value: "USER_LOGIN" },
          ]}
        />
      </div>

      {isLoading ? (
        <LoadingState message="Loading immutable audit logs..." />
      ) : isError ? (
        <ErrorState message="Failed to load audit trail logs." onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No audit events found"
          message="Activity logs are automatically recorded whenever operators sign in or modify business records."
        />
      ) : (
        <DataTable data={filtered} columns={columns} pageSize={15} />
      )}
    </div>
  );
}
