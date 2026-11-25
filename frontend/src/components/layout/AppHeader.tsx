import React from "react";
import { Menu } from "lucide-react";
import { SearchInput } from "../shared/SearchInput";
import { ActiveMonthPicker } from "./ActiveMonthPicker";
import { NotificationsMenu } from "./NotificationsMenu";
import { UserProfileMenu } from "./UserProfileMenu";

interface AppHeaderProps {
  onOpenMobileMenu: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function AppHeader({
  onOpenMobileMenu,
  searchQuery,
  onSearchChange,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#E7E1D8] bg-white/95 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile hamburger & search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E7E1D8] text-[#817872] hover:bg-[#F7F4F0] md:hidden"
          title="Open Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden sm:block flex-1 max-w-md">
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search orders, leads, phone number..."
          />
        </div>
      </div>

      {/* Right: Global month scope, notifications, user profile */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        <ActiveMonthPicker />
        <NotificationsMenu />
        <div className="h-6 w-px bg-[#E7E1D8] hidden sm:block" />
        <UserProfileMenu />
      </div>
    </header>
  );
}
