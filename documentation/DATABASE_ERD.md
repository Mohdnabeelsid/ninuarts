# Ninu Arts Business Manager — Database Entity Relationship Diagram (ERD)

**Document Version:** 1.0.0  
**Architect:** Senior Software Architect & Product Engineer  

---

## 1. Visual Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ ORDERS : "creates"
    USERS ||--o{ PAYMENTS : "records"
    USERS ||--o{ REFUNDS : "authorizes"
    USERS ||--o{ EXPENSES : "records"
    USERS ||--o{ ORDER_MODIFICATIONS : "authorizes"
    USERS ||--o{ ACTIVITY_LOGS : "generates"

    CUSTOMERS ||--o{ ENQUIRIES : "submits"
    CUSTOMERS ||--o{ ORDERS : "places"

    ENQUIRIES |o--o| ORDERS : "converts_to"

    PRODUCTS ||--o{ ORDER_ITEMS : "referenced_in"

    ORDERS ||--|{ ORDER_ITEMS : "contains"
    ORDERS ||--o{ PAYMENTS : "receives"
    ORDERS ||--o{ REFUNDS : "adjusts"
    ORDERS ||--o| FULFILLMENTS : "fulfilled_by"
    ORDERS ||--o{ ORDER_MODIFICATIONS : "audited_by"

    PAYMENTS ||--o{ REFUNDS : "source_of"

    EXPENSE_CATEGORIES ||--o{ EXPENSES : "classifies"

    USERS {
        bigint id PK
        string name
        string email UK
        string phone
        string password
        enum role
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    CUSTOMERS {
        bigint id PK
        string name
        string phone
        string instagram_handle
        string email
        enum source_channel
        text delivery_address
        string city
        string pincode
        text notes
        timestamp deleted_at
        timestamp created_at
        timestamp updated_at
    }

    ENQUIRIES {
        bigint id PK
        bigint customer_id FK
        enum channel
        string product_interest
        string budget_range
        enum status
        string lost_reason
        date follow_up_date
        text notes
        bigint converted_order_id FK
        timestamp created_at
        timestamp updated_at
    }

    PRODUCTS {
        bigint id PK
        string name
        enum category
        decimal base_price
        text description
        string image_url
        boolean is_active
        timestamp deleted_at
        timestamp created_at
        timestamp updated_at
    }

    ORDERS {
        bigint id PK
        string order_number UK
        bigint customer_id FK
        enum status
        enum payment_status
        decimal subtotal_amount
        decimal delivery_charge
        decimal discount_amount
        decimal total_amount
        decimal advance_amount_required
        decimal total_paid
        decimal balance_amount
        timestamp confirmed_at
        date target_delivery_date
        text internal_notes
        bigint created_by FK
        timestamp created_at
        timestamp updated_at
    }

    ORDER_ITEMS {
        bigint id PK
        bigint order_id FK
        bigint product_id FK
        string item_name
        enum item_type
        decimal unit_price
        int quantity
        decimal total_price
        text customization_details
        timestamp created_at
        timestamp updated_at
    }

    ORDER_MODIFICATIONS {
        bigint id PK
        bigint order_id FK
        bigint modified_by FK
        decimal previous_total
        decimal new_total
        text change_summary
        timestamp created_at
    }

    PAYMENTS {
        bigint id PK
        bigint order_id FK
        enum payment_type
        decimal amount
        enum payment_method
        string transaction_reference
        date payment_date
        enum status
        text notes
        bigint recorded_by FK
        timestamp created_at
        timestamp updated_at
    }

    REFUNDS {
        bigint id PK
        bigint order_id FK
        bigint payment_id FK
        decimal amount
        enum refund_method
        string transaction_reference
        string reason
        date refund_date
        enum status
        bigint processed_by FK
        timestamp created_at
        timestamp updated_at
    }

    FULFILLMENTS {
        bigint id PK
        bigint order_id FK
        enum delivery_type
        string courier_partner
        string tracking_number
        date shipped_date
        date estimated_delivery_date
        date delivered_date
        text delivery_notes
        enum status
        timestamp created_at
        timestamp updated_at
    }

    EXPENSE_CATEGORIES {
        bigint id PK
        string name UK
        string code UK
        string description
        timestamp created_at
        timestamp updated_at
    }

    EXPENSES {
        bigint id PK
        bigint category_id FK
        decimal amount
        date expense_date
        enum payment_method
        string vendor_name
        string bill_reference
        text description
        bigint recorded_by FK
        timestamp created_at
        timestamp updated_at
    }

    ACTIVITY_LOGS {
        bigint id PK
        bigint user_id FK
        string action
        string entity_type
        bigint entity_id
        text description
        json old_values
        json new_values
        string ip_address
        text user_agent
        timestamp created_at
    }
```

---

## 2. Cardinality & Relational Dictionary

### 2.1 Customer & Enquiry Relations
- **`CUSTOMERS` 1 : N `ENQUIRIES`**: A customer may initiate multiple enquiries over time (e.g., initial birthday inquiry, follow-up anniversary inquiry).
- **`ENQUIRIES` 0..1 : 0..1 `ORDERS`**: An enquiry may be dropped (`LOST`) or successfully converted into exactly one order (`converted_order_id`).

### 2.2 Customer & Order Relations
- **`CUSTOMERS` 1 : N `ORDERS`**: A customer may place multiple orders over their lifetime, fostering repeat business analytics and CRM value.

### 2.3 Order, Items & Modifications Relations
- **`ORDERS` 1 : 1..N `ORDER_ITEMS`**: Every order must contain at least one line item. An order can contain multiple items combining catalog products and bespoke custom artifacts.
- **`PRODUCTS` 0..1 : N `ORDER_ITEMS`**: Catalog products can be referenced in multiple order items. When a custom item is created from scratch, `product_id` is `NULL`.
- **`ORDERS` 1 : 0..N `ORDER_MODIFICATIONS`**: Whenever a confirmed order is amended (items changed, delivery added, prices updated), a change-log record is appended.

### 2.4 Financial Ledger Relations
- **`ORDERS` 1 : 0..N `PAYMENTS`**: An order can receive multiple payments (e.g., Advance payment first, Balance payment on dispatch/delivery).
- **`ORDERS` 1 : 0..N `REFUNDS`**: If an order is cancelled or modified downwards after payment, one or more refunds may be issued.
- **`PAYMENTS` 1 : 0..N `REFUNDS`**: A refund may optionally link directly back to the original incoming payment receipt.

### 2.5 Fulfillment Relations
- **`ORDERS` 1 : 0..1 `FULFILLMENTS`**: Every confirmed order has a single fulfillment tracking lifecycle (either courier consignment or local delivery).

### 2.6 Expense Relations
- **`EXPENSE_CATEGORIES` 1 : N `EXPENSES`**: Each expense record belongs to exactly one category (Raw Materials, Packaging, Courier, Marketing, Tools, Misc).
- **`USERS` 1 : N `EXPENSES`**: Audit trail of the user who paid and recorded the business expense.

### 2.7 Activity Log Relations
- **`USERS` 1 : 0..N `ACTIVITY_LOGS`**: Every log entry is linked to the operator who triggered the action. When a user is deleted, the log entry's `user_id` is set to `NULL` (preserving the immutable log record).
