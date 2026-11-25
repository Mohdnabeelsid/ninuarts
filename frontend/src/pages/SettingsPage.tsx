import React from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { ActiveMonthPicker } from "../components/layout/ActiveMonthPicker";
import { useActivePeriod } from "../contexts/ActivePeriodContext";
import { useAuth } from "../contexts/AuthContext";
import { Shield, Calendar, Store, Clock, Database, Sparkles } from "lucide-react";

export function SettingsPage() {
  const { activePeriod } = useActivePeriod();
  const { user } = useAuth();

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
        <h3 className="text-sm font-serif font-normal text-[#34312F] flex items-center gap-2">
          <Store className="h-4 w-4 text-[#817872]" />
          <span>Brand & Operating Profile</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-[10px] uppercase font-semibold text-[#817872]">Brand Name</p>
            <p className="font-medium text-[#34312F] mt-0.5">Ninu Arts</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-[#817872]">Proprietor / Operator</p>
            <p className="font-medium text-[#34312F] mt-0.5">Nidha</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-[#817872]">Studio Location</p>
            <p className="font-medium text-[#34312F] mt-0.5">Alappuzha, Kerala, India</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-[#817872]">Operational Currency</p>
            <p className="font-medium text-[#34312F] mt-0.5">Indian Rupee (INR / ₹)</p>
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
