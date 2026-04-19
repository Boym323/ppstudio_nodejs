# PP Studio

Produkční základ pro luxusní prezentační web kosmetického salonu s rezervacemi a odděleným admin rozhraním pro majitele i provoz.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4
- Prisma ORM
- PostgreSQL
- Server-side validace přes Zod

## Architektura

Projekt je rozdělený podle odpovědnosti, ne podle náhodných komponent:

```text
src/
  app/
    (public)/            veřejný prezentační web
    (booking)/           rezervační část
    (admin)/admin/       admin vstup a chráněné sekce
    api/auth/            serverové auth endpointy
  components/
    layout/              sdílené layout komponenty
    ui/                  malé znovupoužitelné UI bloky
  features/
    home/                veřejná homepage
    booking/             booking UI
    admin/               admin obrazovky a formuláře
  config/                metadata, navigace, env
  lib/                   Prisma, auth, utility
  proxy.ts               ochrana admin rout v Next 16
prisma/
  schema.prisma          datový model
prisma.config.ts         Prisma 7 CLI konfigurace
docs/
  ADR/                   architektonická rozhodnutí
```

## Route Groups

- `/` běží z `src/app/(public)`
- `/rezervace` běží z `src/app/(booking)`
- `/admin/*` běží z `src/app/(admin)`
- `/admin/prihlaseni` je veřejná vstupní stránka pro admin
- `/admin` je owner dashboard
- `/admin/provoz` je provozní dashboard pro roli `SALON`

## Auth základ

Admin autentizace je připravená jako produkční skeleton:

- přihlášení přes serverový `POST` route handler
- validace vstupu přes Zod
- podepsaná session cookie přes `jose`
- role `OWNER` a `SALON`
- bootstrap přístupy jsou dočasně řízené přes env proměnné

Další krok je přesun admin uživatelů z env do databáze a navázání na plnohodnotné auditování a obnovu hesla.

## Datový model

Prisma schema už počítá s těmito entitami:

- `AdminUser`
- `ServiceCategory`
- `Service`
- `AvailabilitySlot`
- `Client`
- `Booking`
- `BookingStatusHistory`
- `BookingActionToken`
- `EmailLog`
- `Setting`
- `BookingSubmissionLog`

To vytváří solidní základ pro ručně vypisované volné termíny i následnou správu rezervací.

## Rychlý start

```bash
npm install
cp .env.example .env
npm run db:generate
npm run dev
```

Po nastavení databáze:

```bash
npm run db:migrate
```

## Skripty

- `npm run dev` spustí vývojový server
- `npm run build` vytvoří produkční build
- `npm run start` spustí produkční build
- `npm run lint` zkontroluje kvalitu kódu
- `npm run db:generate` vygeneruje Prisma client
- `npm run db:migrate` spustí lokální `prisma migrate dev`
- `npm run db:push` synchronizuje schema bez migrace
- `npm run db:studio` otevře Prisma Studio
- `npm run email:worker` spustí background worker pro e-mailovou frontu
- `npm run email:worker:once` jednorázově zpracuje čekající e-maily

Pro produkční nasazení používej Prisma deploy flow přes `npx prisma migrate deploy`; lokální script `npm run db:migrate` je určený pro vývoj.

Prisma 7 používá `prisma.config.ts` jako výchozí místo pro datasource konfiguraci CLI, zatímco datový model zůstává v `prisma/schema.prisma`.

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

## Commit zprávy

- Commit message piš česky.
- Pro jednotný styl je připravená šablona `.gitmessage-cz.txt`.
