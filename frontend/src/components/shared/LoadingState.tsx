import React from "react";

interface LoadingStateProps {
  message?: string;
  rows?: number;
  type?: "table" | "cards" | "spinner";
}

export function LoadingState({
  message = "Loading data...",
  rows = 4,
  type = "spinner",
}: LoadingStateProps) {
  if (type === "spinner") {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-rose-600" />
        <p className="mt-3 text-xs text-stone-500">{message}</p>
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className="w-full space-y-2 p-4 bg-white rounded-xl border border-stone-200/80 animate-pulse">
        <div className="h-8 bg-stone-100 rounded-md w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 bg-stone-50 rounded-md w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-xl bg-stone-100 border border-stone-200/60" />
      ))}
    </div>
  );
}
