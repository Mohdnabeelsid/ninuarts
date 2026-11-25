import React, { useState } from "react";
import { Outlet, Navigate, useOutletContext } from "react-router-dom";
import { AppSidebar } from "../components/layout/AppSidebar";
import { AppHeader } from "../components/layout/AppHeader";
import { useAuth } from "../contexts/AuthContext";
import { X } from "lucide-react";
import { LoadingState } from "../components/shared/LoadingState";

export interface DashboardOutletContext {
  globalSearch: string;
  setGlobalSearch: React.Dispatch<React.SetStateAction<string>>;
}

export function useDashboardSearch(): string {
  const ctx = useOutletContext<DashboardOutletContext | undefined>();
  return ctx?.globalSearch ?? "";
}

export function DashboardLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F4F0]">
        <LoadingState message="Verifying operator credentials..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F7F4F0] text-[#34312F] font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        <AppSidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      {/* Mobile Sidebar Overlay Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-[#34312F]/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex w-72 flex-col bg-white shadow-drawer transition-all">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 rounded-xl p-1.5 text-[#817872] hover:bg-[#F7F4F0] hover:text-[#34312F]"
              title="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <AppSidebar
              isCollapsed={false}
              onToggleCollapse={() => {}}
              onCloseMobile={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet context={{ globalSearch: searchQuery, setGlobalSearch: setSearchQuery }} />
          </div>
        </main>
      </div>
    </div>
  );
}
