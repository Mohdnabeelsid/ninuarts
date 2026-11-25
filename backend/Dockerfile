FROM php:8.3-fpm-alpine

# Install system dependencies & Nginx
RUN apk add --no-cache \
    nginx \
    curl \
    git \
    unzip \
    postgresql-dev \
    libzip-dev \
    icu-dev \
    oniguruma-dev

# Install PHP extensions for PostgreSQL, MySQL, Zip, Intl, Bcmath, OPcache
RUN docker-php-ext-install \
    pdo_pgsql \
    pdo_mysql \
    zip \
    intl \
    bcmath \
    mbstring \
    opcache

# Composer binary
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

COPY . .

RUN composer install --no-dev --optimize-autoloader --no-interaction

COPY nginx.conf /etc/nginx/http.d/default.conf

RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs storage/app/private/receipts storage/app/public \
    && chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache \
    && chmod -R 775 /var/www/storage /var/www/bootstrap/cache \
    && chmod +x entrypoint.sh

EXPOSE 80

CMD ["./entrypoint.sh"]
