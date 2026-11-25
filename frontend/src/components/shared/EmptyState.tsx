import React from "react";
import { FolderOpen, LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  message,
  actionText,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7F4F0] text-[#817872] mb-3.5 border border-[#E7E1D8] shadow-soft">
        <Icon className="h-6 w-6 stroke-[1.5]" />
      </div>
      <h3 className="font-serif text-base text-[#34312F] mb-1">{title}</h3>
      <p className="text-xs text-[#817872] leading-relaxed mb-4">{message}</p>
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center rounded-xl bg-[#34312F] px-4 py-2 text-xs font-medium text-white shadow-soft hover:bg-[#1F1D1C] transition-colors"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
