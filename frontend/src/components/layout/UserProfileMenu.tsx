import React, { useState, useRef, useEffect } from "react";
import { Shield, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export function UserProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-[#F7F4F0] transition-colors"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E8D8D4] text-[#34312F] font-serif text-sm border border-[#D6C4B5]/60 shadow-soft">
          {user.name.charAt(0)}
        </div>
        <div className="hidden text-left md:block">
          <p className="text-xs font-medium text-[#34312F] leading-none">{user.name}</p>
          <p className="text-[10px] text-[#817872] capitalize mt-0.5">{user.role.toLowerCase()}</p>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-[#817872] hidden md:block" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-[#E7E1D8] bg-white p-2 shadow-soft animate-in fade-in-50 zoom-in-95">
          <div className="border-b border-[#F0ECE7] px-3 py-2.5">
            <p className="text-xs font-medium text-[#34312F]">{user.name}</p>
            <p className="text-[11px] text-[#817872] truncate">{user.email}</p>
            <div className="mt-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F5ECE9] px-2 py-0.5 text-[10px] font-medium text-[#7A4B43] border border-[#E8D8D4]">
                <Shield className="h-3 w-3" />
                <span>{user.role === "OWNER" ? "Proprietor (Owner)" : "Staff Account"}</span>
              </span>
            </div>
          </div>

          <div className="py-1.5 px-3 text-[11px] text-[#817872]">
            Account status: <strong className="text-[#475E42] font-medium">Active</strong>
          </div>

          <div className="border-t border-[#F0ECE7] pt-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                logout();
                navigate("/login");
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-[#8F352A] hover:bg-[#FAECEB] transition-colors font-medium"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
