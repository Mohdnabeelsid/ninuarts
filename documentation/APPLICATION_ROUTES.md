# Ninu Arts Business Manager — Application Routes & Component Architecture

**Document Version:** 1.0.0  
**Framework:** React 19 + TypeScript + Vite  
**Router:** React Router v6/v7  

---

## 1. Application Route Hierarchy

```
/
├── /login                            [Public] Operator Authentication
│
├── (DashboardLayout)                 [Protected - Requires Authenticated User]
│   │
│   ├── /dashboard                    [Protected - Owner Only] Executive KPIs, Cash Flow & Charts
│   │
│   ├── /enquiries                    [Protected - All Staff] Leads & Enquiries Pipeline
│   │   ├── /enquiries/new            Modal / Sheet: Capture new lead
│   │   └── /enquiries/:id            Drawer: View notes, log follow-up, convert to order
│   │
│   ├── /orders                       [Protected - All Staff] Master Order List
│   │   ├── /orders/new               Full Page: Dynamic Multi-Item Order Creation
│   │   ├── /orders/:id               Full Page: Order Command Center (Items, Payments, Logistics)
│   │   └── /orders/:id/edit          Full Page / Modal: Order Amendment & Pricing Adjustments
│   │
│   ├── /customers                    [Protected - All Staff] Customer CRM Directory
│   │   ├── /customers/new            Modal / Sheet: Add Customer
│   │   └── /customers/:id            Full Page: Customer Profile, Address & Lifetime History
│   │
│   ├── /products                     [Protected - All Staff] Product Catalog Master
│   │   ├── /products/new             Modal: Add Base Offering
│   │   └── /products/:id/edit        Modal: Edit Offering & Base Price
│   │
│   ├── /expenses                     [Protected - Owner Only] Operating Expense Ledger
│   │   └── /expenses/new             Modal / Sheet: Record Outflow with Receipt
│   │
│   ├── /analytics                    [Protected - Owner Only] Financial, Channel & Product Reports
│   │
│   ├── /activity-logs                [Protected - Owner Only] System-Wide Comprehensive Audit Trail
│   │
│   └── /settings                     [Protected - Owner Only] System Config, Working Month Setting, Staff Accounts
│
└── /404                              [Public] Not Found Catch-All
```

---

## 2. Route Specifications Table

| Route Path | View / Page Component | Layout | Access Guard | Primary Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| `/login` | `LoginPage` | `AuthLayout` | Public (Redirect if authenticated) | Operator sign-in with email & password. |
| `/dashboard` | `DashboardOverviewPage` | `DashboardLayout` | `RequireRole(['OWNER'])` | Real-time financial summary, active order counters, recent transactions, receivable alerts. |
| `/enquiries` | `EnquiriesListPage` | `DashboardLayout` | Authenticated | Pipeline board / table view of incoming leads, channel tags, follow-up dates. |
| `/orders` | `OrdersListPage` | `DashboardLayout` | Authenticated | Paginated order table, filter by status (`CONFIRMED`, `PENDING_ADVANCE`, etc.), payment status, search. |
| `/orders/new` | `CreateOrderPage` | `DashboardLayout` | Authenticated | Multi-item dynamic order form, advance amount requirement, custom line items, discount & shipping. |
| `/orders/:id` | `OrderDetailPage` | `DashboardLayout` | Authenticated | Comprehensive command center: line items, payments ledger, balance badge, courier tracking, modification history. |
| `/orders/:id/edit`| `EditOrderPage` | `DashboardLayout` | Authenticated | Amend confirmed orders, add/remove items, adjust delivery fee, recalculate balance with audit note. |
| `/customers` | `CustomersListPage` | `DashboardLayout` | Authenticated | Customer directory, Instagram handle search, phone search, order frequency metrics. |
| `/customers/:id` | `CustomerDetailPage` | `DashboardLayout` | Authenticated | Customer profile, past enquiries, full order history, lifetime revenue. |
| `/products` | `ProductsCatalogPage`| `DashboardLayout` | Authenticated (Edit: Owner) | Master catalog items, base pricing, category filtering. |
| `/expenses` | `ExpensesListPage` | `DashboardLayout` | `RequireRole(['OWNER'])` | Operational expense ledger, category grouping. |
| `/analytics` | `AnalyticsReportsPage`| `DashboardLayout` | `RequireRole(['OWNER'])` | Sales trends over time, channel conversion charts, category revenue breakdown. |
| `/activity-logs` | `ActivityLogsPage` | `DashboardLayout` | `RequireRole(['OWNER'])` | Universal audit trail: filter by action, entity, user, date; view JSON before/after snapshots. |
| `/settings` | `SettingsPage` | `DashboardLayout` | `RequireRole(['OWNER'])` | Operator profile, global active month context switcher, staff accounts. |

---

## 3. Reusable Component Architecture

The frontend component tree is organized into atomic, reusable units following the **shadcn/ui + Radix UI** standard:

```
frontend/src/
├── components/
│   ├── ui/                          # Headless shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── sheet.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   └── toast.tsx
│   │
│   ├── layout/                      # Application structural layouts
│   │   ├── AppSidebar.tsx           # Left navigation bar with active route highlight
│   │   ├── AppTopbar.tsx            # Header with search, quick actions & user profile
│   │   ├── ActiveMonthPicker.tsx    # Global Working Month selector dropdown & indicator badge
│   │   ├── PageHeader.tsx           # Title, breadcrumbs, action buttons header
│   │   └── RoleGuard.tsx            # RBAC client-side route & component wrapper
│   │
│   ├── shared/                      # Domain-agnostic utility components
│   │   ├── DataTable.tsx            # Generic data table with sorting, pagination & search
│   │   ├── CurrencyInput.tsx        # Form input enforcing INR (₹) formatting and decimal control
│   │   ├── ConfirmDialog.tsx        # Reusable modal for destructive confirmations
│   │   ├── StatusBadge.tsx          # Dynamic colored badges for order & payment states
│   │   └── EmptyState.tsx           # Clean illustrations when lists/records are empty
│   │
│   ├── orders/                      # Order-specific feature components
│   │   ├── OrderItemRow.tsx         # Individual line item editor with custom pricing
│   │   ├── OrderSummaryCard.tsx     # Subtotal, delivery, discount, and balance breakdown
│   │   ├── PaymentLedgerCard.tsx    # List of payments, recorded advance, and receipt references
│   │   ├── RecordPaymentModal.tsx   # Modal to record advance or balance installment
│   │   ├── ProcessRefundModal.tsx   # Modal for issuing refunds with reason and UTR
│   │   ├── FulfillmentCard.tsx      # Courier tracking, partner selection, status stepper
│   │   └── ModificationHistory.tsx  # Change audit log display for amended orders
│   │
│   ├── crm/                         # Customer & Lead components
│   │   ├── EnquiryCard.tsx          # Card view for lead pipelines
│   │   ├── CustomerSelect.tsx       # Async searchable customer combobox
│   │   └── QuickCustomerModal.tsx   # In-line customer creation drawer
│   │
│   └── analytics/                   # Data visualization components
│       ├── KPISummaryCard.tsx       # Revenue, receivables, orders metric cards
│       ├── SalesTrendChart.tsx      # Recharts line/bar chart for monthly volume
│       ├── ChannelFunnelChart.tsx   # Lead-to-order conversion rate chart
│       └── ExpenseBreakdownPie.tsx  # Category distribution pie chart
```

---

## 4. State Management & Data Flow Architecture

```
                                    +-----------------------------------+
                                    |        React UI Components        |
                                    +-----------------+-----------------+
                                                      |
                    +---------------------------------+---------------------------------+
                    |                                                                   |
                    v                                                                   v
     +------------------------------+                                    +------------------------------+
     |   Forms & Local State        |                                    |   Server State Management    |
     |   - React Hook Form          |                                    |   - TanStack Query (v5)      |
     |   - Zod Validation Schemas   |                                    |   - Query Keys Cache         |
     |   - useFieldArray (Items)    |                                    |   - Optimistic Updates       |
     +--------------+---------------+                                    +--------------+---------------+
                    |                                                                   |
                    +---------------------------------+---------------------------------+
                                                      |
                                                      v
                                    +-----------------------------------+
                                    |    API Client (Axios Interceptors)|
                                    |    - Auth Token Attachment        |
                                    |    - Global 401 & Error Handler   |
                                    +-----------------+-----------------+
                                                      |
                                                      v
                                           Laravel REST API v1
```

### 4.1 Form Handling Strategy
- Order creation and amendment forms utilize `useFieldArray` from React Hook Form, enabling seamless addition, deletion, and pricing customization of line items without triggering full-page re-renders.
- Schemas are validated client-side with **Zod** prior to network dispatch, catching negative values, zero amounts, or missing advance requirements instantly.

### 4.2 Server State & Invalidation Strategy
- Query keys are strictly organized:
  - `['orders', { status, page }]`
  - `['orders', orderId]`
  - `['customers', customerId]`
  - `['analytics', 'dashboard']`
- Performing mutations (such as `recordPayment` or `modifyOrder`) automatically invalidates the affected order query and the global `dashboard` analytics query, ensuring immediate financial synchronization across views.
