# Architektura PP Studio

Tento dokument shrnuje aktuální architekturu aplikace podle skutečného stavu repozitáře k datu `2026-07-10`.

## Přehled systému

PP Studio je monolitická Next.js 16 aplikace nad App Routerem s PostgreSQL databází přes Prisma. Jeden deploy obsluhuje:

- veřejný web
- veřejný booking flow
- self-service správu rezervace přes token
- admin rozhraní pro owner a salon role
- e-mailový outbox worker
- owner ICS subscription feed a klientské ICS přílohy

Hlavní stack:

- `next` `16.3.1`
- `react` `19.2.8`
- `react-dom` `19.2.8`
- `prisma` `7.9.1`
- PostgreSQL
- systemd služby `ppstudio-web` a `ppstudio-email-worker`

## Aplikační vrstvy

### Routing a UI

`src/app`

- `(public)` obsahuje prezentační web
- `(booking)` obsahuje rezervaci a self-service booking stránky
- `(admin)` obsahuje administraci
- `api/*` obsahuje route handlery

`src/components`

- sdílené layouty a UI primitives

`src/features`

- `public`: veřejné read modely a prezentační obsah
- `booking`: booking doména, tokeny, self-service, notifikace
- `admin`: backoffice workflow, read modely, server actions
- `calendar`: ICS feedy a kalendářové tokeny
- `analytics`: Matomo, Clarity, Meta Pixel, Google Ads
- `vouchers`: voucher doména, PDF, veřejné ověření
- `media`: media knihovna a asset repository

`src/lib`

- infrastruktura: Prisma, auth, email, notifications, analytics reporting, site settings

## Databáze a Prisma modely

Schéma je v [prisma/schema.prisma](prisma/schema.prisma#L1).

### Hlavní entity

`AdminUser`

- interní uživatel administrace
- role `OWNER` nebo `SALON`
- volitelný `passwordHash`, audit `lastLoginAt`

`UserNotificationSettings`

- 1:1 konfigurace owner Pushover notifikací
- per-user toggly pro konkrétní incidenty a booking eventy

`AdminUserInviteToken`

- tokeny pro aktivaci pozvánek do adminu

`ServiceCategory` a `Service`

- katalog služeb pro web, booking i admin
- `Service` drží veřejnou copy, SEO metadata, cenu, délku a `cleanupMinutes`
- `isPubliclyBookable` a `isActive` řídí dostupnost v booking flow

`AvailabilitySlot` a `AvailabilitySlotService`

- publikovaná nebo draft dostupnost
- podporuje `ANY` nebo `SELECTED` omezení na konkrétní služby
- slot je source of truth pro plánování kapacity

`Client`

- CRM profil klientky
- `email` je volitelný a unikátní
- `lastBookedAt` je provozní metadata, ne hlavní účetní pravda

`Booking`

- hlavní objednávka
- snapshotuje jméno klientky, kontakt, službu, cenu, délku a čas
- drží i akviziční metadata:
  - `acquisitionSource`
  - `acquisitionReferrerHost`
  - `acquisitionUtmSource`
  - `acquisitionUtmMedium`
  - `acquisitionUtmCampaign`
- podporuje public i manual booking
- podporuje cleanup blokaci přes `cleanupMinutes`, `cleanupBlockMinutes`, `blockedUntil`
- podporuje voucher intent i individuální finální cenu

`BookingPayment`

- eviduje platby mimo voucher

`Voucher` a `VoucherRedemption`

- hodnotové i službové vouchery
- snapshot služby chrání voucher před pozdější změnou katalogu

`BookingRescheduleLog` a `BookingStatusHistory`

- audit změn termínu a stavů

`BookingActionToken`

- tokeny pro storno, přesun a approve/reject
- raw token se neukládá, ukládá se hash

`EmailLog`

- outbox fronta i audit doručení
- stavy `PENDING`, `SENT`, `FAILED`
- tracking pole pokrývají delivered/opened/clicked/bounced atd.

`BookingSubmissionLog`

- audit veřejných booking pokusů a rate limitů

`SiteSettings`

- singleton s provozními kontakty, booking pravidly a e-mail brandingem

`CalendarFeed`

- owner-only ICS subscription feed
- drží `tokenSalt`, `scope`, aktivaci a audit změn

`MediaAsset`

- lokální media knihovna s originálem, optimized a thumbnail variantou

## Booking a provozní dataflow

1. Veřejný web načte katalog přes `src/features/booking/lib/booking-public/catalog.ts`.
2. UTM/referrer metadata se uloží do cookie `ppstudio-booking-acq`.
3. Server action `createPublicBookingAction` validuje formulář, audit a rate limit.
4. Booking engine v `booking-public/engine.ts`:
   - načte službu
   - uzamkne slot
   - zvaliduje coverage intervalu
   - vytvoří nebo aktualizuje klientku
   - založí `Booking`
   - založí booking tokeny a `EmailLog` záznamy
5. Podle `EMAIL_DELIVERY_MODE` se e-mail buď jen zaloguje, nebo zpracuje workerem.

Booking doména je navržená tak, aby UI bylo v klientu, ale rozhodující business pravidla byla jen na serveru.

## E-mail worker

Implementace:

- worker loop: [src/lib/email/worker.ts](src/lib/email/worker.ts#L1)
- CLI entrypoint: [scripts/email-delivery-worker.ts](scripts/email-delivery-worker.ts#L1)
- doručení: [src/lib/email/delivery.ts](src/lib/email/delivery.ts#L1)

Chování:

- batch claimuje jen splatné `EmailLog` záznamy
- používá `FOR UPDATE SKIP LOCKED`
- zapisuje `processingStartedAt` a `processingToken`
- retry/backoff řeší `src/lib/email/retry.ts`
- reminder scheduler běží ve stejném worker procesu
- finální selhání může poslat owner Pushover

Produkčně běží jako samostatná systemd služba `ppstudio-email-worker.service`.

## ICS a kalendáře

### Owner ICS feed

- route: `/api/calendar/owner.ics?token=...`
- scope: pouze `OWNER_BOOKINGS`
- vrací jen `CONFIRMED` rezervace
- token je HMAC odvozený z `CalendarFeed.id`, `scope`, `tokenSalt` a `ADMIN_SESSION_SECRET`
- raw token se neukládá do DB

Implementace:

- [src/features/calendar/lib/calendar-feed-service.ts](src/features/calendar/lib/calendar-feed-service.ts#L1)
- [src/features/calendar/lib/calendar-feed-token.ts](src/features/calendar/lib/calendar-feed-token.ts#L1)

### ICS pro klientku

- klientka dostává jednu `.ics` přílohu v potvrzovacím nebo reschedule e-mailu; veřejný endpoint ani kalendářový token neexistují
- generování přílohy: [src/features/calendar/lib/booking-calendar-attachment.ts](src/features/calendar/lib/booking-calendar-attachment.ts#L1)

## Analytika: Matomo, UTM, Clarity, Meta Pixel, Google Ads

### Matomo

Klientská vrstva:

- pageview a custom eventy
- zapíná se přes `NEXT_PUBLIC_MATOMO_*`
- na adminu a tokenových route se pageview neposílá
- při přihlášené admin session se tracker nenačte ani na veřejném webu

Serverová vrstva:

- admin dashboard reporting přes `MATOMO_URL`, `MATOMO_SITE_ID`, `MATOMO_AUTH_TOKEN`
- wrapper je server-only
- vrací business agregace, ne raw Matomo payload

### UTM a akvizice

Implementace: [src/features/booking/lib/booking-acquisition.ts](src/features/booking/lib/booking-acquisition.ts#L1)

- do cookie se ukládá landing path, referrer host a `utm_*` nebo `mtm_*`
- při vytvoření rezervace se metadata propíší do `Booking`
- zdroj se normalizuje na:
  - `DIRECT`
  - `FACEBOOK`
  - `GOOGLE`
  - `INSTAGRAM`
  - `FIRMY_CZ`
  - `OTHER`

### Další trackery

- Clarity: jen veřejný web, bez adminu a tokenových route
- Meta Pixel: standardní funnel eventy bez PII
- Google Ads: pageview tracking přes App Router navigaci

## Role v adminu

Zdroj pravdy:

- enum `AdminRole`
- navigace: [src/config/navigation.ts](src/config/navigation.ts#L1)
- guardy: [src/features/admin/lib/admin-guards.ts](src/features/admin/lib/admin-guards.ts#L1)

### OWNER

- plný přístup
- vidí sekce `uzivatele`, `email-logy`, `nastaveni`
- spravuje kalendář feed, přístupy a systémové konfigurace

### SALON

- každodenní provozní role
- přístup do rezervací, volných termínů, voucherů, klientů, médií, služeb a kategorií
- bez přístupu do citlivých owner-only sekcí

Autentizace:

- primárně DB účet `AdminUser.passwordHash`
- recovery výhradně offline vytvořením nebo obnovou DB OWNERa přes `admin:recover-owner`

## Persistenční a provozní hranice

Source of truth:

- PostgreSQL pro business data
- filesystem pro nahraná média
- systemd pro běh procesů

Bez externí queue:

- outbox je `EmailLog`
- worker běží jako polling loop

Bez externího object storage:

- media jsou lokálně v `MEDIA_STORAGE_ROOT`

## Deploy architektura: Proxmox/LXC

Repo je provozované na Debian LXC kontejneru v Proxmoxu.

Provozní model:

- aplikace běží v jednom LXC kontejneru
- web a worker jsou dvě samostatné systemd služby
- pracovní checkout zůstává v `/var/www/ppstudio`, ale běžící služby používají `/var/www/ppstudio/current`
- `deploy/release.sh` staví úplný release ve staging workspace, uloží ho do `releases/` a atomicky přepne symlink `current`; zdrojové soubory, `.next`, `node_modules`, Prisma Client a worker tak vždy pocházejí ze stejné verze
- po restartu helper nejdřív tiše čeká na otevření webového endpointu a až potom provede health a homepage smoke kontrolu; selhání vrací předchozí runtime release, nikoli databázové schéma

Detaily rolloutů a env proměnných jsou v:

- [DEPLOYMENT.md](DEPLOYMENT.md)
- [ENVIRONMENT.md](ENVIRONMENT.md)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
