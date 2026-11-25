import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg" | "xl";
}

export function DetailDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
  width = "lg",
}: DetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    md: "max-w-md",
    lg: "max-w-lg sm:max-w-xl",
    xl: "max-w-2xl",
  }[width];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#34312F]/30 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          className={`w-screen ${widthClasses} bg-white border-l border-[#E7E1D8] shadow-drawer flex flex-col justify-between transition-all duration-300 ease-in-out animate-in slide-in-from-right`}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#F0ECE7] px-6 py-5 bg-[#FDFBF7]/80">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h2 className="font-serif text-xl sm:text-2xl font-normal text-[#34312F]">
                  {title}
                </h2>
                {badge}
              </div>
              {subtitle && (
                <p className="text-xs text-[#817872]">{subtitle}</p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-[#817872] hover:bg-[#F7F4F0] hover:text-[#34312F] transition-colors"
              title="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {children}
          </div>

          {/* Optional Footer */}
          {footer && (
            <div className="border-t border-[#F0ECE7] px-6 py-4 bg-[#FDFBF7] flex items-center justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
