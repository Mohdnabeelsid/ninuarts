# Ninu Arts Business Manager — System Architecture

**Document Version:** 1.0.0  
**Status:** Approved Architecture Specification  
**Architect:** Senior Software Architect & Product Engineer  

---

## 1. Architectural Philosophy & Principles

The Ninu Arts Business Manager is designed as a **decoupled, modular Monolith-first REST architecture** serving a rich, reactive Single Page Application (SPA). This design optimizes for:
1. **Financial Integrity:** Every currency transaction, advance payment, order balance, and refund is strictly computed and stored with relational consistency and database-level constraints.
2. **Operational Simplicity for a Solopreneur:** Minimal cognitive load for Nidha; one-screen order intake, real-time balance calculations, and streamlined CRM interactions.
3. **Future Scalability & Multi-User Governance:** Role-Based Access Control (RBAC) and event-driven decoupled handlers for messaging automations baked in from Day 1.

---

## 2. High-Level System Architecture

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT TIER                                        |
|                                                                                       |
|   React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui                             |
|   +-------------------------------------------------------------------------------+   |
|   |  Presentation Layer (Atomic Components & Custom Views)                       |   |
|   |  - shadcn/ui primitives + Lucide Icons                                        |   |
|   |  - Responsive Dashboard Layout (Sidebar, Topbar, Global Search)               |   |
|   |  - Data Tables with sorting, filtering, and server-driven pagination           |   |
|   |  - Recharts for Real-Time Financial & Conversion Analytics                    |   |
|   +-------------------------------------------------------------------------------+   |
|   |  State Management & Network Layer                                             |   |
|   |  - TanStack Query (React Query v5): Server State, Caching, Optimistic UI      |   |
|   |  - React Hook Form + Zod: Form State, Typed Validation & Error Schemas        |   |
|   |  - Axios / Fetch Client with Auth Token Interceptors & Global Error Boundary  |   |
|   +-------------------------------------------------------------------------------+   |
+-------------------------------------------|-------------------------------------------+
                                            | HTTPS / JSON REST API
                                            v
+---------------------------------------------------------------------------------------+
|                                  APPLICATION TIER                                     |
|                                                                                       |
|   Laravel 11+ REST API (PHP 8.3+)                                                     |
|   +-------------------------------------------------------------------------------+   |
|   |  API Gateway & Security Layer                                                 |   |
|   |  - CORS & Rate Limiting (Throttle Middleware)                                 |   |
|   |  - Authentication: Laravel Sanctum (Stateful Tokens / Bearer Tokens)          |   |
|   |  - Authorization: RBAC Middleware & Laravel Policies (Owner vs. Staff)        |   |
|   +-------------------------------------------------------------------------------+   |
|   |  HTTP Controllers Layer (Thin Controllers)                                    |   |
|   |  - Form Requests (Zod-mirrored server validation)                             |   |
|   |  - JSON API Resources (Strict contract transformation)                       |   |
|   +-------------------------------------------------------------------------------+   |
|   |  Domain Service Layer (Fat Services / Use Cases)                              |   |
|   |  - OrderService: Item calc, advance validation, state transitions             |   |
|   |  - PaymentLedgerService: Payment ingestion, balance recalculation             |   |
|   |  - RefundService: Refund processing, ledger adjustment                        |   |
|   |  - ExpenseService: Categorization and expense ledger recording               |   |
|   |  - AnalyticsEngineService: Aggregation of cash flow & conversions             |   |
|   +-------------------------------------------------------------------------------+   |
|   |  Event Bus & Messaging Hook Layer (Future Automation)                         |   |
|   |  - Laravel Events & Listeners                                                 |   |
|   |  - Webhook Dispatcher (WhatsApp Cloud API / Instagram Graph API ready)        |   |
|   +-------------------------------------------------------------------------------+   |
+-------------------------------------------|-------------------------------------------+
                                            | PDO / Eloquent ORM
                                            v
+---------------------------------------------------------------------------------------+
|                                     DATA TIER                                         |
|                                                                                       |
|   MySQL 8.0+ Database                                                                 |
|   - InnoDB Storage Engine (ACID compliance & Foreign Key constraints)                 |
|   - Strict Decimal Types (`DECIMAL(10,2)`) for zero-rounding currency errors          |
|   - Database-level transactions (`DB::transaction`) for multi-table financial writes  |
|   - Indexed queries for customer lookup, order statuses, and date-range metrics       |
+---------------------------------------------------------------------------------------+
```

---

## 3. Technology Stack & Component Justifications

### 3.1 Frontend Stack
| Layer / Library | Technology | Architectural Justification |
| :--- | :--- | :--- |
| **Framework** | **React 18/19 (TypeScript)** | Industry standard component-driven UI with compile-time safety across order items, payments, and customer schemas. |
| **Build Tool** | **Vite** | Ultra-fast Hot Module Replacement (HMR) and optimized Rollup-based tree-shaking production builds. |
| **Styling** | **Tailwind CSS** | Utility-first styling enabling rapid UI iteration and consistent design tokens (colors, spacing, typography). |
| **UI Primitives** | **shadcn/ui (Radix UI)** | Accessible, headless, composable primitives that live in the codebase rather than being locked behind an inflexible npm dependency. |
| **Server State** | **TanStack Query (v5)** | Manages API data fetching, declarative caching, automatic background revalidation, query invalidation on mutations, and optimistic updates. |
| **Form Handling** | **React Hook Form** | High-performance, un-opinionated uncontrolled form inputs with minimal re-renders for complex multi-item order forms. |
| **Validation** | **Zod** | TypeScript-first schema declaration and validation library ensuring strict schema matching between frontend input and backend API contracts. |
| **Data Viz** | **Recharts** | Declarative React charting library for financial trend charts, category distributions, and conversion funnel analytics. |

### 3.2 Backend Stack
| Layer / Library | Technology | Architectural Justification |
| :--- | :--- | :--- |
| **API Runtime** | **Laravel 11+ (PHP 8.3+)** | Robust MVC framework with enterprise-grade ORM (Eloquent), built-in security, migration engine, queue system, and event handling. |
| **Auth** | **Laravel Sanctum** | Lightweight, token-based authentication engine supporting both SPA cookie-based auth and mobile/external API bearer tokens. |
| **Authorization** | **Laravel Policies & Gates** | Fine-grained RBAC separating Owner actions (expenses, financials, staff setup) from Staff actions (enquiries, order updates). |
| **Database** | **MySQL 8.0+** | ACID-compliant relational storage with JSON support, strict constraint enforcement, and high performance for relational queries. |

---

## 4. Subsystem Decompositions & Domain Boundaries

### 4.1 Customer & Enquiry CRM Subsystem
- **Scope:** Lead capture, prospective customer records, channel source tracking, conversion to orders.
- **Key Entities:** `customers`, `enquiries`, `customer_notes`.
- **Invariants:** 
  - A customer can have multiple enquiries and multiple orders.
  - Converting an enquiry creates a linked order and automatically sets enquiry status to `CONVERTED`.

### 4.2 Product & Catalog Subsystem
- **Scope:** Managing standard offerings and supporting dynamic, ad-hoc customizations.
- **Key Entities:** `products`, `product_categories`.
- **Invariants:**
  - Base catalog holds standard items (e.g., standard frame sizes, album types).
  - Orders do **not** strictly require an existing product foreign key. Orders can have standard items (`product_id` set) or fully bespoke items (`product_id` null with custom title).
  - Snapshot pricing: The price of an item on an order is stored on `order_items.unit_price` at the time of order creation/edit. Catalog price changes never mutate historical order financials.

### 4.3 Order & Fulfillment Subsystem
- **Scope:** Order lifecycle, line-item configurations, custom notes, delivery scheduling.
- **Key Entities:** `orders`, `order_items`, `fulfillments`.
- **Invariants:**
  - An order cannot transition to `CONFIRMED` without an advance payment recorded.
  - Modifying an order executes within a database transaction, recalculating `subtotal`, `total_amount`, and `balance_amount`.

### 4.4 Financial Ledger Subsystem (Payments, Refunds, Expenses)
- **Scope:** Multi-transaction recording, payment mode tracking, transaction audit trail, refund processing, operating expense ledger.
- **Key Entities:** `payments`, `refunds`, `expenses`, `expense_categories`.
- **Invariants:**
  - Strict immutability: Payments and refunds are ledger records. They are never deleted; if an error occurs, an offsetting or void entry is logged.
  - Currency precision: Handled as `DECIMAL(10,2)` in INR (₹).
  - Balance equation invariant:
    $$\text{balance\_amount} = \text{total\_amount} - \sum(\text{payments.amount where status='SUCCESS'}) + \sum(\text{refunds.amount where status='COMPLETED'})$$

### 4.5 Analytics & Intelligence Subsystem
- **Scope:** Aggregating business performance without mock numbers.
- **Key Metrics:**
  - Net Realized Cash Flow = Total Inflows (Payments) - Total Outflows (Refunds + Expenses).
  - Outstanding Receivables = Sum of `balance_amount` for active confirmed orders.
  - Lead Conversion Ratio = $\frac{\text{Converted Enquiries}}{\text{Total Enquiries}} \times 100$.

### 4.6 Global Active Working Month Context Engine
- **Scope:** Uniform time scoping across the entire application.
- **Architecture:**
  - **Client State:** A persistent `ActivePeriodContext` stores the selected working year and month (`YYYY-MM`). By default, it auto-initializes to the current system date.
  - **Context Propagation:** The frontend transmits the active period in every API request via the `X-Active-Period` HTTP header (e.g., `X-Active-Period: 2027-08`).
  - **Backend Scoping:** A global Laravel middleware (`ApplyActivePeriodScope`) parses `X-Active-Period` and applies date range bounds (`startOfMonth` to `endOfMonth`) across Eloquent queries unless explicitly bypassed (`all_time=true`).
  - **Visual Indicator:** The top navigation bar displays a persistent status pill indicating the current month in view (e.g., 📅 "Working Month: August 2027").

### 4.7 Comprehensive Activity Logging Subsystem
- **Scope:** Immutable, system-wide operational and financial audit logging.
- **Architecture:**
  - **Model Observers & Event Listeners:** Model observers automatically listen to `created`, `updated`, and `deleted` lifecycle hooks.
  - **Delta Diffing:** When an update occurs, the listener compares `$model->getOriginal()` against `$model->getChanges()`, serializing the JSON difference into `old_values` and `new_values`.
  - **Audit Metadata:** Captures the authenticated operator (`user_id`), request IP address, user-agent, and a human-readable summary.
  - **Immutability:** The `activity_logs` table has no edit or delete APIs; it is append-only.

---

## 5. Security & Authentication Architecture

### 5.1 Identity & Access Management (IAM)
- **Authentication:** Token-based authentication using **Laravel Sanctum**. Tokens are hashed with SHA-256 in the database.
- **Token Expiry & Rotation:** Tokens have a 7-day idle lifetime with renewal upon activity.
- **Password Security:** Passwords hashed with `bcrypt` (work factor 12) or Argon2id.

### 5.2 Role-Based Access Control (RBAC) Matrix

| Module / Action | Owner (Nidha) | Future Staff / Assistant |
| :--- | :---: | :---: |
| **View Dashboard Financials & Net Profit** | Full Access | No Access |
| **View Lead & Enquiry Pipeline** | Full Access | Full Access |
| **Create / Update Enquiries** | Full Access | Full Access |
| **Create / Modify Orders** | Full Access | Full Access |
| **Record Advance / Balance Payments** | Full Access | Full Access |
| **Process Refunds** | Full Access | No Access |
| **View & Add Business Expenses** | Full Access | No Access |
| **Manage Product Catalog** | Full Access | View Only |
| **Update Delivery / Courier Tracking** | Full Access | Full Access |
| **Manage Users & Permissions** | Full Access | No Access |

### 5.3 Data Protection & Integrity Controls
- **SQL Injection Prevention:** 100% parameterized queries via Eloquent ORM and PDO.
- **XSS Sanitization:** React escapes values by default; strict CSP headers configured.
- **Financial Concurrency Control:** Optimistic locking via `version` column or `DB::transaction` with row-level locks (`lockForUpdate`) during order modification and payment recording.

---

## 6. Messaging & Automation Readiness Architecture

To satisfy the future requirement for messaging automation (WhatsApp / Instagram notifications):
1. **Event Sourced Domain Triggers:** The application triggers Laravel Events on every state change:
   - `OrderConfirmed`
   - `PaymentReceived`
   - `OrderDispatched`
   - `EnquiryFollowUpDue`
2. **Notification Channel Interface:**
   ```php
   interface NotificationChannelInterface {
       public function send(string $recipient, string $templateName, array $payload): bool;
   }
   ```
3. **Queue Architecture:** Laravel Queue workers (database driver or Redis) will handle outbound HTTP dispatches asynchronously, ensuring zero impact on user interaction latency.
