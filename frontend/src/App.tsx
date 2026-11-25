import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ActivePeriodProvider } from "./contexts/ActivePeriodContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { LoadingState } from "./components/shared/LoadingState";

function OwnerRoute({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  if (user && user.role !== "OWNER") {
    return <Navigate to="/orders" replace />;
  }
  return children;
}

function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === "OWNER" ? "/dashboard" : "/orders"} replace />;
}

// Route-level code splitting for faster initial bundle load
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const DashboardOverviewPage = lazy(() =>
  import("./pages/DashboardOverviewPage").then((m) => ({ default: m.DashboardOverviewPage }))
);
const OrdersPage = lazy(() => import("./pages/OrdersPage").then((m) => ({ default: m.OrdersPage })));
const DeliveriesPage = lazy(() =>
  import("./pages/DeliveriesPage").then((m) => ({ default: m.DeliveriesPage }))
);
const EnquiriesPage = lazy(() =>
  import("./pages/EnquiriesPage").then((m) => ({ default: m.EnquiriesPage }))
);
const CustomersPage = lazy(() =>
  import("./pages/CustomersPage").then((m) => ({ default: m.CustomersPage }))
);
const ProductsPage = lazy(() =>
  import("./pages/ProductsPage").then((m) => ({ default: m.ProductsPage }))
);
const ExpensesPage = lazy(() =>
  import("./pages/ExpensesPage").then((m) => ({ default: m.ExpensesPage }))
);
const AnalyticsPage = lazy(() =>
  import("./pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage }))
);
const ActivityLogsPage = lazy(() =>
  import("./pages/ActivityLogsPage").then((m) => ({ default: m.ActivityLogsPage }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2, // 2 minutes cache
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ActivePeriodProvider>
          <NotificationsProvider>
            <BrowserRouter>
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center bg-[#F7F4F0]">
                    <LoadingState message="Loading Ninu Arts workspace..." />
                  </div>
                }
              >
                <Routes>
                  {/* Public Auth Route */}
                  <Route path="/login" element={<LoginPage />} />

                  {/* Protected Dashboard Shell Routes */}
                  <Route element={<DashboardLayout />}>
                    <Route path="/" element={<RoleHomeRedirect />} />
                    <Route
                      path="/dashboard"
                      element={
                        <OwnerRoute>
                          <DashboardOverviewPage />
                        </OwnerRoute>
                      }
                    />
                    <Route path="/enquiries" element={<EnquiriesPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/deliveries" element={<DeliveriesPage />} />
                    <Route path="/customers" element={<CustomersPage />} />
                    <Route path="/products" element={<ProductsPage />} />
                    <Route
                      path="/expenses"
                      element={
                        <OwnerRoute>
                          <ExpensesPage />
                        </OwnerRoute>
                      }
                    />
                    <Route
                      path="/analytics"
                      element={
                        <OwnerRoute>
                          <AnalyticsPage />
                        </OwnerRoute>
                      }
                    />
                    <Route
                      path="/activity-logs"
                      element={
                        <OwnerRoute>
                          <ActivityLogsPage />
                        </OwnerRoute>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <OwnerRoute>
                          <SettingsPage />
                        </OwnerRoute>
                      }
                    />
                  </Route>

                  {/* Catch-all fallback */}
                  <Route path="*" element={<RoleHomeRedirect />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </NotificationsProvider>
        </ActivePeriodProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
