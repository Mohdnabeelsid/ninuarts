# Ninu Arts Business Manager — API Specification

**Document Version:** 1.0.0  
**Base URL:** `/api/v1`  
**Protocol:** HTTPS / JSON REST  
**Authentication:** Bearer Token via Laravel Sanctum (`Authorization: Bearer <token>`)  

---

## 1. Global Request & Response Conventions

### 1.1 Global Headers
- `Authorization: Bearer <token>` — Sanctum authentication token.
- `X-Active-Period: YYYY-MM` — *(Optional)* Global active month context header (e.g., `X-Active-Period: 2027-08`). When passed, all list endpoints (Orders, Enquiries, Expenses, Dashboard KPIs) scope their records to this specific calendar month by default.

### 1.2 Standard Success Envelope
```json
{
  "success": true,
  "message": "Resource retrieved successfully.",
  "data": {},
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 15,
    "total": 72
  }
}
```

### 1.3 Standard Error Envelope
```json
{
  "success": false,
  "message": "The given data was invalid.",
  "errors": {
    "phone": ["The phone number has already been taken."],
    "advance_amount_required": ["The advance amount cannot exceed total order amount."]
  }
}
```

---

## 2. Authentication Endpoints

### 2.1 Operator Login
- **Endpoint:** `POST /auth/login`
- **Access:** Public
- **Request Body:**
```json
{
  "email": "nidha@ninuarts.com",
  "password": "SecurePassword123"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Authentication successful.",
  "data": {
    "token": "1|raNDoMsAncTUmToKeN1234567890",
    "user": {
      "id": 1,
      "name": "Nidha",
      "email": "nidha@ninuarts.com",
      "role": "OWNER"
    }
  }
}
```

### 2.2 Operator Logout
- **Endpoint:** `POST /auth/logout`
- **Access:** Authenticated
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Session terminated successfully."
}
```

### 2.3 Current Authenticated Profile
- **Endpoint:** `GET /auth/me`
- **Access:** Authenticated
- **Response `200 OK`:** Returns current operator details and permissions array.

---

## 3. Customer CRM Endpoints

### 3.1 List Customers
- **Endpoint:** `GET /customers`
- **Query Params:** `search`, `channel`, `city`, `sort_by`, `page`, `per_page`
- **Response `200 OK`:** Paginated customer list with calculated fields (`total_orders_count`, `lifetime_spend`).

### 3.2 Create Customer
- **Endpoint:** `POST /customers`
- **Request Body:**
```json
{
  "name": "Ananya Menon",
  "phone": "+919876543210",
  "instagram_handle": "ananya_m",
  "email": "ananya@example.com",
  "source_channel": "INSTAGRAM",
  "delivery_address": "House #44, Beach Road, Alappuzha",
  "city": "Alappuzha",
  "pincode": "688001",
  "notes": "Prefers pastel gift packaging."
}
```

### 3.3 Get Customer Profile & Order History
- **Endpoint:** `GET /customers/{id}`
- **Response `200 OK`:** Returns customer details, complete enquiry history, and all past orders.

### 3.4 Update Customer Profile
- **Endpoint:** `PUT /customers/{id}`

### 3.5 Soft Delete (Deactivate) Customer
- **Endpoint:** `DELETE /customers/{id}`
- **Description:** Soft-deletes the customer record (sets `deleted_at`). Existing orders and enquiries are preserved; the customer no longer appears in active searches. Can be restored if needed via direct database or future admin interface.
- **Access:** Owner Only
- **Response `200 OK`:** `{ "success": true, "message": "Customer deactivated successfully." }`

---

## 4. Enquiry Management Endpoints

### 4.1 List Enquiries
- **Endpoint:** `GET /enquiries`
- **Query Params:** `status`, `channel`, `follow_up_due=true`, `search`, `page`

### 4.2 Create New Enquiry
- **Endpoint:** `POST /enquiries`
- **Request Body:**
```json
{
  "customer_id": 14,
  "channel": "WHATSAPP",
  "product_interest": "A4 Magazine Style Wedding Album (16 pages)",
  "budget_range": "2500 - 3500",
  "follow_up_date": "2026-11-22",
  "notes": "Wedding anniversary on Dec 1st. Wants delivery by Nov 28."
}
```

### 4.3 Update Enquiry Status
- **Endpoint:** `PATCH /enquiries/{id}/status`
- **Request Body:**
```json
{
  "status": "ESTIMATE_SENT",
  "lost_reason": null,
  "follow_up_date": "2026-11-25"
}
```

### 4.4 Convert Enquiry to Draft Order
- **Endpoint:** `POST /enquiries/{id}/convert`
- **Description:** Initializes a draft order pre-filled with customer and enquiry requirements.
- **Response `201 Created`:** Returns created `order` entity.

---

## 5. Product Master Catalogue Endpoints

### 5.1 List Products
- **Endpoint:** `GET /products`
- **Query Params:** `category`, `is_active`, `search`

### 5.2 Create Product
- **Endpoint:** `POST /products`
- **Request Body:**
```json
{
  "name": "12x18 Customized Wooden Acrylic Collage Frame",
  "category": "PHOTO_FRAME",
  "base_price": 1450.00,
  "description": "Premium teak finish frame with high-gloss acrylic front."
}
```

### 5.3 Update Product
- **Endpoint:** `PUT /products/{id}`

### 5.4 Deactivate / Soft Delete Product
- **Endpoint:** `DELETE /products/{id}`

---

## 6. Order Management Endpoints

### 6.1 List Orders
- **Endpoint:** `GET /orders`
- **Query Params:**
  - `status`: `DRAFT`, `PENDING_ADVANCE`, `CONFIRMED`, `IN_PROGRESS`, `READY_FOR_DELIVERY`, `DISPATCHED`, `DELIVERED`, `CANCELLED`
  - `payment_status`: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERPAID`
  - `date_from`, `date_to`: Creation date range
  - `search`: Searches order number, customer name, phone, or Instagram handle
  - `page`, `per_page`

### 6.2 Create Order (Draft or Pending Advance)
- **Endpoint:** `POST /orders`
- **Request Body:**
```json
{
  "customer_id": 14,
  "target_delivery_date": "2026-11-28",
  "delivery_charge": 120.00,
  "discount_amount": 100.00,
  "advance_amount_required": 1000.00,
  "internal_notes": "Urgent anniversary gift. Needs express courier.",
  "items": [
    {
      "product_id": 3,
      "item_name": "12x18 Customized Wooden Acrylic Collage Frame",
      "item_type": "CATALOG",
      "unit_price": 1450.00,
      "quantity": 1,
      "customization_details": "Photos received via WhatsApp. Include quote: 'Together is our favorite place to be'."
    },
    {
      "product_id": null,
      "item_name": "Mini Keepsake Box with 5 Mini Polaroids",
      "item_type": "CUSTOM",
      "unit_price": 450.00,
      "quantity": 1,
      "customization_details": "Handmade wooden box, red ribbon tie."
    }
  ]
}
```
- **Response `201 Created`:**
  - Automatically calculates:
    - `subtotal_amount` = ₹1,900.00
    - `total_amount` = $1900 + 120 - 100 = ₹1,920.00$
    - `balance_amount` = ₹1,920.00
    - `status` = `PENDING_ADVANCE`
    - `payment_status` = `UNPAID`

### 6.3 Get Order Details
- **Endpoint:** `GET /orders/{id}`
- **Response `200 OK`:** Full order object with nested `items`, `payments`, `refunds`, `fulfillment`, `modifications`, and `customer`.

### 6.4 Modify Confirmed Order (Amendment Workflow)
- **Endpoint:** `PUT /orders/{id}`
- **Description:** Allows modifying items, pricing, delivery charge, and discounts on an existing or confirmed order. Recalculates financial balance and appends to `order_modifications`.
- **Request Body:**
```json
{
  "target_delivery_date": "2026-11-29",
  "delivery_charge": 150.00,
  "discount_amount": 100.00,
  "modification_reason": "Customer added 1 additional mini frame and changed courier to express.",
  "items": [
    {
      "id": 101,
      "product_id": 3,
      "item_name": "12x18 Customized Wooden Acrylic Collage Frame",
      "item_type": "CATALOG",
      "unit_price": 1450.00,
      "quantity": 1,
      "customization_details": "Photos received. Script font."
    },
    {
      "id": null,
      "product_id": null,
      "item_name": "Mini Keepsake Box with 5 Mini Polaroids",
      "item_type": "CUSTOM",
      "unit_price": 450.00,
      "quantity": 2,
      "customization_details": "Updated to 2 boxes."
    }
  ]
}
```

### 6.5 Update Order Operational Status
- **Endpoint:** `PATCH /orders/{id}/status`
- **Request Body:**
```json
{
  "status": "IN_PROGRESS"
}
```

---

## 7. Financial Ledger: Payments & Refunds Endpoints

### 7.1 Record Payment (Advance or Balance)
- **Endpoint:** `POST /orders/{orderId}/payments`
- **Description:** Records an incoming payment installment. If order was `PENDING_ADVANCE`, this validates and transitions the order to `CONFIRMED`.
- **Note on Transaction Reference:** `transaction_reference` is optional across all payment modes (UPI, Bank Transfer, Cash) to accommodate customers who pay via UPI without sharing the UTR reference number.
- **Request Body:**
```json
{
  "payment_type": "ADVANCE",
  "amount": 1000.00,
  "payment_method": "UPI",
  "transaction_reference": "UPI/234901928374",
  "payment_date": "2026-11-19",
  "notes": "Advance paid via Google Pay."
}
```
- **Response `201 Created`:** Returns created payment record and updated order balance. If total paid exceeds total order amount, the order payment status becomes `OVERPAID`, balance is `0.00`, and the surplus is recognized in total revenue.

### 7.2 List Order Payments
- **Endpoint:** `GET /orders/{orderId}/payments`

### 7.3 Process Refund
- **Endpoint:** `POST /orders/{orderId}/refunds`
- **Access:** Owner Only
- **Request Body:**
```json
{
  "payment_id": 45,
  "amount": 500.00,
  "refund_method": "UPI",
  "transaction_reference": "UPI/REF9988223311",
  "reason": "Customer cancelled one add-on item prior to dispatch.",
  "refund_date": "2026-11-20"
}
```

---

## 8. Logistics & Fulfillment Endpoints

### 8.1 Create / Update Fulfillment Details
- **Endpoint:** `PUT /orders/{orderId}/fulfillment`
- **Request Body:**
```json
{
  "delivery_type": "COURIER",
  "courier_partner": "DTDC Express",
  "tracking_number": "D98716254",
  "shipped_date": "2026-11-24",
  "estimated_delivery_date": "2026-11-27",
  "delivery_notes": "Handle with care, acrylic glass package.",
  "status": "SHIPPED"
}
```

### 8.2 Update Delivery Status
- **Endpoint:** `PATCH /orders/{orderId}/fulfillment/status`
- **Request Body:**
```json
{
  "status": "DELIVERED",
  "delivered_date": "2026-11-27"
}
```

---

## 9. Operating Expense Endpoints

### 9.1 List Expenses
- **Endpoint:** `GET /expenses`
- **Query Params:** `category_id`, `date_from`, `date_to`, `payment_method`, `page`

### 9.2 Record Expense
- **Endpoint:** `POST /expenses`
- **Access:** Owner Only
- **Request Body:**
```json
{
  "category_id": 1,
  "amount": 3200.00,
  "expense_date": "2026-11-18",
  "payment_method": "UPI",
  "vendor_name": "Kochi Acrylic Supplies",
  "bill_reference": "INV-7721",
  "description": "5 sheets of 3mm cast acrylic sheets for frames."
}
```

### 9.3 Get Expense Categories
- **Endpoint:** `GET /expenses/categories`
- **Note:** This route is registered **before** the resource routes in `api.php` to prevent Laravel's route-model binding from treating the string `categories` as a numeric `{id}` parameter.

---

## 10. Business Analytics Endpoints

### 10.1 Executive Dashboard Metrics
- **Endpoint:** `GET /analytics/dashboard`
- **Access:** Owner Only
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "total_revenue_booked": 84500.00,
    "cash_collected": 72300.00,
    "outstanding_receivables": 12200.00,
    "total_expenses": 31400.00,
    "total_refunds": 1500.00,
    "net_business_profit": 39400.00,
    "active_orders_count": {
      "pending_advance": 3,
      "confirmed": 5,
      "in_progress": 8,
      "ready_for_delivery": 2,
      "dispatched": 4
    }
  }
}
```

### 10.2 Sales Trends & Channel Distribution
- **Endpoint:** `GET /analytics/sales-trend?interval=monthly&year=2026`
- **Endpoint:** `GET /analytics/channel-conversion`

---

## 11. Activity & Audit Logs Endpoints

### 11.1 List System Activity Logs
- **Endpoint:** `GET /activity-logs`
- **Access:** Owner Only
- **Query Params:**
  - `action`: Filter by action code (e.g. `ORDER_CREATED`, `ORDER_MODIFIED`, `PAYMENT_RECORDED`)
  - `entity_type`: Filter by entity (e.g. `Order`, `Payment`, `Customer`, `Expense`)
  - `entity_id`: Filter by specific record ID
  - `date_from`, `date_to`: Date range
  - `search`: Search description text
  - `page`, `per_page`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 142,
      "user": {
        "id": 1,
        "name": "Nidha"
      },
      "action": "ORDER_MODIFIED",
      "entity_type": "Order",
      "entity_id": 89,
      "description": "Amended order ORD-20261119-A1B2: Added 1x Mini Keepsake Box. Balance updated from ₹920.00 to ₹1,370.00.",
      "old_values": {
        "total_amount": "1920.00",
        "balance_amount": "920.00"
      },
      "new_values": {
        "total_amount": "2370.00",
        "balance_amount": "1370.00"
      },
      "ip_address": "49.37.12.98",
      "created_at": "2026-11-19T07:22:10.000000Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "total": 1
  }
}
```

### 11.2 Get Entity Audit Trail
- **Endpoint:** `GET /activity-logs/entity/{entityType}/{entityId}`
- **Access:** Authenticated
- **Description:** Returns the chronological log of all changes made to a specific order, customer, or payment.
