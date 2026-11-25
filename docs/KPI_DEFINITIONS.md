# Ninu Arts — Key Performance Indicators (KPI) & Accounting Definitions

This document details the exact mathematical formulas, data constraints, accounting policies, and business logic governing all financial and operational intelligence reports in the Ninu Arts Business Manager.

---

## 1. Financial & Revenue Metrics

### 1.1 Recognized Order Revenue (Accrual Basis)
- **Definition:** Total financial commitment booked upon order confirmation and delivery readiness, representing earned revenue regardless of whether final payment has cleared.
- **Formula:**
  $$\text{Recognized Revenue} = \sum (\text{Order Total Amount})$$
  $$\text{for all Orders where } \text{status} \notin \{\text{'DRAFT'}, \text{'CANCELLED'}\}$$
- **Order Total Amount:**
  $$\text{Total} = \text{Subtotal} + \text{Delivery Charge} - \text{Discount Amount}$$
- **Accounting Policy:** Accrual accounting basis. Cancelled orders and drafts are strictly excluded.

### 1.2 Net Cash Collected (Cash Realization Basis)
- **Definition:** The actual net liquid inflows deposited into Ninu Arts accounts (UPI, Bank Transfer, Cash) minus processed refunds.
- **Formula:**
  $$\text{Net Cash Collected} = \sum (\text{Successful Payments}) - \sum (\text{Settled Refunds})$$
- **Accounting Policy:** Cash accounting basis. Reflects true cash liquidity available for operating expenses.

### 1.3 Collection Variance (Receivables Gap)
- **Definition:** Difference between recognized revenue and cash deposited in a given calendar month.
- **Formula:**
  $$\text{Variance} = \text{Recognized Order Revenue} - \text{Net Cash Collected}$$
- **Explanation:** Positive variance indicates customer balances pending upon delivery (advance paid, balance pending); negative variance indicates collection of past months' outstanding balances.

### 1.4 Outstanding Receivables
- **Definition:** Uncollected balances on all active, non-delivered and non-cancelled orders.
- **Formula:**
  $$\text{Outstanding Receivables} = \sum (\text{Balance Amount})$$
  $$\text{for all Orders where } \text{status} \notin \{\text{'CANCELLED'}, \text{'DELIVERED'}\}$$

---

## 2. Product Profitability & Unit Economics

### 2.1 Product Revenue
- **Formula:**
  $$\text{Product Revenue} = \sum (\text{Unit Price} \times \text{Quantity})$$
  $$\text{for order line items belonging to verified orders}$$

### 2.2 Recorded Direct Costs
- **Definition:** The sum of internal raw material, frame, canvas printing, and packaging costs explicitly logged against order items in `order_item_costs`.
- **Policy:** **Strict zero-estimation rule.** Missing direct costs are **never invented or assumed**. Line items lacking recorded cost entries are flagged with `has_incomplete_cost: true` and surfaced in a dedicated review queue.

### 2.3 Gross Profit & Gross Margin %
- **Gross Profit:**
  $$\text{Gross Profit} = \text{Product Revenue} - \text{Recorded Direct Costs}$$
- **Gross Margin Percentage:**
  $$\text{Gross Margin \%} = \begin{cases} \left( \frac{\text{Gross Profit}}{\text{Product Revenue}} \right) \times 100 & \text{if Product Revenue} > 0 \\ 0.0 & \text{otherwise} \end{cases}$$

---

## 3. Enquiry Conversion & Lead Cohorts

### 3.1 Closed Enquiry Conversion Rate
- **Definition:** The proportion of concluded customer inquiries that successfully converted into order-ready customers.
- **Formula:**
  $$\text{Closed Conversion Rate} = \frac{\text{Converted Enquiries}}{\text{Converted Enquiries} + \text{Lost Enquiries}} \times 100$$
- **Cohort Exclusion Rule:** Enquiries currently in active conversation (`NEW`, `CONTACTED`, `DISCUSSING`, `ESTIMATE_SENT`, `QUOTED`) and duplicates are **strictly excluded from the denominator** to prevent artificial rate deflation.

### 3.2 Total Cohort Conversion Rate
- **Formula:**
  $$\text{Total Funnel Rate} = \frac{\text{Converted Enquiries}}{\text{Total Enquiries Logged}} \times 100$$

### 3.3 Channel Conversion Breakdown
- Calculated independently for **Instagram Direct** and **WhatsApp Business** to determine channel ROI and conversion speed.

---

## 4. Customer Retention & Lifetime Value (LTV)

### 4.1 Verified Purchasing Customers
- **Definition:** Customers who have placed at least one verified non-cancelled order in the system database.
- **Data Integrity Rule:** **Imported historical customer CSV records without verified system orders are strictly excluded** from verified purchasing counts and repeat purchase ratios.

### 4.2 Returning Customers
- **Definition:** Customers with 2 or more verified non-cancelled orders.

### 4.3 Repeat Purchase Rate
- **Formula:**
  $$\text{Repeat Purchase Rate} = \frac{\text{Returning Customers}}{\text{Verified Purchasing Customers}} \times 100$$

### 4.4 Customer Lifetime Value (LTV)
- **Formula:**
  $$\text{Customer LTV} = \sum (\text{Total Amount of Verified Orders placed by Customer})$$

---

## 5. Delivery & Fulfillment Health

### 5.1 Days Overdue
- **Definition:** Number of calendar days elapsed since the expected delivery date for shipments that have not been delivered or returned.
- **Formula:**
  $$\text{Days Overdue} = \text{Today} - \text{Estimated Delivery Date}$$
  $$\text{where } \text{status} \notin \{\text{'DELIVERED'}, \text{'RETURNED'}\} \text{ and } \text{Estimated Delivery Date} < \text{Today}$$

### 5.2 Order Completion Rate
- **Formula:**
  $$\text{Completion Rate} = \frac{\text{Delivered Orders}}{\text{Total Orders}} \times 100$$
