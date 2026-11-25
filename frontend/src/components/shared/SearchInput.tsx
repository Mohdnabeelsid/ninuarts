import React from "react";
import { Search, X } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onClear?: () => void;
  autoFocus?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search orders, customers, contacts...",
  className = "",
  onClear,
  autoFocus = false,
}: SearchInputProps) {
  return (
    <div className={`relative flex items-center w-full max-w-md ${className}`}>
      <Search className="absolute left-3.5 h-4 w-4 text-[#817872] pointer-events-none shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-10 w-full rounded-xl border border-[#E7E1D8] bg-white pl-10 pr-9 text-xs text-[#34312F] placeholder:text-[#817872]/60 focus:border-[#34312F] focus:outline-none focus:ring-1 focus:ring-[#34312F] transition-all shadow-card"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          className="absolute right-2.5 rounded-full p-1 text-[#817872] hover:bg-[#F7F4F0] hover:text-[#34312F] transition-colors"
          title="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
