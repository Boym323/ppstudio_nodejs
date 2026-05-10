# PP Studio

Produkční web kosmetického studia s veřejnou prezentací, rezervačním flow a odděleným admin rozhraním pro role `OWNER` a `SALON`.

README slouží jako rychlý GitHub rozcestník. Detailní provozní a vývojová dokumentace je vedená přímo v repozitáři v `MANUAL.md` a `docs/*`, ne jako primární GitHub Wiki.

## Aktuální stav

- veřejný web: homepage, služby, detail služby, ceník, studio, o mně, kontakt, FAQ a právní stránky
- rezervační flow na `/rezervace` nad ručně publikovanými sloty
- self-service správa rezervace přes veřejné tokenové routy pro změnu termínu a storno
- admin pro owner i provoz se sekcemi rezervací, volných termínů, služeb, kategorií, klientů, médií, voucherů a nastavení
- evidence plateb rezervací, voucher lifecycle, PDF voucher a ruční e-mailové odeslání voucheru
- e-mailová fronta, auditní historie rezervací, owner `.ics` calendar feed a volitelný Matomo reporting pro dashboard

## Co je důležité vědět

- Tohle není "běžný Next.js projekt". Před změnou App Routeru nebo framework API si ověř relevantní guide v `node_modules/next/dist/docs/`.
- Route soubory mají zůstat tenké; business logika patří do `src/features`, infrastruktura do `src/lib`.
- Veřejné texty a část brand copy jsou v `src/content/public-site.ts`, ale katalog služeb, pricing metadata a část veřejného obsahu už bere data z DB read modelů.
- Dokumentace se udržuje v repu společně s kódem; GitHub Wiki není v tomhle projektu zdroj pravdy.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4
- Prisma 7 + PostgreSQL
- Zod validace na serveru
- Nodemailer pro e-mailový worker
- Playwright + Node test runner
- Matomo Reporting API

## Struktura projektu

```text
src/
  app/
    (public)/                 veřejný web
    (booking)/                booking a veřejné tokenové akce
    (admin)/admin/            admin vstup a chráněné sekce
    api/                      auth, kalendáře a pomocné endpointy
    media/                    servírování uložených médií
  components/
    layout/                   sdílené layouty
    ui/                       malé znovupoužitelné UI prvky
  config/                     metadata, navigace, env
  content/                    editovatelný obsah veřejného webu
  features/
    admin/                    admin workflow, formuláře a read modely
    booking/                  booking flow a booking business logika
    calendar/                 kalendářové exporty
    home/                     homepage sekce
    media/                    media knihovna a upload workflow
    public/                   veřejné stránky nad DB read modely
  lib/                        infrastructura, Prisma, auth, utility
prisma/
  schema.prisma               datový model
prisma.config.ts              Prisma 7 CLI konfigurace
docs/
  ADR/                        architektonická rozhodnutí
```

## Hlavní routy

- `/` veřejná homepage
- `/sluzby`, `/sluzby/[slug]`, `/cenik`, `/studio`, `/o-mne`, `/kontakt`, `/faq`
- `/rezervace` booking flow
- `/rezervace/sprava/[token]` veřejná správa rezervace
- `/rezervace/storno/[token]` veřejné storno
- `/rezervace/akce/[intent]/[token]` potvrzovací akce z provozních e-mailů
- `/vouchery/overeni?code=...` veřejné read-only ověření voucheru
- `/admin/prihlaseni` admin login
- `/admin/*` owner admin
- `/admin/provoz/*` lite admin pro roli `SALON`
- `/api/calendar/owner.ics?token=...` owner calendar feed

## Autentizace a role

Admin používá podepsanou `httpOnly` session cookie přes `jose`, serverový login handler a role `OWNER` / `SALON`.

- `/admin/*` je plný owner backoffice
- `/admin/provoz/*` je zjednodušené provozní rozhraní
- bootstrap přístupy lze stále nastavit přes env, ale projekt už počítá i s databázovými admin účty a pozvánkami

## Datový model

Projekt už pokrývá hlavní provozní entity:

- `AdminUser`
- `ServiceCategory`
- `Service`
- `ServicePriceChangeLog`
- `AvailabilitySlot`
- `Client`
- `Booking`
- `BookingPayment`
- `BookingStatusHistory`
- `BookingActionToken`
- `BookingSubmissionLog`
- `Voucher`
- `VoucherRedemption`
- `EmailLog`
- `SiteSettings`
- `MediaAsset`

## Rychlý start

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run dev
```

Vývoj běží standardně na `http://localhost:3000`.

Když dev server spadne na poškozenou Next/Turbopack cache, pomůže:

```bash
npm run dev:clean
```

## Skripty

- `npm run dev` spustí vývojový server
- `npm run build` vytvoří produkční build
- `npm run start` spustí produkční server
- `npm run lint` spustí ESLint
- `npm run test` spustí integrační testy nad Node test runnerem
- `npm run test:e2e` spustí Playwright E2E testy
- `npm run analytics:check` ověří server-side Matomo reporting
- `npm run test:db:booking` spustí booking DB integrační testy
- `npm run db:generate` vygeneruje Prisma Client
- `npm run db:migrate` spustí `prisma migrate dev`
- `npm run db:check-migrations` zkontroluje historii migrací
- `npm run db:push` synchronizuje schema bez migrací
- `npm run db:studio` otevře Prisma Studio
- `npm run db:import-services` importuje katalog služeb
- `npm run db:backfill-service-copy` provede backfill strukturovaných textů služeb (nejdřív používej `-- --dry-run`, teprve potom `-- --confirm`)
- `npm run db:clear-booking-data` vypíše počty booking/slot dat a s `-- --confirm` je smaže bez zásahu do služeb, admin účtů a settings
- `npm run email:worker` spustí e-mailový worker
- `npm run email:worker:once` jednorázově zpracuje frontu e-mailů
- `npm run email:previews` vygeneruje lokální HTML náhledy e-mailových šablon do `tmp/email-previews`

Pro produkci používej Prisma deploy flow přes `npx prisma migrate deploy`. Lokální `npm run db:migrate` je určené pro vývoj.

## Dokumentační rozcestník

- `MANUAL.md`: provozní a uživatelský přehled projektu
- `docs/DEVELOPMENT.md`: technické konvence, architektura a workflow
- `docs/ENVIRONMENT.md`: env proměnné
- `docs/DEPLOYMENT.md`: release a produkční nasazení
- `docs/DEPENDENCIES.md`: přehled hlavních závislostí
- `docs/INCIDENTS.md`: provozní incidenty a troubleshooting
- `docs/ADR/*`: architektonická rozhodnutí

## Nasazení

- Doporučený produkční rollout je `./deploy/release.sh`.
- Skript dělá `git pull --ff-only`, `npm ci`, `npm run db:generate`, `npm run db:check-migrations`, `npx prisma migrate deploy`, `lint`, `build` a restart `ppstudio-web` / `ppstudio-email-worker`.
- Release checklist a QA body jsou v `docs/DEPLOYMENT.md`.

## Dokumentace

Při každé významné změně udržuj aktuální:

- `MANUAL.md`
- `CHANGELOG.md`
- `docs/DEVELOPMENT.md`
- `docs/ADR/*`
- `docs/ENVIRONMENT.md`
- `docs/DEPLOYMENT.md`
- `docs/INCIDENTS.md`
- `docs/DEPENDENCIES.md`

Nejdůležitější doprovodné dokumenty:

- `MANUAL.md` pro provozní a uživatelský přehled
- `docs/DEVELOPMENT.md` pro detailní technické konvence
- `docs/ENVIRONMENT.md` pro env proměnné
- `docs/DEPLOYMENT.md` pro nasazení

## Commit zprávy

- commit message piš česky
- pro jednotný styl je připravená šablona `.gitmessage-cz.txt`
