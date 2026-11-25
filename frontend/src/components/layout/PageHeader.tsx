import React from "react";
import { Calendar } from "lucide-react";
import { useActivePeriod } from "../../contexts/ActivePeriodContext";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  showPeriodBadge?: boolean;
}

export function PageHeader({
  title,
  description,
  actions,
  showPeriodBadge = true,
}: PageHeaderProps) {
  const { activePeriod, isCurrentMonth } = useActivePeriod();

  return (
    <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-center sm:justify-between border-b border-[#E7E1D8] mb-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-[#34312F]">
            {title}
          </h1>
          {showPeriodBadge && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-wide ${
                isCurrentMonth
                  ? "bg-[#F7F4F0] text-[#6B635B] border border-[#E7E1D8]"
                  : "bg-[#F5ECE9] text-[#7A4B43] border border-[#E8D8D4]"
              }`}
              title="Global Active Working Month Scope"
            >
              <Calendar className="h-3 w-3" />
              <span>{activePeriod.displayLabel}</span>
              {!isCurrentMonth && <span className="font-semibold text-[#C96A5B]">(Scoped)</span>}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-[#817872] max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}
