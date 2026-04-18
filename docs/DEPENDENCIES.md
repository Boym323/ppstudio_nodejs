# Dependencies

Seznam důležitých knihoven a důvod jejich použití.

## Core
- `next`: framework aplikace.
- `react`: UI knihovna.
- `react-dom`: renderování Reactu do DOM.

## Datová a aplikační vrstva
- `@prisma/client`: typovaný přístup k databázi nad booking doménou, adminem i provozními daty.
- `prisma`: schema, migrace a generování klienta pro PostgreSQL.
- `zod`: validace env a serverových vstupů.
- `jose`: podpis a verifikace admin session.
- `dotenv`: načtení `.env` pro Prisma CLI konfiguraci.

## Kvalita kódu
- `typescript`: statická typová kontrola.
- `eslint`: linting.
- `eslint-config-next`: pravidla lintu pro Next.js.

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
- `Json` pole ve `Setting`, `BookingStatusHistory` a `EmailLog` ponechávají prostor pro evoluci bez destruktivních migrací.

## Pravidla aktualizací
- Minimálně 1x měsíčně zkontrolovat bezpečnostní a major update.
- Před major updatem ověřit kompatibilitu a sepsat dopad.
