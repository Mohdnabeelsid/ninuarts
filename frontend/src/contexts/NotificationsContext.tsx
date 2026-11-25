import React, { createContext, useContext, useState, useEffect } from "react";
import { AppNotification } from "../types";
import { apiClient } from "../lib/api";
import { useAuth } from "./AuthContext";

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  addNotification: (notification: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Fetch real overdue delivery alerts from the database when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    let cancelled = false;
    apiClient
      .get("/deliveries/overdue")
      .then((res) => {
        if (cancelled) return;
        const overdueList: any[] = res.data?.data || [];
        const liveAlerts: AppNotification[] = overdueList.slice(0, 5).map((d) => ({
          id: `overdue-del-${d.id}`,
          title: `Overdue Delivery (${d.days_overdue}d)`,
          message: `Order ${d.order?.order_number || "#" + d.order_id} for ${
            d.recipient_name || d.order?.customer?.name || "Customer"
          } passed expected delivery date.`,
          type: "ALERT",
          timestamp: d.estimated_delivery_date || new Date().toISOString(),
          read: false,
          link: "/deliveries",
        }));
        setNotifications(liveAlerts);
      })
      .catch(() => {
        // Keep empty safely if endpoint unreachable
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const addNotification = (
    item: Omit<AppNotification, "id" | "timestamp" | "read">
  ) => {
    const newNotif: AppNotification = {
      ...item,
      id: `notif-${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAll,
        addNotification,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
}
