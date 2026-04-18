# Dependencies

Seznam důležitých knihoven a důvod jejich použití.

## Core
- `next`: framework aplikace.
- `react`: UI knihovna.
- `react-dom`: renderování Reactu do DOM.

## Datová a aplikační vrstva
- `@prisma/client`: typovaný přístup k databázi nad booking doménou, adminem i provozními daty.
- `@prisma/adapter-pg`: oficiální PostgreSQL driver adapter pro Prisma 7 runtime.
- `pg`: PostgreSQL driver použitý pod Prisma adapterem.
- `prisma`: schema, migrace a generování klienta pro PostgreSQL.
- `zod`: validace env a serverových vstupů.
- `jose`: podpis a verifikace admin session.
- `nodemailer`: SMTP transport pro potvrzení rezervace a storno e-maily.
- `dotenv`: načtení `.env` pro Prisma CLI konfiguraci.
- vestavěný Node.js `crypto`: generování a hashování action tokenů pro booking workflow bez další závislosti.
- Booking submission audit využívá stejnou Prisma vrstvu a nezavádí další knihovnu pro rate limiting ani logování.

## Kvalita kódu
- `typescript`: statická typová kontrola.
- `eslint`: linting.
- `eslint-config-next`: pravidla lintu pro Next.js.
- `tsx`: lehký TypeScript runtime pro Node test runner.

## Stylování
- `tailwindcss`: utility-first CSS framework.
- `@tailwindcss/postcss`: integrace Tailwindu do PostCSS.
- `clsx`: skládání className bez string chaosu.
- `tailwind-merge`: bezpečné slučování Tailwind tříd.

## Poznámky k veřejnému webu
- Nová veřejná část byla postavená bez dalších UI knihoven nebo animačních balíků.
- Cílem je nízká složitost, rychlý render a co nejmenší závislostní povrch pro marketingový web.

## Poznámky k datové vrstvě
- Prisma schema v1 používá enumy pro role, stavy slotů, stavy rezervací a e-mailové workflow.
- Pro bezpečné storno a přesun termínu není potřeba další knihovna; token workflow je navržený na úrovni DB přes hash + expiraci.
- E-mailové šablony i delivery vrstva zůstávají jednoduché a nepřidávají frontovací nebo queue závislosti, což drží self-hosted nasazení lehké.
- `Json` pole ve `Setting`, `BookingStatusHistory` a `EmailLog` ponechávají prostor pro evoluci bez destruktivních migrací.
- Admin role-aware dashboardy používají jen existující Next.js, Prisma a React primitives; nepřidávali jsme další admin UI knihovnu ani CMS vrstvu.

## Pravidla aktualizací
- Minimálně 1x měsíčně zkontrolovat bezpečnostní a major update.
- Před major updatem ověřit kompatibilitu a sepsat dopad.
