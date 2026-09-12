#!/usr/bin/env bash
set -e  # stop on first error

# NOTE: update this path if you change the server's Node version via nvm
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"

echo "==> composer install"
composer install --no-dev --optimize-autoloader

# remove recurring skeleton leftovers so the build can't trip on them
rm -f vite.config.js resources/js/bootstrap.js config/sanctum.php

# only run npm ci if package-lock.json changed since last deploy
LOCK_HASH=$(sha1sum package-lock.json | awk '{print $1}')
STORED_HASH=$(cat storage/.npm-lock-hash 2>/dev/null || echo "none")
if [ "$LOCK_HASH" != "$STORED_HASH" ]; then
  echo "==> package-lock changed -> npm ci"
  npm ci
  echo "$LOCK_HASH" > storage/.npm-lock-hash
else
  echo "==> package-lock unchanged -> skipping npm ci"
fi

echo "==> npm run build"
npm run build

echo "==> migrate + cache"
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan optimize:clear

echo "==> DONE"
