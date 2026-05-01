# Dependencies

Seznam důležitých knihoven a důvod jejich použití.

## Aktuální verze stacku
- Zdroj pravdy je `package.json` v kořeni projektu.
- `next`: `16.2.4`
- `react`: `19.2.4`
- `react-dom`: `19.2.4`
- `prisma`: `^7.7.0` (runtime používá `7.7.0`)
- `@prisma/client`: `^7.7.0` (runtime používá `7.7.0`)
- `@prisma/adapter-pg`: `^7.7.0` (runtime používá `7.7.0`)
- `@playwright/test`: browser E2E test runner pro hlavní rezervační a admin flow.
- Matomo tracking nepřidává žádnou npm závislost; používá `next/script`, App Router navigation hooks a standardní `window._paq` frontu.
- Server-side Matomo Reporting API vrstva také nepřidává žádnou npm závislost; používá vestavěný `fetch`, Next.js revalidation cache a lokální TypeScript normalizaci odpovědí.
- Admin dashboard cockpit nepřidává žádnou npm závislost; jde o úpravu serverového read modelu, React/Tailwind prezentačních komponent a stávajícího Matomo widgetu.
- Pushover notifikace nepridavaji zadnou npm zavislost; serverova integrace pouziva vestaveny `fetch`, `URLSearchParams`, Prisma a existujici Next.js server action pattern.
- Voucher business vrstva nepřidává žádnou npm závislost; kódy generuje přes vestavěný Node.js `crypto`, DB logiku řeší Prisma a vstupy validuje existující `zod`.
- UX refaktor admin seznamu voucherů nepřidává žádnou npm závislost; jde jen o úpravu stávající serverové read vrstvy, Tailwind layoutu a badge stylů.
- Ruční odesílání voucheru e-mailem nepřidává žádnou npm závislost; používá stávající `EmailLog` outbox, existující worker, `nodemailer` provider a worker-safe PDF core `src/features/vouchers/lib/voucher-pdf-core.ts`.
- UX refaktor admin detailu voucheru nepřidává žádnou npm závislost; jde jen o přeskupení existujících serverových read modelů, klientského e-mailového panelu a Tailwind layoutu.
- UX density pass admin planneru `Volné termíny` nepřidává žádnou npm závislost; jde čistě o úpravu existujících React/Tailwind komponent, layoutu toolbaru, pravého inspektoru a kontrastu gridu.
- Oprava fragmentace chained booking slotů pro admin planner nepřidává žádnou npm závislost; používá stávající Prisma transakce a sdílenou coverage logiku.
- Admin vytvoření voucheru nepřidává žádnou novou knihovnu; používá existující Next.js server actions, React `useActionState` / lokální state pro živý náhled, Prisma a voucher Zod schéma.
- Admin uplatnění voucheru v detailu rezervace nepřidává žádnou novou knihovnu; formulář používá React `useActionState`, server action používá existující Zod/Prisma vrstvu a transakční voucher doménu.
- Read-only payment summary v admin detailu rezervace nepřidává žádnou novou knihovnu ani payment SDK; jde o TypeScript výpočet nad Prisma read modelem a existujícími `VoucherRedemption` daty.
- Veřejné intended zadání voucheru v booking flow nepřidává žádnou novou knihovnu; používá existující React wizard, Next.js server action, Prisma a voucher validační helper.
- Veřejné ověření voucheru na `/vouchery/overeni` nepřidává žádnou novou knihovnu; používá existující Next.js server component route, Prisma a serverový voucher validační helper.
- PDF generátor voucheru přidává runtime závislosti `pdf-lib`, `qrcode`, `@pdf-lib/fontkit` a `@fontsource/noto-sans` plus dev typy `@types/qrcode`. `pdf-lib` skládá PDF server-side bez headless browseru, `qrcode` generuje ověřovací QR kód a Noto Sans přes `fontkit` řeší českou diakritiku z licenčně jasného OFL font balíčku.
- A4 tisková varianta voucher PDF nepřidává žádnou novou závislost; používá stejný `pdf-lib`, `qrcode`, `@pdf-lib/fontkit` a Noto Sans stack jako původní voucher PDF.
- Samostatné logo pro PDF vouchery nepřidává žádnou novou závislost; používá existující `MediaAsset`, lokální media storage a embed PNG/JPEG přes `pdf-lib`.

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
- `sharp`: lehká server-side image pipeline pro EXIF-normalized originál a varianty `optimized` + `thumbnail` při uploadu přes Media Library.
- `server-only`: marker balík doporučený Next.js dokumentací pro server-only moduly; v tomhle projektu je instalovaný i kvůli běhu `node --test` mimo Next bundler, kde před testy registrujeme malý resolver hook a mapujeme `server-only` na prázdný stub jen v testovacím procesu.
- `dotenv`: načtení `.env` pro Prisma CLI konfiguraci.
- vestavěný Node.js `crypto`: generování a hashování action tokenů pro booking workflow bez další závislosti.
- vestavěný Node.js `crypto` také nově podepisuje odvozené tokeny pro chráněný owner ICS feed; nebyla přidána žádná externí iCalendar nebo calendar auth knihovna.
- Owner Pushover integrace byla pridana bez SDK baliku; POST na `https://api.pushover.net/1/messages.json` se sklada primo ve sdilene serverove implementaci `pushover-core` a Next.js `server-only` wrapper zustava oddeleny od standalone worker importu.
- Pro nové provozní approve/reject odkazy jsme nepřidávali žádnou další knihovnu; bezpečnost flow dál stojí na existujícím Node.js `crypto`, Prisma transakcích a Next.js App Router server actions.
- Refaktor HTML šablony admin notifikace také nepřidává žádnou knihovnu; email-safe layout je ručně skládaný přes inline styly a prezentační tabulky.
- Ani zákaznická `.ics` příloha po potvrzení rezervace nepřidává novou knihovnu; používá lokální iCalendar utility a stávající SMTP vrstvu přes `nodemailer`.
- UX/copy refaktor potvrzovacího klientského e-mailu `booking-approved-v1` také nepřidává novou knihovnu; layout dál používá ručně skládané email-safe HTML s inline styly a stávající `.ics` attachment pipeline.
- Sjednocení booking e-mailů do jednoho design systému nepřidává žádnou knihovnu; HTML shell, karty, CTA i text/plain fallbacky zůstávají ručně skládané v `src/lib/email/templates.ts` nad existujícím Node/Prisma/Nodemailer stackem.
- Jediný 24h reminder rezervací také nepřidává novou knihovnu; scheduler, token workflow i outbox zápis používají stávající Next.js/Prisma/Node stack a existující `email:worker`.
- Admin přesun termínu také nepřidává novou knihovnu; drawer UI, auditní log i doménová validace běží čistě na stávajícím stacku Next.js, React, Prisma a Zod.
- Refaktor detailu rezervace do decision panelu také nepřidává novou závislost; sticky header, action chooser, kompaktní summary card i zkrácená historie používají jen stávající Next.js App Router, React a Tailwind utility.
- Klientský self-service přesun termínu také nepřidává novou knihovnu; veřejná manage route, secure token flow a potvrzovací panel běží čistě na stávajícím stacku Next.js, React, Prisma a Zod.
- UX refaktor klientského self-service přesunu termínu také nepřidává novou knihovnu; hybridní seznam, kalendář, sticky mobilní souhrn, smooth scroll i Matomo eventy používají stávající React/Next primitives a lokální helpers.
- Ruční vytvoření rezervace v adminu také nepřidává novou knihovnu; drawer, deduplikace klientky i sdílené create jádro běží čistě na stávajícím stacku Next.js, React, Prisma a Zod.
- Uvolnění e-mailu u ruční rezervace také nepřidává novou knihovnu; změna stojí jen na Prisma migraci, Zod validaci a úpravě sdíleného booking engine.
- Booking submission audit využívá stejnou Prisma vrstvu a nezavádí další knihovnu pro rate limiting ani logování.
- Audit změn cen služeb také nepřidává novou závislost; používá stávající Prisma model, admin session mapování a server actions.
- UX refaktor pracovního přehledu `Rezervace` také nepřidává novou závislost; klikací statistiky, URL-driven filtr toolbar i seskupení seznamu používají jen stávající Next.js App Router, `next/form`, React a Prisma vrstvu.
- Admin login rate limit také nepřidává novou závislost; používá stávající Prisma model `BookingSubmissionLog` a vestavěný Node.js `crypto` pro hash fingerprintů.
- Stabilizační refaktor `booking-public`, `booking-flow` a `admin-slots` také nepřidává žádnou novou runtime ani dev dependency; jde čistě o přesun stávající logiky do menších interních modulů.
- Modul `Média webu` také nepřidává žádnou novou závislost; upload, metadata, filtr typů i publish stav běží na stávajícím stacku Next.js, React, Prisma, Zod, Node filesystem a `image-size`.
- UX refaktor `Média webu` také nepřidává žádnou novou závislost; dropzóna, tabs s počty, quick publish/unpublish i kompaktní edit dialog běží na stávajících React/Next primitives.
- Rozdělení portrétů na `PORTRAIT_HOME` a `PORTRAIT_ABOUT` také nepřidává žádnou novou závislost; používá stávající `MediaAsset` model, Prisma enum a public media helpery.
- Veřejná stránka `/studio` nepřidává žádnou novou závislost; galerii skládá z existující media vrstvy a `next/image`.
- Matomo integrace také nepřidává žádnou novou závislost; helper a CTA wrappers jsou lokální TypeScript/React moduly.
- Matomo dashboard reporting také nepřidává žádnou novou závislost; `src/lib/analytics/matomo.ts` je server-only wrapper nad Reporting API.
- Databázový základ voucherů nepřidává žádnou novou závislost; jde čistě o Prisma modely, enumy, migraci a budoucí doménovou vrstvu v `src/features/vouchers`.

## Kvalita kódu
- `typescript`: statická typová kontrola.
- `eslint`: linting.
- `eslint-config-next`: pravidla lintu pro Next.js.
- `tsx`: lehký TypeScript runtime pro Node test runner a background worker skript.
- `@playwright/test`: end-to-end ověření v reálném browseru nad lokálním Next.js serverem; testy používají izolované Prisma fixture data a nejsou součástí běžného `npm test`.

## Stylování
- `tailwindcss`: utility-first CSS framework.
- `@tailwindcss/postcss`: integrace Tailwindu do PostCSS.
- `clsx`: skládání className bez string chaosu.
- `tailwind-merge`: bezpečné slučování Tailwind tříd.

## Poznámky k veřejnému webu
- Nová veřejná část byla postavená bez dalších UI knihoven nebo animačních balíků.
- Cílem je nízká složitost, rychlý render a co nejmenší závislostní povrch pro marketingový web.
- Redesign stránky `/o-mne` také nepřidává žádnou novou závislost; hero, CTA, galerie certifikátů i placeholder stavy běží čistě na stávajícím stacku Next.js, React, Tailwind a lokálních SVG/CSS efektech.
- Refaktor stránky `/obchodni-podminky` také nepřidává žádnou novou závislost; finální právní copy, hero aside i obsahová navigace zůstávají na existujících public komponentách a Tailwind utilitách.

## Poznámky k datové vrstvě
- Prisma schema v1 používá enumy pro role, stavy slotů, stavy rezervací a e-mailové workflow.
- Slot admin CRUD stojí jen na stávajícím stacku Next.js + Prisma + Zod; záměrně jsme nepřidávali žádnou kalendářovou, form builder ani admin CMS knihovnu.
- UX vylepšení slot formuláře, týdenního planneru, inline day workspace a mobilních sticky akcí běží čistě na React/Next primitives; nevznikla nová externí závislost.
- Draft-first redesign planneru (mobilní drawer sidebar, inspektor dne, sticky publish bar, lokální koncept týdne) dál běží bez nové state-management, drawer nebo calendar knihovny; zůstáváme na React 19 + Next.js 16 primitives.
- Kompaktní veřejný picker časů v `/rezervace` byl také upravený bez nové závislosti; grouping a disabled stavy běží čistě na stávajícím stacku React + TypeScript + Tailwind utilities.
- Pro bezpečné storno a přesun termínu není potřeba další knihovna; token workflow je navržený na úrovni DB přes hash + expiraci.
- E-mailové šablony i delivery vrstva zůstávají jednoduché a nepřidávají queue službu mimo PostgreSQL outbox.
- `Json` pole ve `Setting`, `BookingStatusHistory` a `EmailLog` ponechávají prostor pro evoluci bez destruktivních migrací.
- Audit ceníku je záměrně samostatný relační model `ServicePriceChangeLog`, ne další `Json` blob v `Service`, aby šlo změny filtrovat a řadit bez parsování payloadu.
- Admin sekce `Nastavení` a singleton `SiteSettings` byly doplněné bez nové knihovny; zůstáváme na stávajícím stacku Next.js, React, Prisma a Zod.
- Owner ICS feed pro Apple Kalendář byl přidaný bez nové závislosti; generování `.ics`, escapování i line folding běží v lokální utilitě nad standardním Node/TypeScript stackem.
- Klientská `.ics` příloha používá stejnou lokální iCalendar utilitu; nepřidávali jsme Google SDK, `.ics` generator balík ani novou mail knihovnu.
- Admin role-aware dashboardy používají jen existující Next.js, Prisma a React primitives; nepřidávali jsme další admin UI knihovnu ani CMS vrstvu.
- Nový operativní admin dashboard overview také běží bez nové ikonové nebo chart knihovny; používá Tailwind utility classes, lokální SVG ikony a serverový read model nad existující Prisma vrstvou.
- Konsolidace owner/salon admin route wrapperů do shared factory patternu proběhla bez přidání nové knihovny.
- Přestavba owner sekce `Uživatelé / role` také zůstává bez nové UI nebo auth závislosti; používá jen stávající Next.js server actions, React klientské komponenty, Prisma a Zod.
- Invite aktivace a DB hesla pro admin přístupy byly přidané bez nové auth knihovny; tokeny i hash hesel běží na vestavěném Node.js `crypto` (`sha256`, `scrypt`).
- Admin workflow pro služby (seznam, filtry, editace a validační vrstva) bylo doplněné čistě nad existujícím stackem Next.js, React, Prisma a Zod.
- Rozšíření katalogu o public/pricing metadata zůstává čistě v současném stacku Prisma + Next.js server actions; nepřidává CMS, feature flag službu ani externí content backend.
- Přepracované workflow `Služby` a `Kategorie služeb` (create CTA, quick actions, reorder, warningy, mobilní list/detail flow) zůstává bez nové UI nebo drag-and-drop závislosti; běží čistě na stávajícím stacku Next.js, React, Prisma a Zod.
- Nový dark workspace `Kategorie služeb` používá jen React 19 primitives (`useActionState`, `useOptimistic`, `startTransition`) a nepřidává žádný drawer, icon ani form helper balík.
- Přepnutí desktop detailů `Služby` a `Kategorie služeb` na pravý overlay drawer také nepřidává žádnou UI knihovnu; zůstáváme na lokálních React komponentech a Tailwind utilitách.
- Lokální media storage vrstva zůstává na stávajícím stacku Next.js, Prisma a Node filesystemu; `sharp` přidává jen lehkou upload-time normalizaci a varianty bez CDN a bez komplexního responsive image systému.

## Pravidla aktualizací
- Minimálně 1x měsíčně zkontrolovat bezpečnostní a major update.
- Před major updatem ověřit kompatibilitu a sepsat dopad.

## Provozní poznámka
- `npm run dev` a `npm run build` nyní automaticky spouštějí `prisma generate`, aby admin sekce nepoužívaly zastaralý Prisma klient po změnách schématu `EmailLog` a dalších modelů.
- Týdenní planner dostupností, batch create, inline quick edit slotu i sekundární day workspace byly implementované bez nové závislosti; zůstáváme na stávajícím stacku Next.js, React, Prisma a Zod.
- Synchronizace publikovaného konceptu týdne používá novou server action nad existující Prisma vrstvou; nepřibyla žádná fronta, websocket vrstva ani další persistence systém.
- `dotenv` a `prisma/config` jsou potřeba i proto, že Prisma 7 CLI čte `DATABASE_URL` a `SHADOW_DATABASE_URL` mimo runtime validaci Next.js aplikace.
- Týdenní planner dostupností byl postavený bez nové závislosti; zůstáváme na stávajícím stacku Next.js, React, Prisma a Zod.
