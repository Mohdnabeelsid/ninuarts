import React from "react";
import { OrderStatus, PaymentStatus, EnquiryStatus } from "../../types";

type BadgeType = OrderStatus | PaymentStatus | EnquiryStatus | string;

interface StatusBadgeProps {
  status: BadgeType;
  type?: "order" | "payment" | "enquiry" | "general";
  className?: string;
  size?: "sm" | "md";
}

const BADGE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string; border: string }
> = {
  // Order Statuses
  DRAFT: {
    label: "Draft",
    bg: "bg-[#F4F1ED]",
    text: "text-[#6B635B]",
    border: "border-[#E5DFD7]",
    dot: "bg-[#9E958C]",
  },
  PENDING_ADVANCE: {
    label: "Awaiting Advance",
    bg: "bg-[#FAF0E6]",
    text: "text-[#8C6239]",
    border: "border-[#F0DDC7]",
    dot: "bg-[#D4A373]",
  },
  CONFIRMED: {
    label: "Confirmed",
    bg: "bg-[#EAF0E8]",
    text: "text-[#475E42]",
    border: "border-[#D1E0CE]",
    dot: "bg-[#8B9B86]",
  },
  IN_PROGRESS: {
    label: "In Crafting",
    bg: "bg-[#F5ECE9]",
    text: "text-[#7A4B43]",
    border: "border-[#E8D8D4]",
    dot: "bg-[#C4928A]",
  },
  READY_FOR_DELIVERY: {
    label: "Ready for Dispatch",
    bg: "bg-[#F0EFF5]",
    text: "text-[#544E6E]",
    border: "border-[#DDD9E8]",
    dot: "bg-[#8278A3]",
  },
  READY: {
    label: "Ready",
    bg: "bg-[#F0EFF5]",
    text: "text-[#544E6E]",
    border: "border-[#DDD9E8]",
    dot: "bg-[#8278A3]",
  },
  ON_HOLD: {
    label: "On Hold",
    bg: "bg-[#FAF0E6]",
    text: "text-[#8C6239]",
    border: "border-[#F0DDC7]",
    dot: "bg-[#D4A373]",
  },
  DISPATCHED: {
    label: "Dispatched",
    bg: "bg-[#EBF2F7]",
    text: "text-[#3D5B73]",
    border: "border-[#CFDFEB]",
    dot: "bg-[#6E95B8]",
  },
  DELIVERED: {
    label: "Delivered",
    bg: "bg-[#EAF0E8]",
    text: "text-[#475E42]",
    border: "border-[#D1E0CE]",
    dot: "bg-[#8B9B86]",
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "bg-[#FAECEB]",
    text: "text-[#8F352A]",
    border: "border-[#F2D0CE]",
    dot: "bg-[#C96A5B]",
  },

  // Payment Statuses
  UNPAID: {
    label: "Unpaid",
    bg: "bg-[#FAECEB]",
    text: "text-[#8F352A]",
    border: "border-[#F2D0CE]",
    dot: "bg-[#C96A5B]",
  },
  PENDING: {
    label: "Pending",
    bg: "bg-[#FAF0E6]",
    text: "text-[#8C6239]",
    border: "border-[#F0DDC7]",
    dot: "bg-[#D4A373]",
  },
  PARTIALLY_PAID: {
    label: "Partially Paid",
    bg: "bg-[#FAF0E6]",
    text: "text-[#8C6239]",
    border: "border-[#F0DDC7]",
    dot: "bg-[#D4A373]",
  },
  PARTIAL: {
    label: "Partially Paid",
    bg: "bg-[#FAF0E6]",
    text: "text-[#8C6239]",
    border: "border-[#F0DDC7]",
    dot: "bg-[#D4A373]",
  },
  PAID: {
    label: "Fully Paid",
    bg: "bg-[#EAF0E8]",
    text: "text-[#475E42]",
    border: "border-[#D1E0CE]",
    dot: "bg-[#8B9B86]",
  },
  OVERPAID: {
    label: "Overpaid",
    bg: "bg-[#EBF2F7]",
    text: "text-[#3D5B73]",
    border: "border-[#CFDFEB]",
    dot: "bg-[#6E95B8]",
  },
  REFUNDED: {
    label: "Refunded",
    bg: "bg-[#FAECEB]",
    text: "text-[#8F352A]",
    border: "border-[#F2D0CE]",
    dot: "bg-[#C96A5B]",
  },

  // Enquiry Statuses
  NEW: {
    label: "New Lead",
    bg: "bg-[#F5ECE9]",
    text: "text-[#7A4B43]",
    border: "border-[#E8D8D4]",
    dot: "bg-[#C4928A]",
  },
  CONTACTED: {
    label: "Contacted",
    bg: "bg-[#FAF0E6]",
    text: "text-[#8C6239]",
    border: "border-[#F0DDC7]",
    dot: "bg-[#D4A373]",
  },
  DISCUSSING: {
    label: "Discussing",
    bg: "bg-[#EBF2F7]",
    text: "text-[#3D5B73]",
    border: "border-[#CFDFEB]",
    dot: "bg-[#6E95B8]",
  },
  QUOTED: {
    label: "Quoted",
    bg: "bg-[#F0EFF5]",
    text: "text-[#544E6E]",
    border: "border-[#DDD9E8]",
    dot: "bg-[#8278A3]",
  },
  ESTIMATE_SENT: {
    label: "Estimate Sent",
    bg: "bg-[#F0EFF5]",
    text: "text-[#544E6E]",
    border: "border-[#DDD9E8]",
    dot: "bg-[#8278A3]",
  },
  QUOTE_SENT: {
    label: "Quote Sent",
    bg: "bg-[#F0EFF5]",
    text: "text-[#544E6E]",
    border: "border-[#DDD9E8]",
    dot: "bg-[#8278A3]",
  },
  CONVERTED: {
    label: "Converted",
    bg: "bg-[#EAF0E8]",
    text: "text-[#475E42]",
    border: "border-[#D1E0CE]",
    dot: "bg-[#8B9B86]",
  },
  LOST: {
    label: "Lost",
    bg: "bg-[#F4F1ED]",
    text: "text-[#6B635B]",
    border: "border-[#E5DFD7]",
    dot: "bg-[#9E958C]",
  },

  // Delivery Statuses
  READY_FOR_DISPATCH: {
    label: "Ready for Dispatch",
    bg: "bg-[#F0EFF5]",
    text: "text-[#544E6E]",
    border: "border-[#DDD9E8]",
    dot: "bg-[#8278A3]",
  },
  IN_TRANSIT: {
    label: "In Transit",
    bg: "bg-[#EBF2F7]",
    text: "text-[#3D5B73]",
    border: "border-[#CFDFEB]",
    dot: "bg-[#6E95B8]",
  },
  DELIVERY_FAILED: {
    label: "Failed",
    bg: "bg-[#FAECEB]",
    text: "text-[#8F352A]",
    border: "border-[#F2D0CE]",
    dot: "bg-[#C96A5B]",
  },
  RETURNED: {
    label: "Returned",
    bg: "bg-[#FAECEB]",
    text: "text-[#8F352A]",
    border: "border-[#F2D0CE]",
    dot: "bg-[#C96A5B]",
  },

  // General States
  ACTIVE: {
    label: "Active",
    bg: "bg-[#EAF0E8]",
    text: "text-[#475E42]",
    border: "border-[#D1E0CE]",
    dot: "bg-[#8B9B86]",
  },
  INACTIVE: {
    label: "Inactive",
    bg: "bg-[#F4F1ED]",
    text: "text-[#6B635B]",
    border: "border-[#E5DFD7]",
    dot: "bg-[#9E958C]",
  },

  // Entity Management Types
  PRIMARY: {
    label: "Primary Studio",
    bg: "bg-[#EAF0E8]",
    text: "text-[#475E42]",
    border: "border-[#D1E0CE]",
    dot: "bg-[#8B9B86]",
  },
  STUDIO: {
    label: "Studio",
    bg: "bg-[#F5ECE9]",
    text: "text-[#7A4B43]",
    border: "border-[#E8D8D4]",
    dot: "bg-[#C4928A]",
  },
  BRANCH: {
    label: "Branch",
    bg: "bg-[#EBF2F7]",
    text: "text-[#3D5B73]",
    border: "border-[#CFDFEB]",
    dot: "bg-[#6E95B8]",
  },
  WORKSHOP: {
    label: "Workshop",
    bg: "bg-[#FAF0E6]",
    text: "text-[#8C6239]",
    border: "border-[#F0DDC7]",
    dot: "bg-[#D4A373]",
  },
  BRAND: {
    label: "Brand",
    bg: "bg-[#F0EFF5]",
    text: "text-[#544E6E]",
    border: "border-[#DDD9E8]",
    dot: "bg-[#8278A3]",
  },
  SUPPLIER: {
    label: "Material Supplier",
    bg: "bg-[#FAF0E6]",
    text: "text-[#8C6239]",
    border: "border-[#F0DDC7]",
    dot: "bg-[#D4A373]",
  },
  PRINT_PARTNER: {
    label: "Print Partner",
    bg: "bg-[#F0EFF5]",
    text: "text-[#544E6E]",
    border: "border-[#DDD9E8]",
    dot: "bg-[#8278A3]",
  },
  COURIER: {
    label: "Courier Partner",
    bg: "bg-[#EBF2F7]",
    text: "text-[#3D5B73]",
    border: "border-[#CFDFEB]",
    dot: "bg-[#6E95B8]",
  },
  SERVICE: {
    label: "Service Vendor",
    bg: "bg-[#F4F1ED]",
    text: "text-[#6B635B]",
    border: "border-[#E5DFD7]",
    dot: "bg-[#9E958C]",
  },
};

export function StatusBadge({ status, className = "", size = "md" }: StatusBadgeProps) {
  const config = BADGE_CONFIG[status] || {
    label: status.replace(/_/g, " "),
    bg: "bg-[#F4F1ED]",
    text: "text-[#6B635B]",
    border: "border-[#E5DFD7]",
    dot: "bg-[#9E958C]",
  };

  const isSmall = size === "sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors border ${config.bg} ${config.text} ${config.border} ${
        isSmall
          ? "px-2 py-0.5 text-[10px] tracking-wide"
          : "px-2.5 py-1 text-xs tracking-wide"
      } ${className}`}
    >
      <span className={`rounded-full shrink-0 ${isSmall ? "h-1.5 w-1.5" : "h-2 w-2"} ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
}
