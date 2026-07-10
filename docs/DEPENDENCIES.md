# Dependencies

## Recovery a přístupy

- Offline recovery OWNERa používá stávající runtime `tsx`, Prisma a Node `crypto`; nepřibyla žádná externí závislost. Neodstraňuj `tsx`, dokud zůstává script `admin:recover-owner` součástí provozního postupu.

Seznam důležitých knihoven a důvod jejich použití.

Atomický release mechanismus nepřidává žádnou npm závislost; používá existující Bash, systemd, `curl`, Node.js a Prisma CLI.

Constraint jednotkové kapacity slotu nepřidává žádnou závislost; používá existující PostgreSQL CHECK constraint a Prisma migrace.

Ochrana DB health alertu nepřidává žádnou závislost ani persistentní storage; používá lokální in-memory cooldown v Next.js route handleru.

Ošetření detailních DB dotazů health snapshotu nepřidává žádnou závislost; používá stávající `Response.json`, Prisma klient a serverový `console.error` pro neveřejnou diagnostiku a degradovaný health stav.

Explicitní `turbopack.root` nepřidává závislost; používá vestavěný Node.js modul `node:path`, který je součástí podporovaného Node 24 runtime.

## Aktuální verze stacku
- Zdroj pravdy je `package.json` v kořeni projektu.
- Projektový runtime cíl je `Node 24 LTS`; repozitář to explicitně deklaruje přes [`.nvmrc`](/var/www/ppstudio/.nvmrc:1) a `package.json.engines`.
- `next`: `16.2.10`
- `react`: `19.2.7`
- `react-dom`: `19.2.7`
- `tailwindcss`: `^4.2.4` (runtime používá `4.2.4`)
- `@tailwindcss/postcss`: `^4.2.4` (runtime používá `4.2.4`)
- `postcss`: přímá závislost není pinovaná; resolvuje se přes `@tailwindcss/postcss` (`8.5.10`) a interně také přes `next` (`8.4.31`).
- `prisma`: `^7.8.0` (runtime používá `7.8.0`)
- `@prisma/client`: `^7.8.0` (runtime používá `7.8.0`)
- `@prisma/adapter-pg`: `^7.8.0` (runtime používá `7.8.0`)
- `package.json.allowScripts` na npm 11 vědomě whitelisuje install hooky pro `prisma`, `@prisma/engines`, `sharp`, `esbuild` a `unrs-resolver`. Záznamy jsou připnuté na konkrétní verze, aby se při upgradu znovu explicitně zrevidovalo, které postinstall/preinstall skripty repo pouští.
- Poslední ověřený lokální `npm audit` (2026-07-02) hlásí `1 low` a `6 moderate` nálezů bez `high` / `critical`. Nejrelevantnější větev je `next -> postcss`, dále Prisma tooling (`prisma -> @prisma/dev -> @hono/node-server`) a transitive `@babel/core` / `brace-expansion`.
- Automatické `npm audit fix` se teď vědomě nepouští: doporučené opravy vrací nebezpečné návrhy na major downgrade `next` nebo `prisma`, takže bezpečný postup je čekat na kompatibilní upstream patch/minor release a zkusit audit znovu při dalším dependency passu.
- `@playwright/test`: browser E2E test runner pro hlavní rezervační a admin flow; v projektu držíme `^1.61.1`, protože starší `1.59.1` se v CI na Node 24 zasekávala při instalaci browseru.
- `c8`: V8 coverage reporter nad stávajícím `node --test` setupem; generuje HTML/LCOV/JSON reporty bez nutnosti přechodu na jiný test runner.
- `react` a `react-dom` drž vždy na přesně stejné patch verzi. U Next.js/React serverového renderu repo nesmí přijmout jednostranný bump jen `react`, protože CI pak spadne na runtime kontrolu `Incompatible React versions`.
- GitHub security automation teď stojí i na repo konfiguraci bez nových runtime závislostí:
  - `github/codeql-action`: statická bezpečnostní analýza JavaScript/TypeScript kódu
  - `actions/dependency-review-action`: PR diff kontrola rizikových dependency změn; aktuálně držíme major `v5`
  - `.github/dependabot.yml`: týdenní update PR pro `npm` a GitHub Actions
- Pro CI orchestrace v `.github/workflows/*.yml` je aktuální baseline `actions/checkout@v7`, `actions/setup-node@v6` a `actions/upload-artifact@v7`; tyto verze nejsou runtime závislost projektu, ale jsou součástí provozního dependency surface repozitáře a mají se udržovat spolu s touto dokumentací.
- Scheduled `npm audit --audit-level=high` je záměrně oddělený od ručních dependency passů: chceme failnout jen na `high`/`critical`, zatímco známé `low`/`moderate` větve dál sledujeme ručně v tomto dokumentu.
- `svix`: verifikace podpisu Resend webhooků (`svix-id`, `svix-timestamp`, `svix-signature`) nad raw request body.
- Matomo tracking nepřidává žádnou npm závislost; používá `next/script`, App Router navigation hooks a standardní `window._paq` frontu.
- Microsoft Clarity tracking také nepřidává žádnou npm závislost; používá `next/script` a veřejný Clarity tag přes inline init snippet.
- Meta Pixel tracking také nepřidává žádnou npm závislost; používá `next/script` a veřejný Meta `fbevents.js` tag přes inline init snippet.
- Booking/service Meta Pixel konverzní eventy také nepřidávají žádnou npm závislost; stojí na lokálním helperu nad `window.fbq` bez SDK balíku.
- Vyloučení přihlášeného admina z veřejného trackingu také nepřidává závislost; používá jen `next/headers` cookies check v `SiteShell` a existující session cookie jméno z auth helperu.
- Veřejné JSON-LD a Web Vitals reporting nepřidávají žádnou novou runtime závislost; JSON-LD používá vlastní serializer a Web Vitals používají `next/web-vitals` dodávané Next.js.
- Server-side Matomo Reporting API vrstva také nepřidává žádnou npm závislost; používá vestavěný `fetch`, Next.js revalidation cache a lokální TypeScript normalizaci odpovědí.
- Admin dashboard cockpit nepřidává žádnou npm závislost; jde o úpravu serverového read modelu, React/Tailwind prezentačních komponent a stávajícího Matomo widgetu.
- Pushover notifikace nepridavaji zadnou npm zavislost; serverova integrace pouziva vestaveny `fetch`, `URLSearchParams`, Prisma a existujici Next.js server action pattern.
- Voucher business vrstva nepřidává žádnou npm závislost; kódy generuje přes vestavěný Node.js `crypto`, DB logiku řeší Prisma a vstupy validuje existující `zod`.
- UX refaktor admin seznamu voucherů nepřidává žádnou npm závislost; jde jen o úpravu stávající serverové read vrstvy, Tailwind layoutu a badge stylů.
- Ruční odesílání voucheru e-mailem nepřidává žádnou npm závislost; používá stávající `EmailLog` outbox, existující worker, `nodemailer` provider a worker-safe PDF core `src/features/vouchers/lib/voucher-pdf-core.ts`.
- Dev generování e-mailových náhledů nepřidává žádnou npm závislost; `npm run email:previews` používá stávající `tsx`, Node `fs/promises` a existující renderer `renderEmailTemplate(...)`.
- UX refaktor admin detailu voucheru nepřidává žádnou npm závislost; jde jen o přeskupení existujících serverových read modelů, klientského e-mailového panelu a Tailwind layoutu.
- UX density pass admin planneru `Volné termíny` nepřidává žádnou npm závislost; jde čistě o úpravu existujících React/Tailwind komponent, layoutu toolbaru, pravého inspektoru a kontrastu gridu.
- Oprava fragmentace chained booking slotů pro admin planner nepřidává žádnou npm závislost; používá stávající Prisma transakce a sdílenou coverage logiku.
- Repair helper `scripts/repair-legacy-chained-slots.mjs` nepřidává žádnou npm závislost; používá stávající `pg` driver a `DATABASE_URL`.
- Oprava planner read modelu pro `CANCELLED` bookingy nepřidává žádnou npm závislost; jde jen o úpravu stávající Prisma/Tailwind admin vrstvy.
- Oprava planneru pro historicky zrušené rezervace nepřidává žádnou npm závislost; jde o úpravu stávající Prisma doménové logiky archivace slotů a read/write modelu planneru nad existujícím Next.js/Prisma stackem.
- Admin vytvoření voucheru nepřidává žádnou novou knihovnu; používá existující Next.js server actions, React `useActionState` / lokální state pro živý náhled, Prisma a voucher Zod schéma.
- Admin uplatnění voucheru v detailu rezervace nepřidává žádnou novou knihovnu; formulář používá React `useActionState`, server action používá existující Zod/Prisma vrstvu a transakční voucher doménu.
- Evidence plateb a payment summary v admin detailu rezervace nepřidává žádnou novou knihovnu, payment SDK ani QR generátor; jde o TypeScript výpočet nad Prisma read modelem, existujícími `VoucherRedemption` daty a novým modelem `BookingPayment`.
- Individuální cena rezervace nepřidává žádnou novou knihovnu; používá existující Prisma migrace, Next.js server action, Zod validaci a sdílený payment summary helper.
- `CRM souhrn` v admin detailu klientky nepřidává žádnou novou knihovnu; používá existující Prisma read model, `Booking.finalPriceCzk`, `VoucherRedemption`, `BookingPayment` a sdílený TypeScript helper `getBookingPaymentSummary(...)`.
- Veřejné intended zadání voucheru v booking flow nepřidává žádnou novou knihovnu; používá existující React wizard, Next.js server action, Prisma a voucher validační helper.
- Veřejné ověření voucheru na `/vouchery/overeni` nepřidává žádnou novou knihovnu; používá existující Next.js server component route, Prisma, veřejný salon profil a serverový voucher validační helper.
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
- Hardening administrátorských pozvánek nepřidává závislost; používá stávající Prisma 7 transakce a PostgreSQL `FOR UPDATE` row locky pro atomické spotřebování tokenu a jeho revokaci při deaktivaci účtu.
- `zod`: validace env a serverových vstupů.
- `jose`: podpis a verifikace admin session.
- `nodemailer`: SMTP transport pro potvrzení rezervace a storno e-maily.
- Resend REST transport nepřidává SDK závislost; používá vestavěný `fetch`, stabilní HTTP `Idempotency-Key` z `EmailLog.id` a mapuje `providerMessageId` na Resend `email_id` pro webhook tracking.
- `image-size`: čtení rozměrů lokálně uložených obrázků pro metadata `MediaAsset`.
- `sharp`: lehká server-side image pipeline pro EXIF-normalized originál a varianty `optimized` + `thumbnail` při uploadu přes Media Library. Při upgrade na novější minor řadu nepoužívej v TypeScriptu namespace styl `sharp.Sharp`; aktuální kompatibilní pattern v repu je explicitní `import sharp, { type Sharp } from 'sharp'`.
- `server-only`: marker balík doporučený Next.js dokumentací pro server-only moduly; v tomhle projektu je instalovaný i kvůli běhu `node --test` mimo Next bundler, kde před testy registrujeme malý resolver hook a mapujeme `server-only` na prázdný stub jen v testovacím procesu.
- `dotenv`: načtení `.env` pro Prisma CLI konfiguraci.
- vestavěný Node.js `crypto`: generování a hashování action tokenů pro booking workflow bez další závislosti.
- vestavěný Node.js `crypto` také nově podepisuje odvozené tokeny pro chráněný owner ICS feed; nebyla přidána žádná externí iCalendar nebo calendar auth knihovna.
- Owner Pushover integrace byla pridana bez SDK baliku; POST na `https://api.pushover.net/1/messages.json` se sklada primo ve sdilene serverove implementaci `pushover-core` a Next.js `server-only` wrapper zustava oddeleny od standalone worker importu.
- Pro nové provozní approve/reject odkazy jsme nepřidávali žádnou další knihovnu; bezpečnost flow dál stojí na existujícím Node.js `crypto`, Prisma transakcích a Next.js App Router server actions.
- Ochrana proti `Failed to find Server Action` nepřidává novou knihovnu; používá vestavěné Next.js `deploymentId`, provozní env konfiguraci `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` a lokální observability helper v `instrumentation.ts` pro sanitizované shrnutí `next-action` headeru.
- Refaktor HTML šablony admin notifikace také nepřidává žádnou knihovnu; email-safe layout je ručně skládaný přes inline styly a prezentační tabulky.
- Ani zákaznická `.ics` příloha po potvrzení rezervace nepřidává novou knihovnu; používá lokální iCalendar utility a stávající SMTP vrstvu přes `nodemailer`.
- UX/copy refaktor potvrzovacího klientského e-mailu `booking-approved-v1` také nepřidává novou knihovnu; layout dál používá ručně skládané email-safe HTML s inline styly a stávající `.ics` attachment pipeline.
- Sjednocení booking e-mailů do jednoho design systému nepřidává žádnou knihovnu; HTML shell, karty, CTA i text/plain fallbacky zůstávají ručně skládané v `src/lib/email/templates.ts` nad existujícím Node/Prisma/Nodemailer stackem.
- Přepojení booking e-mailových kontaktů na `SiteSettings` nepřidává žádnou knihovnu; používá existující `getPublicSalonProfile()` / `getEmailBrandingSettings()` helpery a lokální HTML escapování.
- Nová owner notifikace `admin-booking-rescheduled-v1` při self-service přesunu rezervace nepřidává žádnou knihovnu; používá existující outbox `EmailLog`, renderer šablon a `SiteSettings.notificationAdminEmail`.
- Jediný 24h reminder rezervací také nepřidává novou knihovnu; scheduler, token workflow i outbox zápis používají stávající Next.js/Prisma/Node stack a existující `email:worker`.
- Admin přesun termínu také nepřidává novou knihovnu; drawer UI, auditní log i doménová validace běží čistě na stávajícím stacku Next.js, React, Prisma a Zod.
- Interní čas na úklid po službě nepřidává žádnou novou knihovnu; jde o rozšíření Prisma modelů `Service` a `Booking`, existující Zod validaci, stávající admin formulář/server actions a úpravy stávající booking/planner logiky.
- Refaktor detailu rezervace do decision panelu také nepřidává novou závislost; sticky header, action chooser, kompaktní summary card i zkrácená historie používají jen stávající Next.js App Router, React a Tailwind utility.
- Klientský self-service přesun termínu také nepřidává novou knihovnu; veřejná manage route, secure token flow a potvrzovací panel běží čistě na stávajícím stacku Next.js, React, Prisma a Zod.
- UX refaktor klientského self-service přesunu termínu také nepřidává novou knihovnu; hybridní seznam, kalendář, sticky mobilní souhrn, smooth scroll i Matomo eventy používají stávající React/Next primitives a lokální helpers.
- Přístupnost kontaktního kroku veřejného booking flow nepřidává žádnou knihovnu; používá nativní HTML vazby `label`/`aria-describedby`, React JSX a stávající Tailwind utility.
- Prefill klientky z admin detailu do ruční rezervace také nepřidává novou knihovnu; používá jen existující Next.js App Router search params, serverové read modely, React state a stávající booking drawer/action workflow.
- Ruční vytvoření rezervace v adminu také nepřidává novou knihovnu; drawer, deduplikace klientky i sdílené create jádro běží čistě na stávajícím stacku Next.js, React, Prisma a Zod.
- Normalizace a čitelné zobrazení telefonu klientky nepřidává žádnou novou knihovnu; pravidla jsou lokální TypeScript helper nad existující server-side validací.
- Uvolnění e-mailu u ruční rezervace také nepřidává novou knihovnu; změna stojí jen na Prisma migraci, Zod validaci a úpravě sdíleného booking engine.
- Booking submission audit využívá stejnou Prisma vrstvu a nezavádí další knihovnu pro rate limiting ani logování.
- Audit změn cen služeb také nepřidává novou závislost; používá stávající Prisma model, admin session mapování a server actions.
- UX refaktor pracovního přehledu `Rezervace` také nepřidává novou závislost; klikací statistiky, URL-driven filtr toolbar i seskupení seznamu používají jen stávající Next.js App Router, `next/form`, React a Prisma vrstvu.
- Admin login rate limit také nepřidává novou závislost; používá stávající Prisma model `BookingSubmissionLog` a vestavěný Node.js `crypto` pro hash fingerprintů.
- Stabilizační refaktor `booking-public`, `booking-flow` a `admin-slots` také nepřidává žádnou novou runtime ani dev dependency; jde čistě o přesun stávající logiky do menších interních modulů.
- Modul `Média` také nepřidává žádnou novou závislost; upload, metadata, filtr typů i publish stav běží na stávajícím stacku Next.js, React, Prisma, Zod, Node filesystem a `image-size`.
- UX refaktor `Média` také nepřidává žádnou novou závislost; dropzóna, tabs s počty, quick publish/unpublish i kompaktní edit dialog běží na stávajících React/Next primitives.
- Rozdělení portrétů na `PORTRAIT_HOME` a `PORTRAIT_ABOUT` také nepřidává žádnou novou závislost; používá stávající `MediaAsset` model, Prisma enum a public media helpery.
- Veřejná stránka `/studio` nepřidává žádnou novou závislost; galerii skládá z existující media vrstvy a `next/image`.
- Hardening `/studio` proti orphan media záznamům nepřidává žádnou novou závislost; používá stávající `localMediaStorage` a Node `fs` pro dev-only fallback `public/dev/studio/*`.
- Samostatný typ média pro `/kontakt` nepřidává žádnou novou závislost; jde pouze o rozšíření Prisma enumu `MediaType` a existující media vrstvy.
- Matomo integrace také nepřidává žádnou novou závislost; helper a CTA wrappers jsou lokální TypeScript/React moduly.
- Google Ads tag také nepřidává žádnou novou závislost; integrace používá pouze vestavěný `next/script` a lokální tracker helper.
- FAQPage JSON-LD a rozšířená FAQ stránka nepřidávají žádnou novou závislost; schema se generuje lokálním helperem a accordion zůstává na nativním HTML `details/summary`.
- Matomo dashboard reporting také nepřidává žádnou novou závislost; `src/lib/analytics/matomo.ts` je server-only wrapper nad Reporting API.
- Databázový základ voucherů nepřidává žádnou novou závislost; jde čistě o Prisma modely, enumy, migraci a budoucí doménovou vrstvu v `src/features/vouchers`.
- Provozní editace a ruční zrušení voucheru nepřidává žádnou novou knihovnu; server actions a formuláře používají stávající Next.js App Router, React `useActionState`, Prisma a Zod.

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
- Ruční backfill strukturovaných textů služeb v DB nepřidává žádnou novou knihovnu; `scripts/backfill-service-copy.ts` používá existující `tsx`, `dotenv`, Prisma klienta a `@prisma/adapter-pg`.
- Admin sekce `Nastavení` a singleton `SiteSettings` byly doplněné bez nové knihovny; zůstáváme na stávajícím stacku Next.js, React, Prisma a Zod.
- Owner ICS feed pro Apple Kalendář byl přidaný bez nové závislosti; generování `.ics`, escapování i line folding běží v lokální utilitě nad standardním Node/TypeScript stackem.
- Klientská `.ics` příloha používá stejnou lokální iCalendar utilitu; nepřidávali jsme Google SDK, `.ics` generator balík ani novou mail knihovnu.
- Admin role-aware dashboardy používají jen existující Next.js, Prisma a React primitives; nepřidávali jsme další admin UI knihovnu ani CMS vrstvu.
- Nový operativní admin dashboard overview také běží bez nové ikonové nebo chart knihovny; používá Tailwind utility classes, lokální SVG ikony a serverový read model nad existující Prisma vrstvou.
- Konsolidace owner/salon admin route wrapperů do shared factory patternu proběhla bez přidání nové knihovny.
- Přestavba owner sekce `Přístupy` také zůstává bez nové UI nebo auth závislosti; používá jen stávající Next.js server actions, React klientské komponenty, Prisma a Zod.
- Invite aktivace a DB hesla pro admin přístupy byly přidané bez nové auth knihovny; tokeny i hash hesel běží na vestavěném Node.js `crypto` (`sha256`, `scrypt`).
- Admin workflow pro služby (seznam, filtry, editace a validační vrstva) bylo doplněné čistě nad existujícím stackem Next.js, React, Prisma a Zod.
- Rozšíření katalogu o public/pricing metadata zůstává čistě v současném stacku Prisma + Next.js server actions; nepřidává CMS, feature flag službu ani externí content backend.
- Ruční výběr doporučených služeb pro homepage zůstává v modelu `Service` a admin server actions; nepřidává CMS ani externí personalizační nebo analytickou službu.
- Přepracované workflow `Služby` a `Kategorie služeb` (create CTA, quick actions, reorder, warningy, mobilní list/detail flow) zůstává bez nové UI nebo drag-and-drop závislosti; běží čistě na stávajícím stacku Next.js, React, Prisma a Zod.
- Nový dark workspace `Kategorie služeb` používá jen React 19 primitives (`useActionState`, `useOptimistic`, `startTransition`) a nepřidává žádný drawer, icon ani form helper balík.
- Přepnutí desktop detailů `Služby` a `Kategorie služeb` na pravý overlay drawer také nepřidává žádnou UI knihovnu; zůstáváme na lokálních React komponentech a Tailwind utilitách.
- Lokální media storage vrstva zůstává na stávajícím stacku Next.js, Prisma a Node filesystemu; `sharp` přidává jen lehkou upload-time normalizaci a varianty bez CDN a bez komplexního responsive image systému.

## Pravidla aktualizací
- Minimálně 1x měsíčně zkontrolovat bezpečnostní a major update.
- Před major updatem ověřit kompatibilitu a sepsat dopad.

## Provozní poznámka
- `node_modules` neni distributovany artefakt. Do repozitare ani prenosovych ZIP/TAR balicku nepatri.
- Reprodukovatelna instalace zavislosti na serveru je pouze `npm ci` z aktualniho `package-lock.json`.
- `npm run dev` a `npm run build` nyní automaticky spouštějí `prisma generate`, aby admin sekce nepoužívaly zastaralý Prisma klient po změnách schématu `EmailLog` a dalších modelů.
- Týdenní planner dostupností, batch create, inline quick edit slotu i sekundární day workspace byly implementované bez nové závislosti; zůstáváme na stávajícím stacku Next.js, React, Prisma a Zod.
- Synchronizace publikovaného konceptu týdne používá novou server action nad existující Prisma vrstvou; nepřibyla žádná fronta, websocket vrstva ani další persistence systém.
- `dotenv` a `prisma/config` jsou potřeba i proto, že Prisma 7 CLI čte `DATABASE_URL` a `SHADOW_DATABASE_URL` mimo runtime validaci Next.js aplikace.
- Týdenní planner dostupností byl postavený bez nové závislosti; zůstáváme na stávajícím stacku Next.js, React, Prisma a Zod.
- DST hardening pro `Europe/Prague` nepřidává žádnou novou knihovnu; používá stávající `Intl.DateTimeFormat`, Prisma `DateTime` instants a lokální TypeScript helpery.
