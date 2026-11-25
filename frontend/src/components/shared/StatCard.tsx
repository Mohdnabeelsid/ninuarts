import React from "react";
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number; // e.g. +14 or -5
    direction: "up" | "down" | "neutral";
    label?: string; // e.g. "vs last month"
  };
  highlight?: boolean; // Accent highlight for critical metrics
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  highlight = false,
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-card transition-all duration-200 ${
        onClick ? "cursor-pointer hover:border-[#D6C4B5] hover:shadow-soft" : ""
      } ${
        highlight
          ? "border-[#E8D8D4] bg-gradient-to-br from-white to-[#FDF9F8]"
          : "border-[#E7E1D8]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#817872]">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="font-serif text-2xl lg:text-3xl tracking-tight text-[#34312F]">
              {value}
            </h3>
          </div>
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
            highlight
              ? "bg-[#F5ECE9] text-[#7A4B43]"
              : "bg-[#F7F4F0] text-[#34312F] group-hover:bg-[#E8D8D4]/40"
          }`}
        >
          <Icon className="h-5 w-5 stroke-[1.75]" />
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-3.5 flex items-center gap-2 pt-2.5 border-t border-[#F0ECE7] text-xs">
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 font-medium ${
                trend.direction === "up"
                  ? "text-[#475E42]"
                  : trend.direction === "down"
                  ? "text-[#8F352A]"
                  : "text-[#817872]"
              }`}
            >
              {trend.direction === "up" && <ArrowUpRight className="h-3.5 w-3.5" />}
              {trend.direction === "down" && <ArrowDownRight className="h-3.5 w-3.5" />}
              {trend.direction === "neutral" && <Minus className="h-3.5 w-3.5" />}
              {Math.abs(trend.value)}%
            </span>
          )}
          {trend?.label && (
            <span className="text-[#817872] font-normal">{trend.label}</span>
          )}
          {subtitle && !trend && (
            <span className="text-[#817872] font-normal">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
