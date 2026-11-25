# Ninu Arts Business Manager — Business Workflows & Operating Rules

**Document Version:** 1.0.0  
**Architect:** Senior Software Architect & Product Engineer  

---

## 1. Overview of Core Business Workflows

This document establishes standard operating procedures and system workflows for Ninu Arts, codifying the complete lifecycle from initial Instagram/WhatsApp enquiry to fulfillment, payment reconciliation, and financial reporting.

---

## 2. Workflow 1: Lead Ingestion & Customer CRM Pipeline

Captures customer inquiries arriving through Instagram DMs, WhatsApp, or phone calls, ensuring no prospective gifting client is lost.

```mermaid
flowchart TD
    A["Customer Enquiry via Instagram DM / WhatsApp"] --> B["Nidha opens Quick Lead Form in CRM"]
    B --> C{"Existing Customer?"}
    C -- "Yes" --> D["Select Existing Customer Profile"]
    C -- "No" --> E["Create New Customer (Name, Phone, Instagram Handle, City)"]
    D --> F["Log Enquiry (Interest, Budget Range, Target Date, Channel)"]
    E --> F
    F --> G["Enquiry Status: NEW"]
    G --> H["Nidha discusses options & shares estimates with client"]
    H --> I{"Customer Decision"}
    I -- "Interested / Ready to Order" --> J["Click 'Convert to Order'"]
    I -- "Needs Follow-up" --> K["Set Follow-up Date; Status: ESTIMATE_SENT"]
    I -- "Dropped / Unresponsive" --> L["Status: LOST (Log Reason: Budget, Inactivity, etc.)"]
    J --> M["Draft Order created with Customer Details; Enquiry Status: CONVERTED"]
```

### Key Business Rules:
1. Every phone number recorded should ideally be WhatsApp-compatible.
2. Instagram handle is stored to reconcile DM conversations with phone numbers.
3. Converting an enquiry creates a draft order without needing duplicate entry of customer data.

---

## 3. Workflow 2: Order Booking, Custom Pricing & Advance Confirmation

Orders are confirmed only upon receipt of advance payment.

```mermaid
flowchart TD
    A["Draft Order In Progress"] --> B["Add Line Items (Catalog products or Bespoke Custom items)"]
    B --> C["Enter Custom Specifications (Names, Quotes, Theme, Photos)"]
    C --> D["Set Line Item Pricing (Standard or Custom Quote)"]
    D --> E["Add Delivery Charge (Courier / Local Delivery) & Discounts"]
    E --> F["System computes: Subtotal, Total Order Amount"]
    F --> G["Nidha determines agreed Advance Payment Amount"]
    G --> H["Order saved as PENDING_ADVANCE"]
    H --> I["Customer transfers Advance via UPI / Bank / Cash"]
    I --> J["Nidha records Payment: Amount, Payment Method, Transaction Reference (UTR)"]
    J --> K{"Payment Validated?"}
    K -- "Yes" --> L["Order Status updates to CONFIRMED"]
    L --> M["Payment Status updates to PARTIALLY_PAID (or PAID if 100% advance)"]
    L --> N["Remaining Balance calculated: Total Amount - Advance"]
    L --> O["Crafting / Preparation begins; Order moves to IN_PROGRESS"]
```

### Key Financial Rules:
1. **Advance Enforcement:** An order cannot transition to `CONFIRMED` until an advance payment is logged with status `SUCCESS`.
2. **Flexible Advance:** The advance amount is determined by Nidha (can be 0%, 30%, 50%, or 100% depending on customer trust and custom material requirements).
3. **Optional Transaction Reference:** Capturing the UTR / transaction ID is supported for reference, but remains strictly **optional** across all methods (UPI, Bank Transfer, Cash) so orders can be confirmed even when the customer doesn't supply the transaction ID immediately.

---

## 4. Workflow 3: Confirmed Order Modification (Amendment Workflow)

Customers frequently request alterations (e.g., adding a mini frame, upgrading album size, changing delivery address) after paying the advance.

```mermaid
flowchart TD
    A["Customer requests modification on CONFIRMED order"] --> B["Nidha opens Order Amendment View"]
    B --> C["Modify Line Items: Add items, update quantities, or alter pricing"]
    C --> D["Adjust Delivery Charges or Discounts if applicable"]
    D --> E["System recalculates: New Subtotal and New Total Amount"]
    E --> F["System compares Previous Total vs New Total"]
    F --> G["Recalculate Balance Due: New Total - Net Payments Received"]
    G --> H["Log change summary in Order Modification History"]
    H --> I{"Did Total Amount increase?"}
    I -- "Yes" --> J["Increased Balance Due displayed in Order Center"]
    I -- "No (Reduced)" --> K{"Is Total Paid > New Total?"}
    K -- "Yes" --> L["Payment Status: OVERPAID; Surplus added to realized revenue"]
    K -- "No" --> M["Remaining Balance updated"]
```

### Key Business Rules:
1. Past payments are immutable; they remain linked to the order.
2. Every amendment requires a change note (e.g., "Customer added 1 mini album; courier changed to DTDC Express").
3. **Overpayment Treatment:** If total payments received exceed the new total order amount, the order is marked as `OVERPAID`, remaining balance is set to `0.00`, and the surplus is recognized directly into business revenue. Formal refund is not forced unless explicitly requested by Nidha.

---

## 5. Workflow 4: Balance Settlement, Dispatch & Fulfillment

Managing courier logistics and final balance collection.

```mermaid
flowchart TD
    A["Crafting Complete: Order marked READY_FOR_DELIVERY"] --> B{"Delivery Type"}
    B -- "COURIER" --> C["Check Balance Status"]
    B -- "LOCAL_DELIVERY" --> D["Schedule Local Delivery Slot"]
    C -- "Balance Outstanding" --> E["Nidha requests final balance payment from client"]
    E --> F["Customer pays Balance via UPI / Bank"]
    F --> G["Record Final Payment with Transaction UTR"]
    G --> H["Order Payment Status: PAID"]
    H --> I["Package Order & Dispatch via Courier Partner (DTDC, India Post, etc.)"]
    I --> J["Record Fulfillment: Courier Name, Consignment / Tracking Number, Dispatch Date"]
    J --> K["Order Status updates to DISPATCHED"]
    K --> L["Tracking number provided to customer"]
    L --> M["Courier delivers parcel; Status marked DELIVERED"]
    D --> N["Handover to client; Collect cash / UPI payment on delivery"]
    N --> O["Record Payment & mark DELIVERED"]
```

### Key Logistics Rules:
1. Dispatch warning: If an order has an unpaid balance, the system displays a prominent amber warning before recording courier consignment.
2. Tracking information is mandatory for courier shipments to allow future automated WhatsApp dispatch notifications.

---

## 6. Workflow 5: Refund Processing

Covers order cancellations or downward price revisions.

```mermaid
flowchart TD
    A["Order Cancelled or Downsized"] --> B["Nidha accesses 'Process Refund' in Order Center"]
    B --> C["Enter Refund Amount (Must be <= Net Paid Amount)"]
    C --> D["Select Refund Method (UPI, Bank Transfer, Cash)"]
    D --> E["Enter Outbound Transaction Reference / UTR & Reason"]
    E --> F["System writes immutable record to REFUNDS ledger"]
    F --> G["Recalculate Net Paid: Total Paid - Total Refunded"]
    G --> H["Recalculate Order Balance & update Payment Status"]
    H --> I["Refund entry logged in Financial Analytics"]
```

### Key Financial Rules:
1. Total refunds cannot exceed the total amount successfully paid.
2. Outbound transaction reference must be recorded for UPI or Bank transfers.

---

## 7. Workflow 6: Operating Expense Logging

Tracking raw materials, tools, and courier costs to compute true business net profit.

```mermaid
flowchart TD
    A["Expense Incurred (Materials, Courier, Packaging, Marketing)"] --> B["Nidha opens 'Record Expense' Modal"]
    B --> C["Select Category (Raw Materials, Packaging, Courier, etc.)"]
    C --> D["Enter Amount, Date, Vendor Name, and Bill Reference (Optional)"]
    D --> E["Select Payment Method (UPI, Bank, Cash) and enter Description"]
    E --> F["Save Expense Entry (No file uploads required)"]
    F --> G["Deducted from Realized Revenue in P&L Analytics"]
```

### Key Accounting Rules:
1. Expenses are recorded separately from order cost.
2. Expense recording is fast and text-only (receipt document uploads are explicitly not required).
3. Net profit calculation:
   $$\text{Net Profit} = \text{Cash Collected from Orders} - \text{Total Operating Expenses} - \text{Total Refunds}$$
