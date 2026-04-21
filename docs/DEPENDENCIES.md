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
- `image-size`: čtení rozměrů lokálně uložených obrázků pro metadata `MediaAsset`.
- `dotenv`: načtení `.env` pro Prisma CLI konfiguraci.
- vestavěný Node.js `crypto`: generování a hashování action tokenů pro booking workflow bez další závislosti.
- Booking submission audit využívá stejnou Prisma vrstvu a nezavádí další knihovnu pro rate limiting ani logování.

## Kvalita kódu
- `typescript`: statická typová kontrola.
- `eslint`: linting.
- `eslint-config-next`: pravidla lintu pro Next.js.
- `tsx`: lehký TypeScript runtime pro Node test runner a background worker skript.

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
- Slot admin CRUD stojí jen na stávajícím stacku Next.js + Prisma + Zod; záměrně jsme nepřidávali žádnou kalendářovou, form builder ani admin CMS knihovnu.
- UX vylepšení slot formuláře, týdenního planneru, inline day workspace a mobilních sticky akcí běží čistě na React/Next primitives; nevznikla nová externí závislost.
- Kompaktní veřejný picker časů v `/rezervace` byl také upravený bez nové závislosti; grouping a disabled stavy běží čistě na stávajícím stacku React + TypeScript + Tailwind utilities.
- Pro bezpečné storno a přesun termínu není potřeba další knihovna; token workflow je navržený na úrovni DB přes hash + expiraci.
- E-mailové šablony i delivery vrstva zůstávají jednoduché a nepřidávají queue službu mimo PostgreSQL outbox.
- `Json` pole ve `Setting`, `BookingStatusHistory` a `EmailLog` ponechávají prostor pro evoluci bez destruktivních migrací.
- Admin sekce `Nastavení` a singleton `SiteSettings` byly doplněné bez nové knihovny; zůstáváme na stávajícím stacku Next.js, React, Prisma a Zod.
- Admin role-aware dashboardy používají jen existující Next.js, Prisma a React primitives; nepřidávali jsme další admin UI knihovnu ani CMS vrstvu.
- Konsolidace owner/salon admin route wrapperů do shared factory patternu proběhla bez přidání nové knihovny.
- Admin workflow pro služby (seznam, filtry, editace a validační vrstva) bylo doplněné čistě nad existujícím stackem Next.js, React, Prisma a Zod.
- Přepracované workflow `Služby` a `Kategorie služeb` (create CTA, quick actions, reorder, warningy, mobilní list/detail flow) zůstává bez nové UI nebo drag-and-drop závislosti; běží čistě na stávajícím stacku Next.js, React, Prisma a Zod.
- Nový dark workspace `Kategorie služeb` používá jen React 19 primitives (`useActionState`, `useOptimistic`, `startTransition`) a nepřidává žádný drawer, icon ani form helper balík.
- Lokální media storage vrstva zůstává na stávajícím stacku Next.js, Prisma a Node filesystemu; nová závislost `image-size` řeší jen rozměry obrázků bez zavádění těžšího image pipeline řešení.

## Pravidla aktualizací
- Minimálně 1x měsíčně zkontrolovat bezpečnostní a major update.
- Před major updatem ověřit kompatibilitu a sepsat dopad.

## Provozní poznámka
- `npm run dev` a `npm run build` nyní automaticky spouštějí `prisma generate`, aby admin sekce nepoužívaly zastaralý Prisma klient po změnách schématu `EmailLog` a dalších modelů.
- Týdenní planner dostupností, batch create, inline quick edit slotu i sekundární day workspace byly implementované bez nové závislosti; zůstáváme na stávajícím stacku Next.js, React, Prisma a Zod.
- `dotenv` a `prisma/config` jsou potřeba i proto, že Prisma 7 CLI čte `DATABASE_URL` a `SHADOW_DATABASE_URL` mimo runtime validaci Next.js aplikace.
- Týdenní planner dostupností byl postavený bez nové závislosti; zůstáváme na stávajícím stacku Next.js, React, Prisma a Zod.
