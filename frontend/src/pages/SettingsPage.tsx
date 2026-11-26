import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/layout/PageHeader";
import { ActiveMonthPicker } from "../components/layout/ActiveMonthPicker";
import { useActivePeriod } from "../contexts/ActivePeriodContext";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../lib/api";
import { BusinessEntity } from "../types";
import { Calendar, Store, Clock, ArrowRight } from "lucide-react";

export function SettingsPage() {
  const { activePeriod } = useActivePeriod();
  const { user } = useAuth();

  const { data: primaryEntity } = useQuery<BusinessEntity | null>({
    queryKey: ["business-entities", "primary-summary"],
    queryFn: async () => {
      const res = await apiClient.get("/business-entities");
      return (res.data?.meta?.primary_entity || res.data?.data?.[0] || null) as BusinessEntity | null;
    },
  });

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <PageHeader
        title="Settings & Studio Profile"
        description="Global workspace controls, active working month period, business profile, and operator accounts."
      />

      {/* Global Active Working Month Configuration (FR-PER) */}
      <div className="rounded-2xl border border-[#E7E1D8] bg-white p-6 shadow-card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-serif font-normal text-[#34312F] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#817872]" />
              <span>Global Working Month Scope</span>
            </h3>
            <p className="text-xs text-[#817872] mt-1 max-w-xl leading-relaxed">
              By default, Ninu Arts displays operations for the current calendar month.
              You can switch the global active viewing month here (or pick All Time for cumulative views),
              instantly scoping KPIs, orders, expenses, and payment ledgers.
            </p>
          </div>
          <div className="shrink-0">
            <ActiveMonthPicker />
          </div>
        </div>

        <div className="bg-[#F7F4F0] rounded-xl p-3.5 border border-[#E7E1D8] text-xs">
          <p className="text-[#6B635B]">
            <strong className="text-[#34312F]">Currently Active Period:</strong> {activePeriod.displayLabel} (
            <code className="text-[#34312F] font-mono">{activePeriod.formatted}</code>)
          </p>
        </div>
      </div>

      {/* Business Entity Profile */}
      <div className="rounded-2xl border border-[#E7E1D8] bg-white p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-serif font-normal text-[#34312F] flex items-center gap-2">
            <Store className="h-4 w-4 text-[#817872]" />
            <span>Brand & Operating Profile</span>
          </h3>
          <Link
            to="/entities"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7A4B43] hover:text-[#34312F] transition-colors"
          >
            <span>Manage Studio & Vendor Entities</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-[10px] uppercase font-semibold text-[#817872]">Primary Studio Entity</p>
            <p className="font-medium text-[#34312F] mt-0.5">
              {primaryEntity?.name || "Ninu Arts"}{" "}
              {primaryEntity?.code ? `(${primaryEntity.code})` : ""}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-[#817872]">Proprietor / Legal Name</p>
            <p className="font-medium text-[#34312F] mt-0.5">
              {primaryEntity?.legal_name || "Nidha"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-[#817872]">Studio Location</p>
            <p className="font-medium text-[#34312F] mt-0.5">
              {[primaryEntity?.city || "Alappuzha", primaryEntity?.state || "Kerala", "India"]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-[#817872]">
              {primaryEntity?.upi_id ? "Primary UPI / Tax ID" : "Operational Currency"}
            </p>
            <p className="font-medium text-[#34312F] mt-0.5">
              {primaryEntity?.upi_id || primaryEntity?.gstin || "Indian Rupee (INR / ₹)"}
            </p>
          </div>
        </div>
      </div>

      {/* Phased Deployment Timeline */}
      <div className="rounded-2xl border border-[#E7E1D8] bg-white p-6 shadow-card space-y-4">
        <h3 className="text-sm font-serif font-normal text-[#34312F] flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#817872]" />
          <span>Application Modules & Live Services</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-[#F7F4F0] border border-[#E7E1D8]">
            <p className="font-medium text-[#34312F]">Backend API Service</p>
            <p className="text-[11px] text-[#817872] mt-0.5">Laravel 11 REST API • SQLite Database</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F7F4F0] border border-[#E7E1D8]">
            <p className="font-medium text-[#34312F]">Frontend Architecture</p>
            <p className="text-[11px] text-[#817872] mt-0.5">React 18 • TypeScript • Tailwind CSS</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F7F4F0] border border-[#E7E1D8]">
            <p className="font-medium text-[#34312F]">Design Language</p>
            <p className="text-[11px] text-[#817872] mt-0.5">Soft Editorial × Premium Boutique SaaS</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F7F4F0] border border-[#E7E1D8]">
            <p className="font-medium text-[#34312F]">Operator Session</p>
            <p className="text-[11px] text-[#817872] mt-0.5">{user?.name || "Nidha"} ({user?.role || "OWNER"})</p>
          </div>
        </div>
      </div>
    </div>
  );
}
