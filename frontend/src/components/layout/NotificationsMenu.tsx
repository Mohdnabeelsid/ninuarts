import React, { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications } from "../../contexts/NotificationsContext";

export function NotificationsMenu() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();
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

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#E7E1D8] bg-white text-[#817872] hover:bg-[#F7F4F0] hover:text-[#34312F] transition-colors shadow-card"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#8F352A] text-[10px] font-medium text-white shadow-soft">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-[#E7E1D8] bg-white p-3.5 shadow-soft animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between border-b border-[#F0ECE7] pb-2.5 px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#34312F] uppercase tracking-wider">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#FAECEB] px-2 py-0.5 text-[10px] font-medium text-[#8F352A]">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 text-[11px] text-[#817872] hover:text-[#34312F] font-medium transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-[#F0ECE7] py-1">
            {notifications.length === 0 ? (
              <p className="text-center py-6 text-xs text-[#817872]">No notifications right now.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`p-2.5 rounded-xl cursor-pointer transition-colors ${
                    !n.read ? "bg-[#FDFBF7]" : "hover:bg-[#F7F4F0]"
                  }`}
                >
                  <p className="text-xs font-medium text-[#34312F]">{n.title}</p>
                  <p className="text-[11px] text-[#6B635B] mt-0.5 leading-relaxed">{n.message}</p>
                  <span className="text-[10px] text-[#817872] mt-1 block">
                    {new Date(n.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
