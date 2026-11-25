import React, { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  emptyTitle?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T extends { id?: string | number }>({
  data,
  columns,
  pageSize = 8,
  emptyTitle = "No records found",
  emptyMessage = "There are no entries to display for the current filter.",
  onRowClick,
  className = "",
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = data.slice(startIndex, startIndex + pageSize);

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E7E1D8] bg-white p-8 shadow-card">
        <EmptyState title={emptyTitle} message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-[#E7E1D8] bg-white shadow-card ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#F0ECE7] bg-[#FDFBF7]/80 text-[10px] uppercase tracking-wider text-[#817872] font-semibold">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`px-4.5 py-3.5 ${col.className || ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0ECE7] text-[#34312F]">
            {paginatedData.map((row, rowIdx) => (
              <tr
                key={row.id ?? rowIdx}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${
                  onRowClick
                    ? "cursor-pointer hover:bg-[#FDFBF7] active:bg-[#F7F4F0]"
                    : "hover:bg-[#FDFBF7]/60"
                }`}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={`px-4.5 py-3.5 ${col.className || ""}`}>
                    {col.cell
                      ? col.cell(row)
                      : col.accessorKey
                      ? (row[col.accessorKey] as React.ReactNode)
                      : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#F0ECE7] px-4.5 py-3 text-xs text-[#817872] bg-[#FDFBF7]/40">
          <div>
            Showing <strong className="text-[#34312F] font-medium">{startIndex + 1}</strong> to{" "}
            <strong className="text-[#34312F] font-medium">
              {Math.min(startIndex + pageSize, data.length)}
            </strong>{" "}
            of <strong className="text-[#34312F] font-medium">{data.length}</strong> items
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="rounded-lg p-1.5 hover:bg-[#F7F4F0] disabled:opacity-40 disabled:cursor-not-allowed text-[#6B635B] transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-lg p-1.5 hover:bg-[#F7F4F0] disabled:opacity-40 disabled:cursor-not-allowed text-[#6B635B] transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-medium text-[#34312F]">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="rounded-lg p-1.5 hover:bg-[#F7F4F0] disabled:opacity-40 disabled:cursor-not-allowed text-[#6B635B] transition-colors"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="rounded-lg p-1.5 hover:bg-[#F7F4F0] disabled:opacity-40 disabled:cursor-not-allowed text-[#6B635B] transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
