# Ninu Arts Business Manager

A full-stack business operations, CRM, order & payment ledger, logistics, expense tracking, and analytics platform built specifically for **Ninu Arts** (personalized gifting studio, Alappuzha, Kerala).

Designed with a **Soft Editorial × Premium Boutique × Modern SaaS** visual system (`#F7F4F0` Warm Ivory, `#34312F` Charcoal, `#E8D8D4` Dusty Rose, `#8B9B86` Sage, `DM Serif Display` + `DM Sans`).

---

## Core Modules

1. **Authentication & RBAC:** Laravel Sanctum Bearer token authentication with `OWNER` (full financial, expense, refund, analytics & audit access) and `STAFF` (CRM, enquiries, orders, payments, deliveries) roles.
2. **Executive Dashboard:** Real-time booked revenue, net realized cash, operating outflows, net profit, outstanding receivables, revenue trend chart, overdue shipment alerts, and recent orders/enquiries.
3. **Customers CRM:** Client directory with automatic unique customer codes (`CUST-XXXXX`), normalized phone duplicate detection, internal notes timeline, CSV import preview & commit, and right-side detail drawer.
4. **Enquiries & Lead Pipeline:** Instagram, WhatsApp, Call, and Other lead capture, scheduled follow-ups, lost-reason tracking, and double-conversion-protected lead-to-order conversion.
5. **Products Catalogue:** Standard base offerings (`PHOTO_FRAME`, `MAGAZINE_ALBUM`, `GIFT_HAMPER`, `CUSTOM_GIFT`), category management, soft-archive/restore, and image uploads.
6. **Orders & Payment Ledger:** Multi-product and custom orders, shipping & discounts, variable advance enforcement on confirmation, atomic `DB::transaction` + `lockForUpdate` payment recording (`UPI`, `BANK_TRANSFER`, `CASH`), duplicate UTR prevention, owner-only refunds capped at net paid, and immutable modification & status history.
7. **Expenses Ledger:** Categorized studio outflows (`Materials`, `Printing`, `Packaging`, `Courier`, `Marketing`, `Transportation`, `Software`, `Other` + custom categories), private authenticated receipt storage, date/method/category filters, and monthly summaries.
8. **Deliveries & Logistics:** Courier & local Alappuzha handovers, AWB tracking, overdue delivery detection, order status sync with audit trail, and one-click manual WhatsApp/Instagram dispatch message templates.
9. **Business Analytics (7 Reports):** Monthly Revenue vs Cash, Product Profitability (flagging incomplete cost items without inventing costs), Order Lifecycle Performance, Enquiry Conversion Funnel, Customer Retention & Repeat Purchase Rate, Expense Breakdown, and Delayed Orders.
10. **Activity Audit Trail & Settings:** Immutable database audit log viewer and global active working month scope (`X-Active-Period`).

---

## Technology Stack

- **Backend:** PHP 8.3, Laravel 11, Laravel Sanctum, SQLite (local) / MySQL / PostgreSQL
- **Frontend:** React 18, TypeScript, Vite 5, Tailwind CSS, TanStack Query, React Router v6, Recharts, Lucide React
- **Testing:** PHPUnit 11 Feature Tests against SQLite `:memory:`

---

## Quick Local Setup

### Prerequisites
- PHP >= 8.2 with `pdo_sqlite`, `mbstring`, `openssl`, `bcmath`
- Composer
- Node.js >= 18 & npm

### 1. Backend
```powershell
cd D:\ninuarts\backend
composer install
copy .env.example .env
# In .env, set DB_CONNECTION=sqlite and DB_DATABASE=database/database.sqlite (or MySQL/PostgreSQL)
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force
php artisan serve --host=127.0.0.1 --port=8000
```

### 2. Frontend
```powershell
cd D:\ninuarts\frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.
Or run [`start-dev.bat`](file:///d:/ninuarts/start-dev.bat) to start both servers.

### Default Seeded Operator Accounts (Local Development)
- **Owner:** `nidha@ninuarts.com` / `Password@123`
- **Staff:** `staff@ninuarts.com` / `Password@123`

> **Production Warning:** Change all seeded passwords immediately after deploying to production.

---

## Documentation Index

- [Deployment Guide](file:///d:/ninuarts/DEPLOYMENT_GUIDE.md) — Production setup (Render + Vercel + Supabase/Neon & Ubuntu VPS/MySQL)
- [User Guide](file:///d:/ninuarts/USER_GUIDE.md) — Step-by-step operator manual for studio daily workflow
- [Testing Report](file:///d:/ninuarts/TESTING_REPORT.md) — Backend PHPUnit & frontend build verification results
- [Security Checklist](file:///d:/ninuarts/SECURITY_CHECKLIST.md) — Authentication, RBAC, storage, and environment audit
- [Final Project Report](file:///d:/ninuarts/FINAL_PROJECT_REPORT.md) — Executive summary, limitations, and next recommendations
- [API Documentation](file:///d:/ninuarts/docs/API_DOCUMENTATION.md) & [KPI Definitions](file:///d:/ninuarts/docs/KPI_DEFINITIONS.md)
