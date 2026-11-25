import React from "react";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { FormDialog } from "./FormDialog";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmationDialogProps) {
  const icons = {
    danger: <AlertTriangle className="h-5 w-5 text-[#C96A5B]" />,
    warning: <AlertCircle className="h-5 w-5 text-[#D4A373]" />,
    info: <Info className="h-5 w-5 text-[#34312F]" />,
  };

  const buttonClasses = {
    danger: "bg-[#C96A5B] hover:bg-[#B55B4D] text-white shadow-soft",
    warning: "bg-[#D4A373] hover:bg-[#C29362] text-white shadow-soft",
    info: "bg-[#34312F] hover:bg-[#1F1D1C] text-white shadow-soft",
  }[variant];

  return (
    <FormDialog isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="flex items-start gap-3">
        <div className="shrink-0 p-2 bg-[#F7F4F0] rounded-xl border border-[#E7E1D8]">{icons[variant]}</div>
        <p className="text-xs leading-relaxed text-[#6B635B] mt-0.5">{message}</p>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[#F0ECE7] pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="rounded-xl border border-[#E7E1D8] bg-white px-3.5 py-2 text-xs font-medium text-[#6B635B] hover:bg-[#F7F4F0] transition-colors"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          disabled={isLoading}
          className={`rounded-xl px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${buttonClasses}`}
        >
          {confirmText}
        </button>
      </div>
    </FormDialog>
  );
}
