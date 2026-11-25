# Ninu Arts Business Manager — Business Requirements Document (BRD)

**Document Version:** 1.0.0  
**Status:** Approved Architecture Draft  
**Author:** Senior Software Architect & Product Engineer  
**Entity:** Ninu Arts (Alappuzha, Kerala)  
**Operator:** Nidha (Proprietor / Solopreneur)  

---

## 1. Executive Summary & Business Background

Ninu Arts is a personalized gifting business founded and operated by Nidha in Alappuzha, Kerala. The brand specializes in high-sentiment, bespoke gifting items tailored to individual customer occasions (birthdays, weddings, anniversaries, corporate milestones, and festivals).

### 1.1 Core Product Offerings
- **Customized Photo Frames:** Bespoke printed and framed photographs, collage frames, acrylic mounts, and personalized quotes/names.
- **Magazine-Style Albums:** Story-driven, stylized photobooks replicating luxury editorial magazines with custom client layouts.
- **Gift Hampers:** Curated assortments of personalized keepsakes, chocolates, custom mugs, notes, and ambient accessories.
- **Customized Gifting Products:** Ancillary custom gifting artifacts made to order based on customer inspiration or unique briefs.

---

## 2. Current State vs. Target State Analysis

| Operational Area | Current Operational State | Target System Capabilities (Ninu Arts Business Manager) |
| :--- | :--- | :--- |
| **Enquiry Ingestion** | Scattered across Instagram DMs & WhatsApp chats; managed solely by Nidha in ad-hoc threads. | Centralized Lead & Customer CRM recording source channel (Instagram, WhatsApp), contact details, requirements, budget, and follow-up status. |
| **Product & Pricing** | No standard catalogue. Pricing quoted dynamically per request without reference points. | Standardized Base Product Catalog with customizable options, plus support for ad-hoc custom products and line-item custom pricing. |
| **Lead Tracking** | Unconverted leads and interested prospects are lost in messaging chat histories. | Structured Enquiry Pipeline (`New`, `Quoted`, `Follow-up`, `Confirmed`, `Dropped`) with customer interaction histories. |
| **Order Confirmation** | Orders confirmed informally upon receipt of arbitrary advance payment amounts. | Formal Order Lifecycle: Order creation, line item breakdown, advance payment recording with transaction reference, status transition to `Confirmed`. |
| **Order Modifications** | Customers frequently request modifications (add items, change size, modify notes) post-advance. | Supported Order Amendment workflow: Recalculates total amount, balance payable, and logs adjustment history without breaking audit trail. |
| **Payment Handling** | Payments collected via UPI, direct Bank Transfer, and Cash without centralized reconciliation. | Multi-transaction payment ledger per order supporting multiple partial payments, mode tracking, UTR/reference capture, and balance calculations. |
| **Refunds** | Handled manually on a case-by-case basis with manual calculations. | Dedicated Refund Management module linking refunds to original order and transaction, tracking refund mode, reason, and net balance impacts. |
| **Order Fulfillment** | Ad-hoc dispatch via local couriers and in-person delivery without central dispatch log. | Fulfillment tracking: Courier partner recording, tracking ID generation/entry, dispatch date, delivery status, and local delivery drop-off tracking. |
| **Inventory** | No raw material or stock inventory tracked (purchased or created on demand per order). | **Explicitly Out of Scope:** No inventory or stock management module required. |
| **Production/Design** | Design iterations handled directly in chat; no formal gatekeepers. | **Explicitly Out of Scope:** No design approval or production staging engine required. |
| **Expense Recording** | Expenses (raw materials, courier fees, tools, packaging) mixed with personal/chat notes. | Dedicated Expense Ledger categorized by operational type (Packaging, Materials, Courier, Marketing, Utilities) for exact P&L visibility. |
| **Business Analytics** | No revenue, cash flow, customer retention, or profit visibility. | Comprehensive Analytics Dashboard: Net Revenue, Advance Collected vs. Receivables, Expense Breakdown, Net Profit, Top Channels, Top Products. |
| **Multi-User / Scaling** | Sole-operator (Nidha). | Single-tenant database with Role-Based Access Control (RBAC) architecture ready for future staff/assistants. |
| **Audit Logging** | Zero logs; all actions untracked. | **100% Comprehensive Audit Trail:** Every single user action, state update, order change, payment entry, and deletion logged with before/after diffs, timestamp, and IP. |
| **Data Scope & Filtering** | Ad-hoc timeline inspection. | **Global Active Working Month Context:** By default, system displays current calendar month. Topbar/Settings selector allows switching global scope to any past/future month (e.g. August 2027), scoping all orders, payments, expenses, and KPIs. |
| **Deployment Schedule** | N/A | **Phased Rollout:** Pilot operations in December 2026; full daily operational cutover from January 2027. |
| **Messaging** | Manual typing of confirmations and dispatch notes. | System ready with webhook/event architecture for future WhatsApp/Instagram API automated notifications. |

---

## 3. Detailed Functional Requirements

### 3.1 Customer & Enquiry CRM
- **FR-CRM-01 (Lead Capture):** System must capture leads originating from Instagram, WhatsApp, Referral, or Direct Walk-in/Call.
- **FR-CRM-02 (Customer Profile):** System must store customer full name, primary phone number (WhatsApp-enabled), Instagram handle, email (optional), primary delivery address, and notes.
- **FR-CRM-03 (Interaction History):** System must maintain a chronology of all enquiries, quoted orders, confirmed orders, and total lifetime spend per customer.
- **FR-CRM-04 (Enquiry Status Tracking):** Enquiries must have statuses: `NEW`, `CONTACTED`, `ESTIMATE_SENT`, `CONVERTED`, `LOST`.
- **FR-CRM-05 (Quick Conversion):** An enquiry must be convertible directly into a formal draft order with one click, preserving all customer requirements and notes.

### 3.2 Product Catalogue & Custom Pricing
- **FR-PRD-01 (Base Catalogue):** System must maintain a product master table with base name, category (Photo Frames, Magazine Albums, Hampers, Custom), default base price, description, and active status.
- **FR-PRD-02 (Ad-Hoc / Custom Products):** In addition to catalog items, order creation must allow typing arbitrary custom product names (e.g., "12x18 Acrylic Spotify Frame with Wooden Easel") not present in the master catalogue.
- **FR-PRD-03 (Dynamic Line-Item Pricing):** Nidha must have the ability to override any base price or set custom unit prices on a per-order, per-item basis.
- **FR-PRD-04 (Customization Specifications):** Each order line item must accept rich customization text/notes (e.g., "Names: Rahul & Anjali, Anniversary Date: 24-Oct-2024, Font: Script, Black Frame").

### 3.3 Order Management & Modification
- **FR-ORD-01 (Multi-Item Orders):** An order can contain one or multiple line items, mixing standard catalogue items and fully custom items.
- **FR-ORD-02 (Order Pricing Integrity):**
  $$\text{Subtotal} = \sum (\text{Unit Price} \times \text{Quantity})$$
  $$\text{Total Amount} = \text{Subtotal} + \text{Delivery Charge} - \text{Discount}$$
- **FR-ORD-03 (Order Lifecycle States):**
  - `DRAFT`: Order details being formulated or quoted.
  - `PENDING_ADVANCE`: Order agreed with customer; waiting for advance payment.
  - `CONFIRMED`: Advance payment recorded; order is officially booked.
  - `IN_PROGRESS`: Order is being created/prepared by Nidha.
  - `READY_FOR_DELIVERY`: Crafting complete; packaged and ready for dispatch.
  - `DISPATCHED`: Shipped via courier or handed out for local delivery.
  - `DELIVERED`: Confirmed received by customer.
  - `CANCELLED`: Order cancelled before or during fulfillment.
- **FR-ORD-04 (Post-Confirmation Order Modification):**
  - Confirmed orders can have items added, removed, or modified (quantity, custom notes, pricing).
  - Delivery charge or discounts can be updated.
  - Total amount and remaining balance must instantly recalculate.
  - Any previously recorded advance payment remains locked in the payment ledger; remaining balance adjusts dynamically.
- **FR-ORD-05 (Order Cancellation):** If an order is cancelled, any refund must be processed through the formal refund module.

### 3.4 Financial Ledger, Payments & Refunds
- **FR-FIN-00 (Currency Standard):** All monetary figures across the entire platform (prices, subtotals, delivery fees, discounts, payments, refunds, balances, and expenses) are denominated in **Indian Rupee (INR / ₹)** using `DECIMAL(10,2)` precision and formatted in the `en-IN` locale (e.g., ₹1,25,000.00).
- **FR-FIN-01 (Advance Payment Rule):** An order cannot transition from `PENDING_ADVANCE` to `CONFIRMED` without at least one valid payment record with status `SUCCESS`.
- **FR-FIN-02 (Flexible Advance Amount):** The advance amount is strictly decided by Nidha on a case-by-case basis (can range from any positive integer up to 100% of the total amount).
- **FR-FIN-03 (Multi-Payment Support):** An order supports multiple payment installments (e.g., Advance payment via UPI, final balance payment via Cash on local delivery or Bank Transfer prior to courier dispatch).
- **FR-FIN-04 (Payment Attributes):** Every payment entry must record:
  - `order_id`
  - `amount`
  - `payment_method` (`UPI`, `BANK_TRANSFER`, `CASH`)
  - `transaction_reference` (UTR number, UPI reference ID, or bank reference - **optional** across all methods to accommodate customers who don't provide the UTR immediately)
  - `payment_date`
  - `notes`
  - `recorded_by` (User ID)
- **FR-FIN-05 (Balance Computation & Overpayment Treatment):**
  $$\text{Total Paid} = \sum \text{Payments (Successful)}$$
  $$\text{Total Refunded} = \sum \text{Refunds (Completed)}$$
  $$\text{Net Paid} = \text{Total Paid} - \text{Total Refunded}$$
  $$\text{Balance Due} = \max(0.00, \text{Total Order Amount} - \text{Net Paid})$$
  - Payment Status flags: 
    - `UNPAID` ($\text{Net Paid} = 0$)
    - `PARTIALLY_PAID` ($0 < \text{Net Paid} < \text{Total Amount}$)
    - `PAID` ($\text{Net Paid} = \text{Total Amount}$)
    - `OVERPAID` ($\text{Net Paid} > \text{Total Amount}$)
  - **Overpayment Policy:** Any excess amount paid beyond total order amount is marked as `OVERPAID` and recognized directly as realized revenue (no mandatory refund required).
- **FR-FIN-06 (Refund Handling):**
  - Individual refunds are handled on an explicit, case-by-case basis when requested by Nidha.
  - Recorded with: `order_id`, `payment_id` (optional reference), `amount`, `refund_method` (`UPI`, `BANK_TRANSFER`, `CASH`), `transaction_reference` (optional), `reason`, `refund_date`, `processed_by`.
  - Refunds cannot exceed total amount paid.

### 3.5 Delivery & Fulfillment
- **FR-FUL-01 (Delivery Types):** Must support two primary delivery methods:
  - `COURIER`: Manual entry for Courier Partner Name (e.g., DTDC, Professional Couriers, India Post, ST Courier), Consignment / Tracking Number, Shipped Date, Estimated Delivery Date. *(Automated aggregator integration like Shiprocket/Delhivery is planned for a future phase).*
  - `LOCAL_DELIVERY`: Requires Delivery Person / Self Notes, Delivery Address, Slot/Date, Recipient Contact.
- **FR-FUL-02 (Delivery Charges):** Delivery fee must be explicitly line-itemed on the order calculation.
- **FR-FUL-03 (Dispatch Readiness):** Orders should alert if balance payment is still due before dispatching via courier.

### 3.6 Expense Management
- **FR-EXP-01 (Independent Expense Recording):** Expenses must be tracked completely independent of order items.
- **FR-EXP-02 (Expense Categories):**
  - `RAW_MATERIALS` (Frames, glass, photographic paper, wood, resin, boxes)
  - `PACKAGING` (Bubble wrap, corrugated boxes, ribbons, stickers, cards)
  - `COURIER_SHIPPING` (Freight and postage paid to courier services)
  - `MARKETING_ADS` (Instagram promotions, flyers, photography)
  - `TOOLS_EQUIPMENT` (Printers, cutters, glue guns, heat presses)
  - `MISCELLANEOUS` (Stationery, transport, electricity, refreshments)
- **FR-EXP-03 (Expense Attributes):** Date, Category, Amount, Payment Method (`UPI`, `BANK_TRANSFER`, `CASH`), Bill Reference / Invoice # (optional), Vendor / Store Name (optional), Description / Item notes. *(Note: Receipt image/document uploads are explicitly not required).*

### 3.7 Business Analytics & Financial Insights
- **FR-ANA-01 (Executive KPIs):**
  - Total Revenue (Gross Bookings vs. Cash Realized).
  - Outstanding Receivables (Total unpaid balance across confirmed/dispatched orders).
  - Total Operating Expenses.
  - Net Business Income ($\text{Cash Realized} - \text{Total Expenses} - \text{Total Refunds}$).
  - Active Orders Count by status.
- **FR-ANA-02 (Sales Analytics):**
  - Monthly & Weekly sales trends.
  - Average Order Value (AOV).
  - Top Revenue Categories (Frames vs. Albums vs. Hampers).
- **FR-ANA-03 (Channel Performance):**
  - Lead conversion rate by channel (Instagram vs. WhatsApp vs. Referrals).
  - Revenue by channel.
- **FR-ANA-04 (Audit & Financial Truth):**
  - No synthetic/mock data. If a period has zero transactions, the system reports zero.

### 3.8 Global Active Month Context & Time Scoping
- **FR-PER-01 (Default Current Month Scope):** By default, every screen across the application (Dashboard KPIs, Orders list, Enquiries pipeline, Payments ledger, Expenses, and Analytics) displays data belonging to the current calendar month (e.g. November 2026 / November 2027).
- **FR-PER-02 (Global Working Month Selector):** 
  - A prominent selector in the top navigation bar and Settings page allows Nidha to switch the global active viewing period (e.g., selecting `August 2027`).
  - Switching the active period immediately scopes all views to that selected month (`2027-08-01 00:00:00` to `2027-08-31 23:59:59`).
  - A persistent visual badge (e.g., 📅 "Viewing: August 2027") remains visible across all screens, preventing accidental entry or confusion.
- **FR-PER-03 (Override Capabilities):** Individual list tables support a "Clear Month Filter / Show All-Time" toggle when historical cross-period customer or order lookups are required.

### 3.9 System-Wide Comprehensive Audit Logging
- **FR-LOG-01 (Universal Activity Capture):** Every single user mutation and state change across the application MUST be stored permanently in an immutable audit ledger.
- **FR-LOG-02 (Logged Action Scope):**
  - Order actions: Created, Line Items Modified, Pricing Changed, Status Changed, Cancelled.
  - Financial actions: Advance Recorded, Balance Recorded, Payment Voided, Refund Authorized.
  - Customer & Lead actions: Customer Created/Updated, Enquiry Logged, Enquiry Converted, Enquiry Dropped.
  - Logistics actions: Fulfillment Created, Courier Partner / Tracking # Entered, Delivery Status Changed.
  - Expense actions: Expense Logged, Expense Deleted.
  - System actions: User Login, Logout, Password Changed, Global Period Changed.
- **FR-LOG-03 (Log Attributes):** Every audit entry must store: Timestamp, Operator ID (`user_id`), Action Code, Entity Type, Entity ID, IP Address, User Agent, JSON snapshot of Old Values (`before`), JSON snapshot of New Values (`after`), and a human-readable description summary.

### 3.10 Rollout & Cutover Schedule
- **FR-DEP-01 (Pilot Deployment):** December 2026 — Initial deployment for real-world testing, customer lead capture, and pilot gifting orders.
- **FR-DEP-02 (Full Operational Cutover):** January 2027 — 100% full daily operational reliance for all orders, payments, expenses, and analytics.

---

## 4. Non-Functional & Architectural Requirements

### 4.1 System Roles & Scalability
- **Current Single-User:** Nidha is the super-administrator with full permissions.
- **Future-Proof RBAC:** Architecture must support roles:
  - `OWNER / SUPER_ADMIN`: Full access to financial metrics, expenses, user management, order approvals, and settings.
  - `STAFF / ASSISTANT`: Access to view/create enquiries, update order progress, enter tracking numbers; restricted from viewing overall net profit, expense ledgers, and system configurations.

### 4.2 Messaging Automation Readiness
- Domain events must fire on key triggers:
  - `OrderConfirmedEvent`
  - `AdvancePaymentReceivedEvent`
  - `OrderDispatchedEvent`
  - `BalancePaymentReceivedEvent`
- Event listeners must be modular so that an automated WhatsApp/Instagram webhook integration (e.g., via WhatsApp Cloud API or Twilio) can be connected without restructuring the core ordering logic.

### 4.3 Explicit Out-of-Scope Items
- **NO Inventory Management:** No stock level tracking, no low-stock alerts, no warehouse management.
- **NO Production Routing / Design Approval Workflows:** No multi-stage proof approval portals or graphic designer task assignment.
