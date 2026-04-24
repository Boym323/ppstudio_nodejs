# PP Studio

Produkční web kosmetického studia s veřejnou prezentací, rezervačním flow a odděleným admin rozhraním pro role `OWNER` a `SALON`.

## Co projekt dnes umí

- veřejný web: homepage, služby, detail služby, ceník, studio, o mně, kontakt, FAQ a právní stránky
- rezervační flow na `/rezervace` nad ručně publikovanými sloty
- self-service správa rezervace přes veřejné tokenové routy pro změnu termínu a storno
- admin pro owner i provoz se sekcemi rezervací, volných termínů, služeb, kategorií, klientů, médií a nastavení
- e-mailovou frontu, auditní historii rezervací a owner kalendářový `.ics` feed

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4
- Prisma 7 + PostgreSQL
- Zod validace na serveru
- Nodemailer pro e-mailový worker

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
- `BookingStatusHistory`
- `BookingActionToken`
- `BookingSubmissionLog`
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

## Skripty

- `npm run dev` spustí vývojový server
- `npm run build` vytvoří produkční build
- `npm run start` spustí produkční server
- `npm run lint` spustí ESLint
- `npm run test` spustí integrační testy nad Node test runnerem
- `npm run test:e2e` spustí Playwright E2E testy
- `npm run test:db:booking` spustí booking DB integrační testy
- `npm run db:generate` vygeneruje Prisma Client
- `npm run db:migrate` spustí `prisma migrate dev`
- `npm run db:check-migrations` zkontroluje historii migrací
- `npm run db:push` synchronizuje schema bez migrací
- `npm run db:studio` otevře Prisma Studio
- `npm run db:import-services` importuje katalog služeb
- `npm run email:worker` spustí e-mailový worker
- `npm run email:worker:once` jednorázově zpracuje frontu e-mailů

Pro produkci používej Prisma deploy flow přes `npx prisma migrate deploy`. Lokální `npm run db:migrate` je určené pro vývoj.

## Vývojové poznámky

- Tohle není "běžný Next.js projekt". Před větší změnou v App Routeru si ověř relevantní guide v `node_modules/next/dist/docs/`.
- Route soubory mají zůstat tenké; business logika patří do `src/features` a infrastruktura do `src/lib`.
- Veřejný obsah je rozdělený mezi `src/content/public-site.ts` a DB read modely ve `src/features/public/lib`.
- Média se ukládají mimo repo a servírují se přes route handlery v `src/app/media`.

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
