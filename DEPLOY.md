# Production deployment

## Environment

Copy `.env.example` to `.env` and set production values before deploying.

Required keys:

- `APP_KEY` — generate with `php artisan key:generate`
- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL` — your public site URL (HTTPS recommended)
- `DB_CONNECTION=mysql`
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`

`APP_DEBUG` must be `false` in production. Never deploy with debug mode enabled.

## Deploy steps

From the project root on the server:

```bash
composer install --no-dev --optimize-autoloader
npm ci
npm run build
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link
```

Restart your PHP application server / queue workers after deployment so cached config and routes are picked up.

## PWA

The frontend build generates a web app manifest and service worker under `public/build/`. The service worker precaches built static assets only; API routes are not cached offline.

After each deploy, run `npm run build` so the service worker and asset precache list stay in sync with the latest frontend bundle.
