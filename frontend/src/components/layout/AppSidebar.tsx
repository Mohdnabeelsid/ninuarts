import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  ShoppingBag,
  Truck,
  Users,
  Package,
  Receipt,
  BarChart3,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Lock,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
}

interface NavItem {
  title: string;
  path: string;
  icon: React.ElementType;
  badge?: string | number;
  ownerOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    ownerOnly: true,
  },
  {
    title: "Customers CRM",
    path: "/customers",
    icon: Users,
  },
  {
    title: "Leads & Enquiries",
    path: "/enquiries",
    icon: MessageSquare,
  },
  {
    title: "Products Catalog",
    path: "/products",
    icon: Package,
  },
  {
    title: "Orders",
    path: "/orders",
    icon: ShoppingBag,
  },
  {
    title: "Expense Ledger",
    path: "/expenses",
    icon: Receipt,
    ownerOnly: true,
  },
  {
    title: "Deliveries & Shipping",
    path: "/deliveries",
    icon: Truck,
  },
  {
    title: "Analytics & P&L",
    path: "/analytics",
    icon: BarChart3,
    ownerOnly: true,
  },
  {
    title: "Activity Audit Logs",
    path: "/activity-logs",
    icon: History,
    ownerOnly: true,
  },
  {
    title: "Settings",
    path: "/settings",
    icon: Settings,
    ownerOnly: true,
  },
];

export function AppSidebar({
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
}: AppSidebarProps) {
  const { user } = useAuth();
  const location = useLocation();

  const isOwner = user?.role === "OWNER";

  return (
    <aside
      className={`relative flex flex-col border-r border-[#E7E1D8] bg-white transition-all duration-300 ease-in-out h-full select-none ${
        isCollapsed ? "w-18" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div
        className={`relative flex h-16 items-center border-b border-[#F0ECE7] ${
          isCollapsed ? "justify-center px-2" : "justify-between px-4"
        }`}
      >
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#34312F] text-white shadow-soft">
                <span className="font-serif text-lg tracking-wider">N</span>
              </div>
              <div className="flex flex-col truncate">
                <span className="font-serif tracking-tight text-[#34312F] text-base leading-tight">
                  Ninu Arts
                </span>
                <span className="text-[10px] text-[#817872] tracking-wider uppercase font-medium">
                  Alappuzha, Kerala
                </span>
              </div>
            </div>

            {/* Collapse toggle (desktop only) */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg border border-[#E7E1D8] text-[#817872] hover:bg-[#F7F4F0] hover:text-[#34312F] transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        ) : (
          /* Collapsed State: Single centered interactive logo button */
          <button
            type="button"
            onClick={onToggleCollapse}
            className="group relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#34312F] text-white shadow-soft hover:bg-[#1F1D1C] transition-all cursor-pointer"
            title="Expand sidebar"
          >
            <span className="font-serif text-lg tracking-wider transition-opacity duration-150 group-hover:opacity-0">
              N
            </span>
            <ChevronRight className="h-5 w-5 absolute transition-opacity duration-150 opacity-0 group-hover:opacity-100 text-white" />
          </button>
        )}
      </div>

      {/* Floating edge toggle button for collapsed desktop mode */}
      {isCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -right-3 top-5 z-30 hidden md:flex h-6 w-6 items-center justify-center rounded-full border border-[#E7E1D8] bg-white text-[#817872] hover:text-[#34312F] hover:bg-[#F7F4F0] shadow-soft transition-all cursor-pointer"
          title="Expand sidebar"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className={`px-2.5 pb-1.5 ${isCollapsed ? "text-center" : ""}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#817872]">
            {isCollapsed ? "•" : "Studio Management"}
          </span>
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
          const isLocked = item.ownerOnly && !isOwner;

          return (
            <NavLink
              key={item.path}
              to={isLocked ? "#" : item.path}
              onClick={(e) => {
                if (isLocked) {
                  e.preventDefault();
                  return;
                }
                onCloseMobile?.();
              }}
              title={isCollapsed ? item.title : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                isLocked
                  ? "cursor-not-allowed opacity-40 text-[#817872]"
                  : isActive
                  ? "bg-[#34312F] text-white font-medium shadow-soft"
                  : "text-[#6B635B] hover:bg-[#F7F4F0] hover:text-[#34312F]"
              } ${isCollapsed ? "justify-center px-2" : ""}`}
            >
              <item.icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive ? "text-white" : "text-[#817872] group-hover:text-[#34312F]"
                }`}
              />

              {!isCollapsed && (
                <div className="flex flex-1 items-center justify-between overflow-hidden">
                  <span className="truncate">{item.title}</span>
                  <div className="flex items-center gap-1.5 ml-2">
                    {item.badge !== undefined && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-[#E8D8D4] text-[#7A4B43]"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {isLocked && <Lock className="h-3 w-3 text-[#817872]" />}
                  </div>
                </div>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Operator status card */}
      <div className="border-t border-[#F0ECE7] p-3">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 rounded-xl bg-[#F7F4F0] p-2.5 border border-[#E7E1D8]">
            <div className="relative">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8D8D4] text-[#34312F] font-serif text-sm">
                {user?.name?.charAt(0) || "N"}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#8B9B86] ring-2 ring-white" />
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-medium text-[#34312F] truncate">
                {user?.name || "Nidha"}
              </span>
              <span className="text-[10px] text-[#817872]">
                {isOwner ? "Proprietor (Owner)" : "Staff Member"}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="relative">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8D8D4] text-[#34312F] font-serif text-sm">
                {user?.name?.charAt(0) || "N"}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#8B9B86] ring-2 ring-white" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
