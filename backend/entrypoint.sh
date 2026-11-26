#!/bin/sh
set -e

echo "Ensuring storage and cache directories..."
mkdir -p bootstrap/cache storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/app/private/receipts storage/app/public
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

LISTEN_PORT="${PORT:-80}"
echo "Configuring Nginx to listen on port ${LISTEN_PORT}..."
sed -i "s/listen [0-9]\+;/listen ${LISTEN_PORT};/" /etc/nginx/http.d/default.conf

echo "Running database migrations..."
php artisan migrate --force

echo "Ensuring storage symlink for public product assets..."
php artisan storage:link || true

echo "Caching configuration and routes..."
php artisan config:cache
php artisan route:cache

echo "Ensuring runtime permissions for www-data..."
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

echo "Starting PHP-FPM daemon..."
php-fpm -D

echo "Starting Nginx on port ${LISTEN_PORT}..."
nginx -g "daemon off;"
