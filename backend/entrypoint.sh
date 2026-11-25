#!/bin/sh
set -e

echo "Ensuring storage and cache directories..."
mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs storage/app/private/receipts storage/app/public
chmod -R 775 storage bootstrap/cache

echo "Running database migrations..."
php artisan migrate --force

echo "Ensuring storage symlink for public product assets..."
php artisan storage:link || true

echo "Caching configuration and routes..."
php artisan config:cache
php artisan route:cache

echo "Starting PHP-FPM daemon..."
php-fpm -D

echo "Starting Nginx on port 80..."
nginx -g "daemon off;"
