# Ninu Arts Business Manager — Database Design Specification

**Document Version:** 1.0.0  
**Database Management System:** MySQL 8.0+ (InnoDB Engine)  
**Character Set & Collation:** `utf8mb4` / `utf8mb4_unicode_ci`  
**Timezone:** Asia/Kolkata (IST, UTC+05:30)  

---

## 1. Design Philosophy & Data Integrity Mandates

1. **Strict Financial Precision & Currency:** All monetary amounts are denominated in Indian Rupee (INR / ₹) and stored as `DECIMAL(10,2)`. Under no circumstances are floating-point types (`FLOAT`, `DOUBLE`) permitted for financial calculations.
2. **Snapshot Integrity (Historical Immutability):** Order items store the item name, unit price, and discount at the time of purchase. Future changes in the product master table never alter past transactions.
3. **Audited Ledger Pattern:** Payments, refunds, and order modifications maintain an append-style or log-backed audit trail. Deleting payment or order records is forbidden; cancellations and refunds are explicit state transitions.
4. **Referential Integrity:** Foreign keys use `ON DELETE RESTRICT` for financial and order records to prevent accidental cascading data loss. Soft deletes (`deleted_at`) are utilized on customer and product entities.
5. **Concurrency & Locking:** Financial updates (payment recording, order edits) must utilize pessimistic locking (`SELECT ... FOR UPDATE` via `DB::transaction`) to avoid race conditions when calculating balances.

---

## 2. Table-by-Table Schema Specification

### 2.1 Table: `users`
Stores system operators. Currently configured for Nidha, with full support for future staff.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique user identifier |
| `name` | `VARCHAR(100)` | `NOT NULL` | Full name of operator |
| `email` | `VARCHAR(150)` | `NOT NULL`, `UNIQUE` | User login email |
| `phone` | `VARCHAR(20)` | `NULL` | Operator phone number |
| `password` | `VARCHAR(255)` | `NOT NULL` | Bcrypt hashed password |
| `role` | `ENUM('OWNER', 'STAFF')` | `NOT NULL`, `DEFAULT 'STAFF'` | RBAC role |
| `is_active` | `TINYINT(1)` | `NOT NULL`, `DEFAULT 1` | Account status flag |
| `remember_token` | `VARCHAR(100)` | `NULL` | Sanctum / session token |
| `created_at` | `TIMESTAMP` | `NULL` | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | `NULL` | Record modification timestamp |

---

### 2.2 Table: `customers`
Customer relationship records capturing leads and repeat clients.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique customer identifier |
| `name` | `VARCHAR(150)` | `NOT NULL` | Customer full name |
| `phone` | `VARCHAR(20)` | `NOT NULL`, `INDEX` | Primary phone / WhatsApp number |
| `instagram_handle`| `VARCHAR(100)` | `NULL`, `INDEX` | Instagram handle (e.g., `@client_profile`) |
| `email` | `VARCHAR(150)` | `NULL` | Customer email address |
| `source_channel` | `ENUM('INSTAGRAM', 'WHATSAPP', 'REFERRAL', 'DIRECT')` | `NOT NULL`, `DEFAULT 'INSTAGRAM'` | Initial acquisition channel |
| `delivery_address`| `TEXT` | `NULL` | Primary shipping/delivery address |
| `city` | `VARCHAR(100)` | `NOT NULL`, `DEFAULT 'Alappuzha'` | Delivery city |
| `pincode` | `VARCHAR(10)` | `NULL` | Postal PIN code |
| `notes` | `TEXT` | `NULL` | Long-term preferences, anniversaries, notes |
| `deleted_at` | `TIMESTAMP` | `NULL` | Soft delete support |
| `created_at` | `TIMESTAMP` | `NULL` | Ingestion timestamp |
| `updated_at` | `TIMESTAMP` | `NULL` | Last update timestamp |

---

### 2.3 Table: `enquiries`
Lead tracking pipeline before formal order conversion.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique enquiry identifier |
| `customer_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> customers(id)` | Associated customer record |
| `channel` | `ENUM('INSTAGRAM', 'WHATSAPP', 'CALL', 'OTHER')` | `NOT NULL` | Ingestion channel for this enquiry |
| `product_interest`| `VARCHAR(255)` | `NOT NULL` | Description of interest (e.g. "12x8 Frame + Hamper") |
| `budget_range` | `VARCHAR(100)` | `NULL` | Customer mentioned budget |
| `status` | `ENUM('NEW', 'CONTACTED', 'ESTIMATE_SENT', 'CONVERTED', 'LOST')` | `NOT NULL`, `DEFAULT 'NEW'` | Pipeline status |
| `lost_reason` | `VARCHAR(255)` | `NULL` | Reason if status is `LOST` (e.g., "Budget mismatch") |
| `follow_up_date` | `DATE` | `NULL`, `INDEX` | Scheduled follow up date |
| `notes` | `TEXT` | `NULL` | Detailed notes on customer requirements |
| `converted_order_id`| `BIGINT UNSIGNED` | `NULL`, `FK -> orders(id)` | Linked order if converted |
| `created_at` | `TIMESTAMP` | `NULL` | Ingestion timestamp |
| `updated_at` | `TIMESTAMP` | `NULL` | Last status update |

---

### 2.4 Table: `products`
Standard base product offerings catalogue.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique product identifier |
| `name` | `VARCHAR(200)` | `NOT NULL` | Base product name |
| `category` | `ENUM('PHOTO_FRAME', 'MAGAZINE_ALBUM', 'GIFT_HAMPER', 'CUSTOM_GIFT')` | `NOT NULL` | High-level product category |
| `base_price` | `DECIMAL(10,2)` | `NOT NULL`, `DEFAULT 0.00` | Reference starting price in INR |
| `description` | `TEXT` | `NULL` | Detailed item specifications & dimensions |
| `image_url` | `VARCHAR(500)` | `NULL` | Reference preview image URL |
| `is_active` | `TINYINT(1)` | `NOT NULL`, `DEFAULT 1` | Available for selection flag |
| `deleted_at` | `TIMESTAMP` | `NULL` | Soft delete support |
| `created_at` | `TIMESTAMP` | `NULL` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | `NULL` | Modification timestamp |

---

### 2.5 Table: `orders`
Master order records maintaining financial balance and fulfillment states.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique order ID |
| `order_number` | `VARCHAR(30)` | `NOT NULL`, `UNIQUE` | Human-friendly code (e.g., `ORD-2026-0001`) |
| `customer_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> customers(id)` | Associated customer |
| `status` | `ENUM('DRAFT', 'PENDING_ADVANCE', 'CONFIRMED', 'IN_PROGRESS', 'READY_FOR_DELIVERY', 'DISPATCHED', 'DELIVERED', 'CANCELLED')` | `NOT NULL`, `DEFAULT 'DRAFT'`, `INDEX` | Operational lifecycle status |
| `payment_status` | `ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERPAID')` | `NOT NULL`, `DEFAULT 'UNPAID'`, `INDEX` | Financial payment status |
| `subtotal_amount`| `DECIMAL(10,2)` | `NOT NULL`, `DEFAULT 0.00` | Sum of all line item totals |
| `delivery_charge`| `DECIMAL(10,2)` | `NOT NULL`, `DEFAULT 0.00` | Shipping/courier fee charged to client |
| `discount_amount`| `DECIMAL(10,2)` | `NOT NULL`, `DEFAULT 0.00` | Order-level discount applied |
| `total_amount` | `DECIMAL(10,2)` | `NOT NULL`, `DEFAULT 0.00` | Final payable ($\text{Subtotal} + \text{Delivery} - \text{Discount}$) |
| `advance_amount_required` | `DECIMAL(10,2)` | `NOT NULL`, `DEFAULT 0.00` | Advance amount agreed upon for confirmation |
| `total_paid` | `DECIMAL(10,2)` | `NOT NULL`, `DEFAULT 0.00` | Total confirmed payments minus refunds |
| `balance_amount` | `DECIMAL(10,2)` | `NOT NULL`, `DEFAULT 0.00` | Remaining balance ($\text{Total} - \text{Paid}$) |
| `confirmed_at` | `TIMESTAMP` | `NULL` | Timestamp when advance was received & confirmed |
| `target_delivery_date` | `DATE` | `NULL` | Committed completion / delivery date |
| `internal_notes` | `TEXT` | `NULL` | Private operational notes by Nidha |
| `created_by` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> users(id)` | Operator who created order |
| `created_at` | `TIMESTAMP` | `NULL` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | `NULL` | Last modification timestamp |

---

### 2.6 Table: `order_items`
Detailed line items within an order. Supports both standard catalog products and custom items.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique item identifier |
| `order_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> orders(id) ON DELETE CASCADE` | Parent order reference |
| `product_id` | `BIGINT UNSIGNED` | `NULL`, `FK -> products(id) ON DELETE SET NULL` | Linked catalog item (NULL if 100% custom) |
| `item_name` | `VARCHAR(255)` | `NOT NULL` | Name / description of item |
| `item_type` | `ENUM('CATALOG', 'CUSTOM')` | `NOT NULL`, `DEFAULT 'CATALOG'` | Classification |
| `unit_price` | `DECIMAL(10,2)` | `NOT NULL` | Agreed price per unit at order time |
| `quantity` | `INT UNSIGNED` | `NOT NULL`, `DEFAULT 1` | Units ordered |
| `total_price` | `DECIMAL(10,2)` | `NOT NULL` | Line total ($\text{Unit Price} \times \text{Quantity}$) |
| `customization_details` | `TEXT` | `NULL` | Inscription texts, names, photo specs, theme notes |
| `created_at` | `TIMESTAMP` | `NULL` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | `NULL` | Modification timestamp |

---

### 2.7 Table: `order_modifications`
Audit history logging any modifications made to confirmed orders.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique record ID |
| `order_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> orders(id)` | Associated order |
| `modified_by` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> users(id)` | Operator who made change |
| `previous_total` | `DECIMAL(10,2)` | `NOT NULL` | Total before change |
| `new_total` | `DECIMAL(10,2)` | `NOT NULL` | Total after change |
| `change_summary` | `TEXT` | `NOT NULL` | Human-readable diff (e.g., "Added 1x A4 Acrylic Frame") |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Timestamp of modification |

---

### 2.8 Table: `payments`
Immutable financial ledger of payments received.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique payment record ID |
| `order_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> orders(id)` | Order receiving payment |
| `payment_type` | `ENUM('ADVANCE', 'INTERIM', 'BALANCE_FINAL')` | `NOT NULL` | Phase of payment |
| `amount` | `DECIMAL(10,2)` | `NOT NULL` | Currency amount in INR |
| `payment_method` | `ENUM('UPI', 'BANK_TRANSFER', 'CASH')` | `NOT NULL` | Payment mode |
| `transaction_reference` | `VARCHAR(100)` | `NULL`, `INDEX` | UPI UTR, IMPS/NEFT ref, or receipt code (Optional across all methods) |
| `payment_date` | `DATE` | `NOT NULL` | Date payment settled |
| `status` | `ENUM('SUCCESS', 'VOIDED')` | `NOT NULL`, `DEFAULT 'SUCCESS'` | Financial validity status |
| `notes` | `TEXT` | `NULL` | Payment notes (e.g. "GPay from Rahul's father") |
| `recorded_by` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> users(id)` | Operator entering record |
| `created_at` | `TIMESTAMP` | `NULL` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | `NULL` | Modification timestamp |

---

### 2.9 Table: `refunds`
Dedicated ledger for refunds issued.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique refund record ID |
| `order_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> orders(id)` | Related order |
| `payment_id` | `BIGINT UNSIGNED` | `NULL`, `FK -> payments(id)` | Specific payment being refunded (if applicable) |
| `amount` | `DECIMAL(10,2)` | `NOT NULL` | Refund amount in INR |
| `refund_method` | `ENUM('UPI', 'BANK_TRANSFER', 'CASH')` | `NOT NULL` | Channel through which refund was remitted |
| `transaction_reference` | `VARCHAR(100)` | `NULL` | Outbound UTR / transaction ID |
| `reason` | `VARCHAR(255)` | `NOT NULL` | Reason (e.g., "Client cancelled before crafting") |
| `refund_date` | `DATE` | `NOT NULL` | Date refund was issued |
| `status` | `ENUM('COMPLETED', 'FAILED')` | `NOT NULL`, `DEFAULT 'COMPLETED'` | Status of refund |
| `processed_by` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> users(id)` | Operator authorizing refund |
| `created_at` | `TIMESTAMP` | `NULL` | Ingestion timestamp |
| `updated_at` | `TIMESTAMP` | `NULL` | Update timestamp |

---

### 2.10 Table: `fulfillments`
Logistics and dispatch tracking for orders.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique fulfillment ID |
| `order_id` | `BIGINT UNSIGNED` | `NOT NULL`, `UNIQUE`, `FK -> orders(id)` | One-to-one with order |
| `delivery_type` | `ENUM('COURIER', 'LOCAL_DELIVERY')` | `NOT NULL` | Mode of delivery |
| `courier_partner` | `VARCHAR(100)` | `NULL` | DTDC, India Post, Professional, ST Courier, etc. |
| `tracking_number`| `VARCHAR(100)` | `NULL`, `INDEX` | Courier consignment / tracking number |
| `shipped_date` | `DATE` | `NULL` | Handover date to courier / rider |
| `estimated_delivery_date` | `DATE` | `NULL` | Target arrival date |
| `delivered_date` | `DATE` | `NULL` | Actual confirmation date |
| `delivery_notes` | `TEXT` | `NULL` | Local delivery drop-off directions / recipient notes |
| `status` | `ENUM('PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED')` | `NOT NULL`, `DEFAULT 'PACKED'` | Shipping state |
| `created_at` | `TIMESTAMP` | `NULL` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | `NULL` | Modification timestamp |

---

### 2.11 Table: `expense_categories`
Lookup table for categorizing business expenditures.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique category ID |
| `name` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | Category title (e.g., "Raw Materials") |
| `code` | `VARCHAR(50)` | `NOT NULL`, `UNIQUE` | Normalized code (e.g., `RAW_MATERIALS`) |
| `description` | `VARCHAR(255)` | `NULL` | Scope of expenses |
| `created_at` | `TIMESTAMP` | `NULL` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | `NULL` | Modification timestamp |

---

### 2.12 Table: `expenses`
Operational expenses ledger for tracking business costs.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique expense ID |
| `category_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> expense_categories(id)` | Expense category |
| `amount` | `DECIMAL(10,2)` | `NOT NULL` | Expense cost in INR |
| `expense_date` | `DATE` | `NOT NULL`, `INDEX` | Date of outlay |
| `payment_method` | `ENUM('UPI', 'BANK_TRANSFER', 'CASH')` | `NOT NULL` | Outflow payment method |
| `vendor_name` | `VARCHAR(150)` | `NULL` | Store / supplier name |
| `bill_reference` | `VARCHAR(100)` | `NULL` | Invoice / Receipt # (optional) |
| `description` | `TEXT` | `NOT NULL` | Details of items purchased |
| `recorded_by` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> users(id)` | Operator entering record |
| `created_at` | `TIMESTAMP` | `NULL` | Ingestion timestamp |
| `updated_at` | `TIMESTAMP` | `NULL` | Update timestamp |

---

### 2.13 Table: `activity_logs`
System-wide immutable audit trail recording every single operation, mutation, and state transition.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique log entry ID |
| `user_id` | `BIGINT UNSIGNED` | `NULL`, `FK -> users(id) ON DELETE SET NULL` | Operator performing action |
| `action` | `VARCHAR(100)` | `NOT NULL`, `INDEX` | Action code (e.g., `ORDER_CREATED`, `ORDER_MODIFIED`, `PAYMENT_RECORDED`) |
| `entity_type` | `VARCHAR(100)` | `NOT NULL`, `INDEX` | Model/Entity class (e.g., `Order`, `Payment`, `Customer`) |
| `entity_id` | `BIGINT UNSIGNED` | `NOT NULL`, `INDEX` | ID of affected entity |
| `description` | `TEXT` | `NOT NULL` | Human-readable explanation of event |
| `old_values` | `JSON` | `NULL` | JSON state snapshot before modification |
| `new_values` | `JSON` | `NULL` | JSON state snapshot after modification |
| `ip_address` | `VARCHAR(45)` | `NULL` | Client IP address (IPv4 or IPv6) |
| `user_agent` | `TEXT` | `NULL` | Browser / device user-agent string |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `INDEX` | Exact timestamp of operation |

---

## 3. Database Indexes & Query Optimizations

1. **`customers(phone)`**: High frequency lookup when incoming WhatsApp messages or calls are received.
2. **`orders(order_number)`**: Rapid search from dashboard search bar.
3. **`orders(status, payment_status)`**: Composite index for pipeline filtering and dashboard operational queues.
4. **`orders(created_at)`**: Date-range filtering for monthly sales analytics.
5. **`payments(order_id, status)`**: Fast calculation of total payments per order.
6. **`expenses(expense_date, category_id)`**: Composite index for monthly P&L and expense reporting.
7. **`enquiries(status, follow_up_date)`**: Quick lookup of overdue leads needing follow-up.
8. **`orders(created_at, status)`**: Composite index for instant Global Active Working Month scoping.
9. **`activity_logs(created_at, action)`**: High performance audit trail search and chronological timeline playback.
