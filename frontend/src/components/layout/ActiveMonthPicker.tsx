import React, { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, Check, RotateCcw } from "lucide-react";
import { useActivePeriod } from "../../contexts/ActivePeriodContext";

export function ActiveMonthPicker() {
  const {
    activePeriod,
    setActivePeriodMonth,
    setAllPeriods,
    resetToCurrentMonth,
    isCurrentMonth,
    isAllPeriods,
    availableMonths,
  } = useActivePeriod();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-all shadow-card ${
          isCurrentMonth
            ? "border-[#E7E1D8] bg-white text-[#34312F] hover:bg-[#F7F4F0]"
            : "border-[#E8D8D4] bg-[#F5ECE9] text-[#7A4B43]"
        }`}
        title="Switch active month view"
      >
        <Calendar className={`h-3.5 w-3.5 ${isCurrentMonth ? "text-[#817872]" : "text-[#7A4B43]"}`} />
        <span className="font-medium">{activePeriod.displayLabel}</span>
        {!isCurrentMonth && (
          <span className="rounded-full bg-[#E8D8D4] px-1.5 py-0.5 text-[10px] font-medium text-[#7A4B43]">
            {isAllPeriods ? "ALL" : "FILTERED"}
          </span>
        )}
        <ChevronDown className="h-3 w-3 text-[#817872]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-[#E7E1D8] bg-white p-2.5 shadow-soft animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between border-b border-[#F0ECE7] px-2 py-1.5 pb-2 gap-1">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#817872]">
                Working Month Scope
              </p>
              <p className="text-[11px] text-[#817872]/80">
                Data across the entire system reflects this scope
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!isAllPeriods && (
                <button
                  type="button"
                  onClick={() => {
                    setAllPeriods();
                    setIsOpen(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#F7F4F0] px-2 py-1 text-[10px] font-medium text-[#34312F] hover:bg-[#F0ECE7] transition-colors border border-[#E7E1D8]"
                  title="Show all months cumulatively"
                >
                  <span>All</span>
                </button>
              )}
              {!isCurrentMonth && (
                <button
                  type="button"
                  onClick={() => {
                    resetToCurrentMonth();
                    setIsOpen(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#F7F4F0] px-2 py-1 text-[10px] font-medium text-[#34312F] hover:bg-[#F0ECE7] transition-colors border border-[#E7E1D8]"
                  title="Reset to current month"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  <span>Today</span>
                </button>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-0.5 py-1">
            {availableMonths.map((period) => {
              const isSelected =
                period.year === activePeriod.year && period.month === activePeriod.month;
              return (
                <button
                  key={period.formatted}
                  type="button"
                  onClick={() => {
                    setActivePeriodMonth(period.year, period.month);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-left transition-colors ${
                    isSelected
                      ? "bg-[#F7F4F0] font-medium text-[#34312F]"
                      : "text-[#6B635B] hover:bg-[#FDFBF7] hover:text-[#34312F]"
                  }`}
                >
                  <span>{period.displayLabel}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-[#34312F]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
