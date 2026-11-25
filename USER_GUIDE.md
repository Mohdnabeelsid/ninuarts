# Ninu Arts Business Manager — Operator User Guide

Welcome to **Ninu Arts Business Manager**, designed for daily studio operations in Alappuzha, Kerala.

---

## 1. Signing In & Roles

Open the application and sign in with your operator email and password.

| Role | What You Can Access |
|---|---|
| **Owner (`OWNER`)** | Everything: Dashboard, Customers, Enquiries, Products, Orders, Payments, **Refunds**, **Expenses**, **Analytics & P&L**, **Activity Audit Logs**, **Settings** |
| **Staff (`STAFF`)** | Daily operations: Customers, Enquiries, Products, Orders, Payments, Deliveries |

Use the **Working Month Scope** selector in the top-right header (`November 2026`, etc.) to inspect period-scoped views.

---

## 2. Daily Studio Workflow

### Step A: Log an Inbound Lead (Enquiries)
1. Go to **Leads & Enquiries** → click **New Lead**.
2. Choose **Instagram**, **WhatsApp**, **Call**, or **Other**.
3. Enter customer name/phone (existing customers are auto-matched by phone to prevent duplicates) and product interest.
4. Click any lead row to open the **right-side detail drawer**, add **Follow-up Notes**, update status (`CONTACTED`, `QUOTED`, `LOST`), or click **Convert to Order**.

### Step B: Create & Confirm an Order
1. Go to **Orders** → click **Create Order**.
2. Select an existing customer or create a new customer inline.
3. Add **Catalogue Products** and/or **Custom Products** (e.g., custom resin clock, engraving specs). Enter quantity, unit price, and direct cost when known (used later for gross profit reports).
4. Set **Delivery Charge**, **Discount**, and **Advance Required**.
5. **Confirming Orders:** An order starts as `DRAFT`. Recording a valid **Advance Payment** (`UPI`, `BANK_TRANSFER`, or `CASH`) automatically shifts the order to `CONFIRMED`. Orders cannot be confirmed with zero advance.
6. *Note:* Changing a catalogue product's price later never alters historical order prices.

### Step C: Modify Orders, Record Payments & Process Refunds
1. Click any order row to open the **Order Detail Drawer**.
2. **Modify Order:** Use **Edit / Modify Order** and enter a mandatory **Modification Reason**. The system saves a snapshot of previous vs. new values in the Modification History.
3. **Record Payments:** Record `PARTIAL`, `ADDITIONAL`, or `BALANCE_FINAL` payments. Transaction references (UTR/NEFT) are optional for `CASH` payments; duplicate UTRs on the same order are automatically blocked.
4. **Refunds (Owner Only):** Record a refund with method and reason. Refund amounts cannot exceed the net paid balance, and original payment records are never deleted.

### Step D: Manage Deliveries & Dispatch Messages
1. Go to **Deliveries & Shipping** → click **Create Shipment** for a confirmed order.
2. Choose **Courier Partner** (e.g., DTDC, India Post, Delhivery) or **Local Delivery**, enter tracking number (AWB) and expected delivery date.
3. Click the **Send** icon on a shipment to generate a ready-to-copy WhatsApp / Instagram DM dispatch message for the customer (sent manually — no automated messaging).
4. Updating shipment status to **Dispatched** or **Delivered** automatically syncs the linked order status and records status history.
5. Overdue shipments appear in red alert banners on both the **Dashboard** and **Deliveries** pages.

### Step E: Record Studio Expenses (Owner Only)
1. Go to **Expense Ledger** → click **Record Expense**.
2. Pick a default category (`Materials`, `Printing`, `Packaging`, `Courier`, `Marketing`, `Transportation`, `Software`, `Other`) or create a custom category.
3. Upload a receipt image/PDF (stored privately; accessible only to Owner accounts).

### Step F: Review Analytics & P&L (Owner Only)
Go to **Analytics & P&L** to inspect all 7 live database reports:
1. **Revenue vs Cash:** Clearly separates accrued order value from actual cash collected minus refunds.
2. **Product Profitability:** Shows units sold, revenue, recorded direct costs, and gross profit. Products missing cost records are separated rather than estimated.
3. **Order Lifecycle:** Status distribution and completion rate.
4. **Lead Funnel:** Closed conversion rate excluding open discussions, split by Instagram vs. WhatsApp.
5. **Customer Retention:** Verified purchasers and repeat purchase rate (excluding unverified CSV imports).
6. **Expense Analysis:** Category and payment method distribution.
7. **Delayed Orders:** Actionable list of overdue deliveries with days overdue.
