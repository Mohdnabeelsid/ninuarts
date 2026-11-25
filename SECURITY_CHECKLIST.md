# Ninu Arts — Security Audit Checklist

Audit performed as part of Day 7 QA & Deployment Readiness.

---

## 1. Authentication & Session Management
- [x] **Bearer Token Auth (Sanctum):** All API routes under `/api/v1/*` (except `POST /api/v1/auth/login`) require `auth:sanctum`.
- [x] **Deactivated User Block:** `AuthController::login()` rejects deactivated users (`is_active = false`) with HTTP `403 ACCOUNT_DEACTIVATED`.
- [x] **Password Hashing:** All operator passwords stored via bcrypt (`Hash::check`).
- [x] **Token Revocation:** `POST /api/v1/auth/logout` deletes the current Sanctum personal access token.
- [x] **Dev Pre-fill Gated:** Hardcoded dev credentials and quick-fill buttons in `LoginPage.tsx` are strictly gated behind `import.meta.env.DEV` so production bundles expose blank login inputs.
- [x] **Login Rate Limiting:** `POST /api/v1/auth/login` enforces `throttle:15,1` in [`backend/routes/api.php`](file:///d:/ninuarts/backend/routes/api.php#L27-L29) to mitigate brute-force attempts.
- [x] **Frontend Role Route Guards:** [`App.tsx`](file:///d:/ninuarts/frontend/src/App.tsx) wraps owner-only views (`/dashboard`, `/expenses`, `/analytics`, `/activity-logs`, `/settings`) in `<OwnerRoute>` and redirects `STAFF` sessions cleanly to `/orders` while hiding Owner-only refund controls.
- [ ] **Production Credential Hygiene:** Seeded default development credentials (`nidha@ninuarts.com` / `staff@ninuarts.com`) **must** be rotated immediately in the production database via seeder/artisan tinker after initial setup.

## 2. Authorization & Role-Based Access Control (RBAC)
- [x] **Owner-Only Middleware (`role:OWNER`):** Enforced on:
  - `POST /api/v1/orders/{orderId}/refunds`
  - All `/expenses/*` endpoints (listing, categories, create, update, delete, receipt upload, and **private receipt download**)
  - All `/analytics/*` endpoints (dashboard & all 7 BI reports)
  - All `/activity-logs/*` endpoints
- [x] **Non-Technical Financial Guards:**
  - Orders cannot be confirmed with zero advance payment (`OrderService::updateStatus`).
  - Confirmed/paid orders cannot be permanently deleted (`OrderService::deleteOrder`).
  - Deliveries cannot be created for `DRAFT` or `CANCELLED` orders, and both `DeliveryController::syncOrderStatus` and legacy `FulfillmentController` enforce status guards and preserve status history.
  - Refunds cannot exceed net paid ceiling (`PaymentService::recordRefund`).

## 3. Input Validation & Concurrency Integrity
- [x] **Backend Validation:** Every controller validates payloads via Laravel `$request->validate(...)` returning structured `422 VALIDATION_FAILED` JSON errors.
- [x] **Phone Lookup Guard:** Normalized phone matching in `CustomerController` and `EnquiryController` enforces a minimum of 5 numeric digits to prevent empty `LIKE '%%'` wildcard matches.
- [x] **Atomic Transactions & Locking:** `OrderService` and `PaymentService` wrap order creation, modifications, payments, and refunds in `DB::transaction()` with `lockForUpdate()` to protect balances against concurrent requests.
- [x] **Duplicate Payment Guard:** Non-cash payments reject duplicate `transaction_reference` on the same order.

## 4. Secure File Uploads & Private Storage
- [x] **Strict File Type & Size Validation:**
  - Expense receipts: `mimes:jpeg,png,jpg,webp,pdf|max:5120` (5 MB limit).
  - Product images: `image|mimes:jpeg,png,jpg,webp|max:5120` (5 MB limit).
- [x] **Private Receipt Access (Fixed in Day 7 Audit):**
  - Expense receipts are stored on the private `local` disk (`storage/app/private/receipts/`), **not** the `public` disk.
  - Access is gated behind `GET /api/v1/expenses/receipts/{filename}` requiring `auth:sanctum` + `role:OWNER`.
  - Filename is validated via `basename()` + strict regex (`/^receipt_[0-9]+_[A-Za-z0-9]+\.(jpeg|jpg|png|webp|pdf)$/i`) and served with `X-Content-Type-Options: nosniff`.
- [x] **Customer Data Protection:** No customer photographs or private PII are exposed on unauthenticated URLs.

## 5. Environment, CORS & HTTP Security Headers
- [x] **Secrets Protection:** Root [`.gitignore`](file:///d:/ninuarts/.gitignore) excludes `.env`, `.env.*`, `*.sqlite`, `*.log`, `*.key`.
- [x] **Production Debug Disabled:** [`render.yaml`](file:///d:/ninuarts/backend/render.yaml) and deployment guide mandate `APP_ENV=production` and `APP_DEBUG=false`.
- [x] **CORS Config:** [`backend/config/cors.php`](file:///d:/ninuarts/backend/config/cors.php) supports explicit origin whitelisting via `CORS_ALLOWED_ORIGINS` env variable (`supports_credentials => false` for Bearer token auth).
- [x] **Security Headers:** [`frontend/vercel.json`](file:///d:/ninuarts/frontend/vercel.json) and [`backend/nginx.conf`](file:///d:/ninuarts/backend/nginx.conf) enforce `X-Content-Type-Options: nosniff`, `X-Frame-Options`, and `Referrer-Policy`.
- [x] **HTTPS:** Enforced automatically by Vercel/Render in Option A, and via Certbot Let's Encrypt in Option B.
