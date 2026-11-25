# Ninu Arts Business Manager — API Documentation (v1)

Base URL: `http://localhost:8000/api/v1`  
Authentication: Bearer Token (`Sanctum`)  
Global Header: `X-Active-Period: YYYY-MM` (Optional active fiscal month scope)

---

## 1. Authentication

### `POST /auth/login`
- **Access:** Public
- **Body:** `{ "email": "nidha@ninuarts.com", "password": "Password@123" }`
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Authentication successful.",
    "data": {
      "user": { "id": 1, "name": "Nidha Proprietor", "email": "nidha@ninuarts.com", "role": "OWNER" },
      "token": "1|token-string"
    }
  }
  ```

### `POST /auth/logout`
- **Access:** Authenticated
- **Response:** `200 OK`

### `GET /auth/me`
- **Access:** Authenticated
- **Response:** Current authenticated operator profile.

---

## 2. Operating Expenses (`/expenses`)

### `GET /expenses`
- **Access:** Owner only
- **Query Params:**
  - `category_code`: e.g. `MATERIALS`, `PRINTING`, `COURIER`, `MARKETING`, `OTHER`
  - `payment_method`: `UPI`, `BANK_TRANSFER`, `CASH`
  - `from_date`, `to_date`: `YYYY-MM-DD`
  - `search`: string (vendor, description, bill reference, notes)
  - `per_page`: integer (default 25)
- **Response:** Paginated expenses list with `meta.summary` (total amount, expense count, category breakdown).

### `GET /expenses/{id}`
- **Access:** Owner only
- **Response:** Single expense details with recorder information and immutable `activity_logs` audit trail.

### `POST /expenses`
- **Access:** Owner only
- **Body:**
  - `category_id`: integer (nullable if custom_category provided)
  - `custom_category`: string (optional, auto-creates category if new)
  - `amount`: numeric (> 0.50)
  - `expense_date`: `YYYY-MM-DD`
  - `payment_method`: `UPI` | `BANK_TRANSFER` | `CASH`
  - `vendor_name`: string (optional)
  - `bill_reference`: string (optional)
  - `description`: string (required)
  - `attachment_path`: string (optional receipt URL/storage path)
  - `notes`: string (optional)
- **Response:** `201 Created`

### `PUT /expenses/{id}`
- **Access:** Owner only
- **Body:** Same editable fields as `POST /expenses`.
- **Response:** `200 OK` with updated record and `EXPENSE_UPDATED` audit log.

### `DELETE /expenses/{id}`
- **Access:** Owner only
- **Response:** `200 OK` with `EXPENSE_DELETED` audit log.

### `GET /expenses/categories`
- **Access:** Owner only
- **Response:** List of all active expense categories with associated expense counts.

### `POST /expense-categories`
- **Access:** Owner only
- **Body:** `{ "name": "Custom Category Name", "description": "Optional notes" }`
- **Response:** `201 Created`

### `POST /expenses/upload-receipt`
- **Access:** Owner only
- **Body:** `multipart/form-data` with `receipt` file (max: 5MB, mimes: jpeg, png, jpg, webp, pdf)
- **Response:** `{ "path": "/storage/receipts/filename.jpg", "file_name": "filename.jpg" }`

---

## 3. Delivery & Fulfillment Logistics (`/deliveries`)

### `GET /deliveries`
- **Access:** Staff & Owner
- **Query Params:**
  - `status`: `PENDING`, `READY_FOR_DISPATCH`, `DISPATCHED`, `IN_TRANSIT`, `DELIVERED`, `DELIVERY_FAILED`, `RETURNED`
  - `delivery_type`: `COURIER`, `LOCAL_DELIVERY`
  - `is_overdue`: `true` | `false`
  - `search`: string (tracking number, courier partner, recipient, phone, order number)
  - `from_date`, `to_date`: `YYYY-MM-DD`
- **Response:** Paginated deliveries list with computed `is_overdue` and `days_overdue` flags, and status counts summary.

### `GET /deliveries/{id}`
- **Access:** Staff & Owner
- **Response:** Full shipment details with order items, recipient details, and audit history.

### `POST /deliveries`
- **Access:** Staff & Owner
- **Body:**
  - `order_id`: integer (required)
  - `delivery_type`: `COURIER` | `LOCAL_DELIVERY`
  - `recipient_name`: string (auto-fills from Customer if null)
  - `recipient_phone`: string (auto-fills from Customer if null)
  - `delivery_address`: text (auto-fills from Customer if null)
  - `courier_partner`: string (e.g. `DTDC`, `Delhivery`, `Speed Post`)
  - `tracking_number`: string (AWB)
  - `shipping_charge`: decimal
  - `dispatch_date`: date
  - `estimated_delivery_date`: date
  - `delivery_notes`: text
  - `status`: `READY_FOR_DISPATCH` | `DISPATCHED` | `IN_TRANSIT` | `DELIVERED` | `DELIVERY_FAILED` | `RETURNED`
- **Behavior:** Auto-synchronizes the linked Order's lifecycle status (e.g. marking shipment as `DISPATCHED` updates Order to `DISPATCHED`; `DELIVERED` updates Order to `DELIVERED`).

### `PUT /deliveries/{id}`
- **Access:** Staff & Owner
- **Body:** Editable shipment parameters.
- **Response:** `200 OK`

### `PATCH /deliveries/{id}/status`
- **Access:** Staff & Owner
- **Body:**
  - `status`: `READY_FOR_DISPATCH` | `DISPATCHED` | `IN_TRANSIT` | `DELIVERED` | `DELIVERY_FAILED` | `RETURNED`
  - `actual_delivery_date`: date (defaults to now if `DELIVERED`)
  - `delay_reason`: string (optional, recommended for overdue items)
  - `notes`: string (optional)
- **Response:** `200 OK`

### `GET /deliveries/overdue`
- **Access:** Staff & Owner
- **Response:** List of all shipments whose `estimated_delivery_date` has passed and status is neither `DELIVERED` nor `RETURNED`, including calculated `days_overdue`.

### `POST /deliveries/{id}/dispatch-template`
- **Access:** Staff & Owner
- **Response:** Ready-to-copy personalized customer update text formatted for WhatsApp / Instagram DM.

---

## 4. Business Analytics & Financial Reports (`/analytics`)

### `GET /analytics/dashboard`
- **Access:** Owner only
- **Response:** Real-time summary of gross booked revenue, cash collected, total expenses, net business profit, active order statuses, total customers, overdue delivery count, recent orders, and recent enquiries.

### `GET /analytics/monthly-revenue?months=6`
- **Access:** Owner only
- **Report 1:** Compares monthly recognized revenue (Accrual basis) against cash collections (Cash basis: payments minus refunds). Returns detailed accounting documentation.

### `GET /analytics/product-performance`
- **Access:** Owner only
- **Report 2:** Units sold, order counts, product revenue, recorded direct costs, gross profit, and gross margin % for both catalog and custom gifts. Flagged products with missing costs are surfaced in `incomplete_cost_products`.

### `GET /analytics/order-performance`
- **Access:** Owner only
- **Report 3:** Total orders, completed orders, pending orders, cancelled orders, delayed orders, completion rate %, status value breakdown, and monthly order volume trend.

### `GET /analytics/enquiry-conversion`
- **Access:** Owner only
- **Report 4:** Lead conversion funnel, closed conversion rate (excluding open enquiries from denominator), overall cohort rate, Instagram vs WhatsApp performance, and lost reasons breakdown.

### `GET /analytics/customer-analytics`
- **Access:** Owner only
- **Report 5:** Total registered customers, verified purchasing customers (excluding unverified CSV records), returning customers (2+ orders), repeat purchase rate %, and top 10 customers by lifetime spend.

### `GET /analytics/expense-analytics?months=6`
- **Access:** Owner only
- **Report 6:** Total operating outflows, category cost breakdown (amounts & percentages), payment method distribution, and monthly outflow trend.

### `GET /analytics/delayed-orders`
- **Access:** Owner only
- **Report 7:** List of overdue orders with client phone, expected delivery date, days overdue, and recorded delay reasons.
