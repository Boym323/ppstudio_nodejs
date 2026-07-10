# Troubleshooting

Tento dokument shrnuje nejčastější provozní potíže kolem databáze, workeru, ICS, analytiky a deploye.

## Web nenaběhne po deployi

Zkontroluj:

- `systemctl status ppstudio-web`
- `journalctl -u ppstudio-web -n 200`
- `node -v`
- platnost `.env`
- platnost `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`

Typické příčiny:

- chybějící nebo neplatné env proměnné
- build proběhl na jiné verzi Node
- nevalidní Prisma klient nebo migrace

Release helper po restartu nejdřív tiše čeká na otevření endpointu; samotný očekávaný start Next.js proto není incident. Pokud vyčerpá readiness pokusy, skript provede rollback. Podle výpisu pak rozliš `Health endpoint ...` od `Homepage smoke test ...` a teprve následně kontroluj odpověď endpointu a journal.

## Worker neposílá e-maily

Zkontroluj:

- `systemctl status ppstudio-email-worker`
- `journalctl -u ppstudio-email-worker -n 200`
- `EMAIL_DELIVERY_MODE`
- `EMAIL_TRANSPORT`
- SMTP nebo Resend credentials

V databázi hledej:

- `EmailLog.status = PENDING`
- staré `nextAttemptAt`
- `FAILED` záznamy s `errorMessage`

Typické příčiny:

- worker neběží
- špatné SMTP/Resend údaje
- zablokovaný provider
- chybějící `RESEND_WEBHOOK_SECRET` při očekávání trackingu

## Remindery 24h neodcházejí

Reminder scan běží uvnitř workeru, ne v cron jobu.

Zkontroluj:

- že opravdu běží `ppstudio-email-worker`
- že booking není už označený `reminder24hSentAt`
- že booking je ve stavu, který reminder dovoluje

## Owner ICS feed vrací 404

Route:

- `/api/calendar/owner.ics?token=...`

Zkontroluj:

- zda `CalendarFeed.isActive=true`
- zda po rotaci nepoužíváš starý odkaz
- zda se nezměnil `ADMIN_SESSION_SECRET`

Pozor:

- změna `ADMIN_SESSION_SECRET` změní i HMAC validaci owner feed tokenu

## Klientská ICS příloha chybí nebo nejde otevřít

Zkontroluj render šablony `booking-approved-v1` nebo `booking-rescheduled-v1`, email worker a iCalendar obsah přílohy. Veřejný zákaznický ICS odkaz ani token typu `CALENDAR` se nepoužívají.

## Matomo dashboard ukazuje nuly

Rozliš:

- reálné nuly
- reporting chybu

Zkontroluj:

- `MATOMO_URL`
- `MATOMO_SITE_ID`
- `MATOMO_AUTH_TOKEN`
- `npm run analytics:check`
- response `/api/admin/analytics`

Typické příčiny:

- chybějící serverové `MATOMO_*`
- neplatný reporting token
- dočasný výpadek Matomo API

## Matomo se nenačítá na veřejném webu

Zkontroluj:

- `NEXT_PUBLIC_MATOMO_ENABLED=true`
- `NEXT_PUBLIC_MATOMO_URL`
- `NEXT_PUBLIC_MATOMO_SITE_ID`
- jestli není přítomná admin session cookie

Pozor:

- admin session schválně vypíná tracking i na veřejných stránkách
- tokenové booking route neposílají pageview záměrně

## UTM se neukládá do bookingu

Zkontroluj:

- zda landing URL nese `utm_*` nebo `mtm_*`
- zda request přišel z externího referreru nebo s parametry
- zda prohlížeč neblokuje cookie

Zdroj:

- booking acquisition cookie `ppstudio-booking-acq`

## Admin login vrací `origin_check_failed`

Zkontroluj:

- `NEXT_PUBLIC_APP_URL`
- reverzní proxy `Host` a `X-Forwarded-Host`
- jestli formulář běží na stejném originu jako admin

Typické příčiny:

- špatný veřejný host po proxy
- mix `http` a `https`
- nesoulad mezi build/runtime originem

## `Failed to find Server Action`

Zkontroluj:

- že všechny instance používají stejný `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- že build i runtime vidí stejné `NEXT_DEPLOYMENT_ID`
- logy `ppstudio.next.register`
- logy `ppstudio.next.request-error`

Typické příčiny:

- starý otevřený tab po deployi
- rozdílné release identifikátory
- rozdílný encryption key mezi instancemi

## Prisma nebo migrace selžou po releasu

Zkontroluj:

- `npm run db:check-migrations`
- `npx prisma migrate deploy`
- `journalctl` výstup webu

Typické příčiny:

- nekompletní migrace
- změna schématu bez deploynutého Prisma klienta
- historická nekonzistence migration history

Pokud `npm run db:check-migrations` končí `Migration history check: OK`, rollbacknuté auditní záznamy `20260419103000_service_public_bookability`, `20260419140000_site_settings_singleton` a `20260428133959_voucher_pdf_logo_settings` samy o sobě release neblokují. Nikdy je nemaž ručně z `_prisma_migrations`.

## Uploady médií nefungují

Zkontroluj:

- `MEDIA_STORAGE_ROOT`
- práva adresáře
- volné místo na disku
- logy `sharp`

Typické příčiny:

- web proces nemá write právo
- storage root neexistuje
- velký upload naráží na limit

## Po deployi nefungují owner-only sekce

Zkontroluj:

- roli v `AdminUser.role`
- zda je účet aktivní DB účet; při úplném lockoutu obnov OWNERa offline příkazem `admin:recover-owner`
- guardy v owner/salon route stromu

## Proxmox/LXC specifické potíže

Časté problémy:

- po upgrade Node je třeba nový `npm ci`
- kontejner má málo RAM pro build
- filesystem mount uvnitř LXC nedovolí zápis do upload rootu
- systemd v kontejneru není po úpravě unitů reloadnutý

První kroky:

- `free -h`
- `df -h`
- `systemctl daemon-reload`
- znovu ověřit `systemctl status ppstudio-web ppstudio-email-worker`

## Související dokumenty

- [ARCHITECTURE.md](/var/www/ppstudio/ARCHITECTURE.md)
- [BOOKING_FLOW.md](/var/www/ppstudio/BOOKING_FLOW.md)
- [DEPLOYMENT.md](/var/www/ppstudio/DEPLOYMENT.md)
- [ENVIRONMENT.md](/var/www/ppstudio/ENVIRONMENT.md)
- [docs/INCIDENTS.md](/var/www/ppstudio/docs/INCIDENTS.md)
