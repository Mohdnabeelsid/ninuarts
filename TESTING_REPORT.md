# Ninu Arts — Testing Report

**Date:** 2026-11-25  
**Backend Test Runner:** PHPUnit 11.5.58 (PHP 8.3.33, SQLite `:memory:` with `RefreshDatabase`)  
**Frontend Compiler & Bundler:** TypeScript `tsc -b` + Vite 5.4.21  

---

## 1. Automated Backend Test Suite Summary

**Result:** **47 / 47 tests passing (288 assertions, 0 failures, 0 errors, 0 skipped)**.

| Test Suite | Tests | Scope Verified |
|---|---|---|
| [`AuthenticationAndApiTest.php`](file:///d:/ninuarts/backend/tests/Feature/AuthenticationAndApiTest.php) | 8 | DB health, owner seeding, login token issue, 401 invalid credentials, `/auth/me`, token revocation on logout, 403 RBAC blocking Staff from Owner endpoints |
| [`CrmEnquiryAndProductTest.php`](file:///d:/ninuarts/backend/tests/Feature/CrmEnquiryAndProductTest.php) | 9 | Customer code generation, duplicate phone rejection, internal notes, CSV import preview & execution with deduplication, enquiry reuse, follow-ups, conversion linking, double-conversion prevention, product archive/restore |
| [`OrderAndPaymentManagementTest.php`](file:///d:/ninuarts/backend/tests/Feature/OrderAndPaymentManagementTest.php) | 12 | Single & multi-product orders, direct item costs, zero-advance confirmation rejection, advance auto-confirmation, partial/interim/final payments, null ref on cash, duplicate UTR rejection, refund balance recalculation, refund ceiling validation, modification history preservation, historical price preservation, confirmed order deletion protection |
| [`ExpensesDeliveryAndAnalyticsTest.php`](file:///d:/ninuarts/backend/tests/Feature/ExpensesDeliveryAndAnalyticsTest.php) | 10 | Expense standard & custom categories, editing/deletion, category filtering, delivery sync, overdue detection & dispatch template, accrual vs cash revenue with refunds, product profitability with incomplete-cost separation, closed enquiry conversion funnel, verified repeat customer retention, dashboard metrics |
| [`EndToEndBusinessWorkflowTest.php`](file:///d:/ninuarts/backend/tests/Feature/EndToEndBusinessWorkflowTest.php) | 1 | Complete **20-step sequential E2E business workflow** verifying every DB state, private receipt ACL (Owner 200 vs Staff 403), product image upload, dashboard P&L totals, product margins, and customer purchase history |
| [`AuditFixesRegressionTest.php`](file:///d:/ninuarts/backend/tests/Feature/AuditFixesRegressionTest.php) | 7 | `ON_HOLD` & `READY_FOR_DELIVERY` DB constraint checks, product creation via `category_id` & archived filter (`include_archived=1`), `/api/v1/products/images/{filename}` stream, nested enquiry payload & cost preservation on order edit, `X-Active-Period` & `ALL` scoping, legacy fulfillment `DRAFT` guard, duplicate category `422`, post-delivery receivables, `User::orders` relation, and `/auth/login` `throttle:15,1` rate limiting |

---

## 2. Database Migration Verification

Executed `php artisan migrate --force` and `php artisan migrate:status` against local SQLite ([`backend/database/database.sqlite`](file:///d:/ninuarts/backend/database/database.sqlite)):
- **13 / 13 migrations** ran cleanly (`Batch 1`–`Batch 5`), including Day 7 performance indexes ([`2026_01_05_000001_add_performance_indexes.php`](file:///d:/ninuarts/backend/database/migrations/2026_01_05_000001_add_performance_indexes.php)) and order status enum expansion ([`2026_01_06_000001_expand_orders_status_enum.php`](file:///d:/ninuarts/backend/database/migrations/2026_01_06_000001_expand_orders_status_enum.php)).

---

## 3. Financial Calculation Verification

Verified against database records across `OrderService`, `PaymentService`, and `AnalyticsController`:
- `Subtotal = Sum(quantity * unit_price)` (verified `3000 + 800 + 1200 = 5000.00`).
- `Total = Subtotal + Shipping - Discount` (verified `5000 + 150 - 150 = 5000.00`, modified `+200` to `5200.00`).
- `Outstanding Balance = max(0, Total - Net Paid)` (verified `5200 - 1500 = 3700 -> -1700 = 2000 -> -2000 = 0.00`).
- `Net Realized Cash = Gross Payments - Refunds` (verified `1000 - 200 = 800.00` in monthly revenue report).
- `Net Studio Profit = Net Realized Cash - Operating Expenses` (verified `6000 - 1000 = 5000.00` in E2E dashboard).
- `Product Gross Profit = Product Revenue - Recorded Direct Costs` (verified `6000 - 2000 = 4000.00`; missing-cost products flagged without inventing costs).

---

## 4. Frontend Build & Test Notes

- **TypeScript + Vite Production Build (`npm run build`):** Passes with 0 errors. Code-splitting (`React.lazy` + `manualChunks`) reduced the main app chunk from `948 kB` down to `~27 kB`.
- **Frontend Unit/E2E Browser Tests:** No Vitest or Playwright test runner is configured in `frontend/package.json`; UI verification was performed via TypeScript strict compilation (`tsc -b`), Vite production bundling, and manual browser inspection earlier in the project. Automated browser E2E testing was not executed on Day 7 because Chrome remote debugging was unavailable in this session.
