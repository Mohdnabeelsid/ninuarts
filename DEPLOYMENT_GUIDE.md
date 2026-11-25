# Ninu Arts — Production Deployment Guide

This guide covers two production deployment architectures:
- **Option A (Free Cloud Tier):** Vercel (React SPA) + Render.com (Docker PHP 8.3 API) + Supabase / Neon (Managed PostgreSQL)
- **Option B (Single Ubuntu VPS + MySQL):** DigitalOcean / Hetzner / AWS EC2 with Nginx, PHP 8.3-FPM, MySQL 8, and Let's Encrypt SSL

> **Important:** Do **not** deploy local SQLite onto ephemeral free PaaS containers (such as Render free tier) because container restarts wipe local disk files. Use managed PostgreSQL/MySQL on PaaS, or a persistent SSD disk on a VPS.

---

## 1. Pre-Deployment Preparation

1. **Ensure secrets are never committed:**
   Verify [`.gitignore`](file:///d:/ninuarts/.gitignore) ignores `.env`, `backend/database/*.sqlite`, `*.log`, `backend/vendor/`, and `frontend/node_modules/`.
2. **Verify frontend production build locally:**
   ```powershell
   cd D:\ninuarts\frontend
   npm run build
   ```
   Output is generated in `frontend/dist/`.
3. **Verify backend configuration files exist:**
   - [`backend/Dockerfile`](file:///d:/ninuarts/backend/Dockerfile)
   - [`backend/nginx.conf`](file:///d:/ninuarts/backend/nginx.conf)
   - [`backend/entrypoint.sh`](file:///d:/ninuarts/backend/entrypoint.sh)
   - [`backend/render.yaml`](file:///d:/ninuarts/backend/render.yaml)
   - [`backend/config/cors.php`](file:///d:/ninuarts/backend/config/cors.php)
   - [`frontend/vercel.json`](file:///d:/ninuarts/frontend/vercel.json)

---

## 2. Option A: Free Cloud Deployment (Vercel + Render + Supabase/Neon)

### Step 1: Provision Managed PostgreSQL (Supabase or Neon)
1. Create a free project on **Neon** or **Supabase** (Singapore or Mumbai region for lowest latency to Kerala).
2. Copy the PostgreSQL connection URI:
   `postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require`

### Step 2: Deploy Laravel Backend on Render.com
1. Push the repository to GitHub (confirm `.env` and `database.sqlite` are excluded).
2. On **Render.com**, click **New → Web Service**, connect your repo, and set **Root Directory** to `backend`.
3. Choose **Runtime: Docker** (uses [`backend/Dockerfile`](file:///d:/ninuarts/backend/Dockerfile)) and **Instance Type: Free**.
4. Configure Environment Variables on Render:
   | Variable | Value |
   |---|---|
   | `APP_NAME` | `Ninu Arts Business Manager` |
   | `APP_ENV` | `production` |
   | `APP_DEBUG` | `false` |
   | `APP_TIMEZONE` | `Asia/Kolkata` |
   | `APP_KEY` | Generate via `php artisan key:generate --show` |
   | `APP_URL` | `https://your-render-service.onrender.com` |
   | `DB_CONNECTION` | `pgsql` |
   | `DB_URL` | Your Supabase / Neon connection URI |
   | `CORS_ALLOWED_ORIGINS` | `https://your-vercel-app.vercel.app` |
   | `LOG_CHANNEL` | `stderr` |
5. Deploy. [`entrypoint.sh`](file:///d:/ninuarts/backend/entrypoint.sh) automatically runs `php artisan migrate --force`, caches config/routes, and starts PHP-FPM + Nginx.
6. After first boot, seed initial roles and owner user once via Render Shell (or temporary seed), then immediately reset the owner password.

### Step 3: Deploy React Frontend on Vercel
1. On **Vercel**, click **Add New → Project** and select your GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Framework Preset: **Vite** (`npm run build`, output directory `dist`).
4. Add Environment Variable:
   - `VITE_API_URL` = `https://your-render-service.onrender.com/api/v1`
5. Deploy. [`frontend/vercel.json`](file:///d:/ninuarts/frontend/vercel.json) handles SPA route rewrites and security headers.
6. Copy your live Vercel URL back into Render's `CORS_ALLOWED_ORIGINS`.

> **Note on Render Free Tier:** Free Render services sleep after 15 minutes of inactivity; the first request after sleep takes ~25–40 seconds to wake up. Ephemeral local disk storage on Render Free also clears uploaded local files on redeploy — for persistent production receipt/image uploads on PaaS, attach a paid Render Disk or configure an S3/R2 filesystem disk.

---

## 3. Option B: Production VPS + MySQL Setup (Ubuntu 24.04 LTS)

### Step 1: Install Runtime & MySQL
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx mysql-server php8.3-fpm php8.3-mysql php8.3-curl php8.3-mbstring php8.3-xml php8.3-zip php8.3-bcmath php8.3-intl composer git certbot python3-certbot-nginx
```

### Step 2: Create MySQL Database & User
```sql
sudo mysql
CREATE DATABASE ninu_arts_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ninu_arts_user'@'localhost' IDENTIFIED BY 'STRONG_RANDOM_PASSWORD';
GRANT ALL PRIVILEGES ON ninu_arts_db.* TO 'ninu_arts_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Step 3: Configure Laravel Backend
```bash
cd /var/www/ninuarts/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```
Update `/var/www/ninuarts/backend/.env`:
```env
APP_ENV=production
APP_DEBUG=false
APP_TIMEZONE=Asia/Kolkata
APP_URL=https://manage.ninuarts.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=ninu_arts_db
DB_USERNAME=ninu_arts_user
DB_PASSWORD=STRONG_RANDOM_PASSWORD

CORS_ALLOWED_ORIGINS=https://manage.ninuarts.com
LOG_CHANNEL=daily
LOG_LEVEL=warning
```
Run migrations, storage permissions, and caches:
```bash
php artisan migrate --force
php artisan db:seed --force
php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan view:cache
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache
```

### Step 4: Build Frontend & Configure Nginx + HTTPS
```bash
cd /var/www/ninuarts/frontend
echo "VITE_API_URL=https://manage.ninuarts.com/api/v1" > .env.production
npm ci
npm run build
```
Nginx site config (`/etc/nginx/sites-available/ninuarts`):
```nginx
server {
    listen 80;
    server_name manage.ninuarts.com;
    root /var/www/ninuarts/frontend/dist;
    index index.html;

    client_max_body_size 10M;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        root /var/www/ninuarts/backend/public;
        try_files $uri $uri/ /index.php?$query_string;

        location ~ \.php$ {
            include snippets/fastcgi-php.conf;
            fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        }
    }

    # Public product images only; private expense receipts are served exclusively via /api/v1/expenses/receipts/{filename}
    location /storage {
        alias /var/www/ninuarts/backend/storage/app/public;
        add_header X-Content-Type-Options "nosniff";
    }
}
```
Enable site & SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/ninuarts /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d manage.ninuarts.com
```

---

## 4. Backup & Error Logging Procedure

### Automated Daily Backup (VPS)
Add to `crontab -e` (runs daily at 02:00 AM IST):
```cron
0 2 * * * mysqldump -u ninu_arts_user -p'STRONG_RANDOM_PASSWORD' ninu_arts_db | gzip > /var/backups/ninuarts_db_$(date +\%F).sql.gz
0 2 * * * tar -czf /var/backups/ninuarts_private_receipts_$(date +\%F).tar.gz /var/www/ninuarts/backend/storage/app/private/
0 3 * * * find /var/backups/ -type f -mtime +30 -delete
```
If using local SQLite: back up `backend/database/database.sqlite` and `backend/storage/app/private/` daily to encrypted cloud storage (Google Drive / Backblaze B2).

### Error Logging & Monitoring
- Laravel logs daily errors to `backend/storage/logs/laravel-YYYY-MM-DD.log` (`LOG_CHANNEL=daily`, `LOG_LEVEL=warning` in production).
- On Render, set `LOG_CHANNEL=stderr` to inspect real-time logs in the Render Dashboard.
- Health check endpoint: `GET /up` returns HTTP 200 when the framework is healthy.
