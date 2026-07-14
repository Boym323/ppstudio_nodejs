# Environment

Tento dokument shrnuje runtime prostředí projektu a nejdůležitější proměnné. Plný katalog proměnných zůstává v [docs/ENVIRONMENT.md](/var/www/ppstudio/docs/ENVIRONMENT.md).

## Runtime profil

- Node.js `24 LTS`
- npm `>=10`
- Next.js `16.2.10`
- React a React DOM `19.2.7`
- Prisma `7.8.0`
- PostgreSQL
- Debian LXC na Proxmoxu

## Klíčové proměnné

### Aplikace a origin

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SITE_DOMAIN`
- `VOUCHER_PUBLIC_DOMAIN`

Použití:

- absolutní URL v e-mailech
- admin redirecty
- SEO canonical/JSON-LD
- voucher PDF kontaktní doména
- ICS odkazy

### Databáze

- `DATABASE_URL`
- `SHADOW_DATABASE_URL`

Použití:

- Prisma runtime
- Prisma migrate dev

### Admin auth

- `ADMIN_SESSION_SECRET`
- `ADMIN_OWNER_EMAIL`

Použití:

- podpis admin session
- kontaktní fallback pro systémové e-maily; recovery probíhá offline příkazem `admin:recover-owner`
- HMAC odvození owner ICS feed tokenu

### Next.js Server Actions a release identita

- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- `NEXT_DEPLOYMENT_ID`
- `DEPLOYMENT_VERSION`
- `GIT_HASH`

Použití:

- stabilita Server Actions mezi releasy
- observability a health endpoint
- korektní deploy identita při `next start`

Poznámka:

- `NEXT_DEPLOYMENT_ID`, `DEPLOYMENT_VERSION` a `GIT_HASH` se při doporučeném deployi generují automaticky
- runtime je čte z `.release-env` konkrétního aktivního releasu v `/var/www/ppstudio/current`

### E-mail delivery

- `EMAIL_DELIVERY_MODE`
- `EMAIL_TRANSPORT`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `SMTP_REPLY_TO`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`

Použití:

- outbox worker
- zákaznické a admin e-maily
- webhook tracking z Resend

### Média

- `MEDIA_STORAGE_ROOT`

Použití:

- lokální storage pro `MediaAsset`
- optimized a thumbnail varianty

Výchozí fallback:

- `/var/www/ppstudio/uploads`

### Snapshot nastavení webu

- `SITE_SETTINGS_SNAPSHOT_PATH`

Použití:

- atomický lokální snapshot posledního správně načteného `SiteSettings`
- fallback veřejných kontaktů a podmínek při výpadku databáze

Výchozí cesta je `/var/www/ppstudio/site-settings-snapshot.json`. Musí zůstat mimo adresář konkrétního releasu a být zapisovatelná pro runtime uživatele. Při použití snapshotu se loguje provozní alert a nové veřejné rezervace se do obnovení aktuálních pravidel nepřijímají.

### Analytika

Klientské:

- `NEXT_PUBLIC_MATOMO_ENABLED`
- `NEXT_PUBLIC_MATOMO_URL`
- `NEXT_PUBLIC_MATOMO_SITE_ID`
- `NEXT_PUBLIC_CLARITY_ENABLED`
- `NEXT_PUBLIC_CLARITY_PROJECT_ID`
- `NEXT_PUBLIC_META_PIXEL_ENABLED`
- `NEXT_PUBLIC_META_PIXEL_ID`
- `NEXT_PUBLIC_GOOGLE_ADS_ENABLED`
- `NEXT_PUBLIC_GOOGLE_ADS_ID`
- `NEXT_PUBLIC_WEB_VITALS_ENABLED`

Serverové:

- `MATOMO_URL`
- `MATOMO_SITE_ID`
- `MATOMO_AUTH_TOKEN`

### Notifikace

- `PUSHOVER_ENABLED`
- `PUSHOVER_APP_TOKEN`

Per-user klíče ownerů nejsou v env, ale v databázi `UserNotificationSettings`.

## Vazba na databázi a doménu

Environment přímo ovlivňuje:

- admin přihlášení
- booking linky v e-mailech
- owner ICS feed
- klientský ICS event
- worker doručování
- analytics měření
- health a deployment diagnostiku

Neovlivňuje přímo obsah katalogu nebo booking pravidla v DB, protože ta jsou uložená v:

- `SiteSettings`
- `Service`
- `ServiceCategory`
- `AvailabilitySlot`

## Produkční zásady

- nikdy necommitovat produkční `.env`
- držet stabilní `ADMIN_SESSION_SECRET`
- držet stabilní `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- nechat release identitu generovat deploy skriptem
- držet `MEDIA_STORAGE_ROOT` mimo git checkout

## Související dokumenty

- [ARCHITECTURE.md](/var/www/ppstudio/ARCHITECTURE.md)
- [DEPLOYMENT.md](/var/www/ppstudio/DEPLOYMENT.md)
- [docs/ENVIRONMENT.md](/var/www/ppstudio/docs/ENVIRONMENT.md)
