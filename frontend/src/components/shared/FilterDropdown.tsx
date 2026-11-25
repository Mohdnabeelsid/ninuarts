import React, { useState, useRef, useEffect } from "react";
import { Filter, ChevronDown, Check } from "lucide-react";

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selectedValue: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterDropdown({
  label,
  options,
  selectedValue,
  onChange,
  className = "",
}: FilterDropdownProps) {
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

  const activeOption = options.find((opt) => opt.value === selectedValue);
  const isFiltered = selectedValue !== "" && selectedValue !== "ALL";

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex h-9.5 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-all shadow-card ${
          isFiltered
            ? "border-[#E8D8D4] bg-[#F5ECE9] text-[#7A4B43]"
            : "border-[#E7E1D8] bg-white text-[#34312F] hover:bg-[#F7F4F0]"
        }`}
      >
        <Filter className={`h-3.5 w-3.5 ${isFiltered ? "text-[#7A4B43]" : "text-[#817872]"}`} />
        <span>
          {isFiltered ? `${label}: ${activeOption?.label || selectedValue}` : label}
        </span>
        <ChevronDown className="h-3 w-3 text-[#817872]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1.5 w-52 origin-top-right rounded-xl border border-[#E7E1D8] bg-white py-1 shadow-soft">
          <div className="px-3 py-1.5 border-b border-[#F0ECE7] text-[10px] font-semibold uppercase tracking-wider text-[#817872]">
            Filter by {label}
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map((option) => {
              const isSelected = option.value === selectedValue;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3.5 py-2 text-xs text-left transition-colors ${
                    isSelected
                      ? "bg-[#F7F4F0] text-[#34312F] font-semibold"
                      : "text-[#6B635B] hover:bg-[#FDFBF7] hover:text-[#34312F]"
                  }`}
                >
                  <span>{option.label}</span>
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
