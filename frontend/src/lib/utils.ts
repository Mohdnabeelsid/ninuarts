import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num || 0);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateStr);
  }
}

export function getApiErrorMessage(err: any, fallback = "Operation failed. Please check your inputs and try again."): string {
  const details = err?.response?.data?.error?.details;
  if (details && typeof details === "object") {
    const firstKey = Object.keys(details)[0];
    const firstErr = firstKey ? details[firstKey] : null;
    if (Array.isArray(firstErr) && firstErr[0]) {
      return String(firstErr[0]);
    }
  }
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^(https?:\/\/|blob:|data:)/i.test(path)) {
    return path;
  }
  const apiUrl = import.meta.env.VITE_API_URL || "/api/v1";
  if (/^https?:\/\//i.test(apiUrl)) {
    try {
      const origin = new URL(apiUrl).origin;
      return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
    } catch {
      return path;
    }
  }
  return path;
}
