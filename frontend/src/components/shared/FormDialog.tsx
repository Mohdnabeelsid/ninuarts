import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface FormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

export function FormDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "md",
}: FormDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

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

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#34312F]/30 backdrop-blur-sm transition-opacity animate-in fade-in-50"
        onClick={onClose}
      />

      {/* Modal Surface */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidthClasses} rounded-2xl border border-[#E7E1D8] bg-white p-6 shadow-soft transition-all animate-in fade-in-50 zoom-in-95 my-8`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#F0ECE7] pb-4">
          <div>
            <h2 className="font-serif text-xl font-normal text-[#34312F]">{title}</h2>
            {description && (
              <p className="mt-1 text-xs text-[#817872]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-[#817872] hover:bg-[#F7F4F0] hover:text-[#34312F] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
