# Podrobná Vývojová Dokumentace

Tento dokument slouží jako detailní technická dokumentace vývoje.

## Architektura
- `src/app` obsahuje pouze routy, layouty a route handlers.
- `src/components` drží čistě sdílené stavební prvky.
- `src/features` seskupuje konkrétní produktové oblasti:
  - `home`
  - `public`
  - `booking`
  - `admin`
- `src/lib` obsahuje infrastructure kód bez prezentační logiky.
- `src/config` drží metadata, navigaci a validované prostředí.
- `src/content` drží editovatelná data veřejného webu odděleně od layoutu a route souborů.

## Route Strategie
- `(public)` pro prezentační web.
- `(booking)` pro rezervace bez míchání admin logiky.
- `(admin)` pro backoffice.
- Další vnitřní route group `(protected)` uvnitř adminu chrání sekce vyžadující session.
- Veřejné booking flow používá server-loaded page + klientský wizard + server action pro finální zápis.
- `/rezervace` používá `connection()` a renderuje se request-time, aby ručně publikované sloty nebyly zafixované do build outputu.
- `src/app/robots.ts` a `src/app/sitemap.ts` používají metadata route API v App Routeru.
- `next.config.ts` používá `allowedDevOrigins` pro lokální LAN vývoj na `192.168.0.143`; bez toho Next.js 16 z jiného zařízení zablokuje dev assety a HMR endpoint `/_next/webpack-hmr`.

## Veřejný Web
- Každá veřejná stránka má vlastní route a metadata.
- Detail služby běží na `sluzby/[slug]` a používá `generateStaticParams`.
- Veřejný obsah je centralizovaný v `src/content/public-site.ts`.
- Reusable page sekce jsou ve `src/features/public/components/public-site.tsx`.
- Placeholder obsah musí být jasně odlišen od finálních produkčních textů.
- CTA na rezervaci držet konzistentně v headeru, hero sekcích a kontextových blocích.

## Auth Strategie
- Login probíhá přes `src/app/api/auth/login/route.ts`.
- Validace přihlašovacích údajů je server-side přes Zod.
- Session payload je podepsaný JWT token v `httpOnly` cookie.
- `src/proxy.ts` řeší rychlé odfiltrování nepřihlášených návštěv adminu.
- Role-based autorizace se dokončuje uvnitř serverových helperů v `src/lib/auth/session.ts`.
- Lite admin účet se v aplikaci hlásí přes bootstrap env proměnné, ale nese databázovou roli `SALON`.
- Pro role-based admin IA používáme dvě serverově chráněné oblasti:
  - `OWNER` na `/admin/*`
  - `SALON` na `/admin/provoz/*`
- Neplatná nebo zakázaná admin sekce se neřeší jen skrytím v menu; routa se validuje server-side přes `src/features/admin/lib/admin-guards.ts`.

## Admin Informační Architektura
- Sekce `volne-terminy` je znovu aktivní jako týdenní planner nad 30min gridem.
- Serverový read/persistence model je v `src/features/admin/lib/admin-slots.ts`.
- Server action adaptéry planneru jsou v `src/features/admin/actions/slot-planner-actions.ts`.
- UI je rozdělené na serverový wrapper `src/features/admin/components/admin-weekly-planner-page.tsx` a klientský kalendář `src/features/admin/components/admin-weekly-planner-client.tsx`.
- Prezentační části planneru jsou dál rozsekané do `src/features/admin/components/admin-weekly-planner-ui.tsx`, aby hlavní klientská komponenta držela hlavně stav a akce.
- `src/config/navigation.ts` drží centrální definici admin sekcí, slugů a navigace pro obě role.
- `src/features/admin/components/admin-sidebar-nav.tsx` je klientská navigace s aktivním stavem podle pathname.
- `src/features/admin/components/admin-overview-page.tsx` a `admin-section-page.tsx` renderují role-aware read model nad Prisma daty.
- Sekce `Služby` má vlastní workflow v `src/features/admin/components/admin-services-page.tsx` a už neběží přes generický placeholder renderer.
- `src/features/admin/lib/admin-services.ts` drží serverový read model pro seznam, filtry, detail služby a navázané kategorie.
- `src/features/admin/actions/service-actions.ts` je tenký server action adaptér pro editaci služby; validace zůstává v `src/features/admin/lib/admin-service-validation.ts`.
- `src/features/admin/components/admin-booking-detail-page.tsx` a route dvojice `/admin/rezervace/[bookingId]` + `/admin/provoz/rezervace/[bookingId]` drží první produkční workflow pro práci s rezervací.
- Produkční slot routy jsou explicitní a nepoužívají generický `[section]` detail:
  - `/admin/volne-terminy`
  - `/admin/volne-terminy/novy`
  - `/admin/volne-terminy/[slotId]`
  - `/admin/volne-terminy/[slotId]/upravit`
  - salon varianta pod `/admin/provoz/volne-terminy/*`
- `src/features/admin/actions/booking-actions.ts` je tenký server action adaptér pro změnu stavu rezervace.
- `src/features/admin/lib/admin-booking.ts` drží detailový read model, mapování povolených přechodů a zápis do `BookingStatusHistory`.
- `src/features/admin/components/admin-email-logs-page.tsx` je owner-only observability obrazovka pro email frontu, retry pokusy a poslední chyby.
- `src/features/admin/components/admin-email-log-detail-page.tsx` a route `/admin/email-logy/[emailLogId]` přidávají detail jednoho logu s payloadem, chybou a operacemi pro ruční retry nebo uvolnění zaseknutého jobu.
- Po úspěšné akci detail vrací server-rendered flash banner přes query parametr, aby obsluha viděla okamžitou zpětnou vazbu bez client state.
- `src/features/admin/lib/admin-data.ts` je čistá serverová read vrstva pro admin dashboardy a sekce.
- Lite admin záměrně nepoužívá technický jazyk ani sekce typu nastavení, email logy nebo správa uživatelů.
- Pro `SALON` držíme kratší menu a na úvodní obrazovce zviditelňujeme dnešní rezervace, nejbližší termíny a rychlé akce pro přidání slotu nebo otevření rezervace.
- `salonAdminNavigation` se skládá ze stejné centrální definice sdílených sekcí jako owner navigace, aby route guardy, dostupné URL a menu nemohly časem ujet od sebe.
- Dynamické admin routy jako `/admin/[section]`, `/admin/provoz/[section]` a `/admin/email-logy/[emailLogId]` mají vlastní layouty se stejným `AdminShell`, aby se neztratil admin vizuál ani ochrana při přímém vstupu na detailní URL.
- Sdílené route wrappery pro owner/salon jsou centralizované v `src/features/admin/lib/admin-route-factories.tsx`; route soubory v `src/app/(admin)/admin/**/page.tsx` mají být jen tenké entrypointy s předáním `area`.
- Sdílený layout wrapper `src/features/admin/components/admin-shell-layout.tsx` je jediný zdroj truth pro admin shell layout v section/slots/email-log/detail větvích.
- Vizuální stabilita adminu je primárně v:
  - `src/components/layout/admin-shell.tsx` (šířky sloupců, sticky sidebar, anti-overflow)
  - `src/features/admin/components/admin-page-shell.tsx` (responzivní nadpisy, stat karty, spacing)

## Konvence
- Route soubory držet tenké, byznys logiku přesouvat do `features`, `content` a `lib`.
- Komponenty pojmenovávat podle odpovědnosti, ne podle umístění na stránce typu `Section1`.
- Server-side validaci preferovat před klientskými závislostmi.
- Nezakládat univerzální `utils` složky ve feature vrstvách bez jasné potřeby.
- U veřejného webu nepřidávat efektní animace bez jasného UX důvodu.
- Booking mutations držet ve feature service vrstvě a server action používat jen jako tenký vstupní adaptér.
- Admin změny stavu rezervace validovat server-side proti povoleným přechodům a nikdy je neřídit jen podle toho, co UI zrovna nabízí v selectu.

## Technický dluh a rozhodnutí
- Klíčová rozhodnutí zapisuj jako krátké ADR záznamy.
- Uveď důvod, alternativy a dopad.

## Datová Vrstva
- Prisma schema definuje v1 základ pro správu služeb, slotů, klientů a rezervací.
- Prisma 7 CLI konfigurace je v `prisma.config.ts`, ne v `schema.prisma`.
- Runtime Prisma klient používá `@prisma/adapter-pg` + `pg`, protože Prisma 7 vyžaduje pro PostgreSQL explicitní driver adapter.
- `AdminUser` zůstává oddělený od klientských kontaktů; klientská vrstva je modelovaná přes `Client`.
- `AvailabilitySlot` je navržený jako ručně publikovatelný termín s kapacitou a stavem zveřejnění.
- Pro admin planner je `AvailabilitySlot` stále hlavní provozní entita; 30min grid je jen editační vrstva nad souvislými intervaly.
- `AvailabilitySlot` má explicitní `serviceRestrictionMode`, takže admin rozhraní pozná rozdíl mezi slotem bez omezení a slotem, který čeká na výběr služeb.
- Vazba `AvailabilitySlotService` umožňuje omezit slot jen na vybrané služby bez zabetonování schématu na jednu službu na slot.
- Veřejný booking flow rezervuje celý `AvailabilitySlot` a kontroluje, že délka slotu pokrývá délku služby; planner proto při ukládání půlhodiny vždy skládá do souvislých oken.
- Planner přímo upravuje jen jednoduché publikované sloty bez rezervací, bez poznámek, bez omezení služeb a s kapacitou `1`; ostatní zůstávají v UI viditelné jako uzamčené nebo neaktivní.
- Import kategorií a služeb je řešený jako JSON upsert přes `scripts/import-services.mjs`; identity záznamů drží `slug`.
- `Booking` ukládá snapshot jména služby, ceny a času, takže historické rezervace zůstanou konzistentní i po úpravě katalogu.
- `Service` nově odděluje obecnou aktivitu (`isActive`) od veřejné rezervovatelnosti (`isPubliclyBookable`); public booking flow vyžaduje obě podmínky a aktivní kategorii.
- `Booking` drží i reschedule chain přes self-relation, což zjednodušuje reporting i provozní dohled nad přesunutými termíny.
- `BookingStatusHistory` drží auditní stopu změn stavu včetně aktéra a strukturovaných metadat.
- `BookingActionToken` ukládá hash tokenu, expiraci a použití/revokaci pro bezpečné self-service storno nebo přesun termínu.
- `EmailLog` je připravený na notifikační workflow a troubleshooting komunikace s klientem.
- `Setting` je generická tabulka pro serverově spravované konfigurační hodnoty bez nutnosti přidávat nové sloupce.
- `src/features/booking/lib/booking-public.ts` je veřejný write model pro rezervace a drží i ochranu proti souběžnému obsazení slotu.
- `src/features/booking/lib/booking-cancellation.ts` drží veřejné storno workflow nad hashovaným action tokenem.
- Veřejný booking flow vrací doménové chybové kódy a doporučený krok formuláře, takže UI může zobrazit přesnější recovery stav bez duplikace serverové logiky.
- Veřejný booking submit má lehký rate limit podle IP a e-mailu a zapisuje auditní log pokusů, blokací a selhání pro provozní troubleshooting.
- Krok 2 veřejného booking flow filtruje sloty i podle délky služby, aby se krátké sloty neukazovaly až v posledním kroku.
- `src/lib/email/*` je samostatná infrastrukturní vrstva:
  - provider řeší SMTP transport
  - templates renderují obsah z `EmailLog.templateKey`
  - worker claimuje `EmailLog` řádky v background režimu a delivery aktualizuje `EmailLog.status`, `provider`, `providerMessageId`, `attemptCount`, `nextAttemptAt` a `errorMessage`

## Migrační Strategie
- Stávající bootstrap migrace rozšiřujeme inkrementálně, ne přepisem historie.
- Migrace `20260418184500_schema_v1_booking_core` zachovává existující booking data:
  - vytvoří `Client` z historických rezervací
  - převádí `BookingRequest` na `Booking`
  - backfilluje snapshot služby a času
  - převádí single-service sloty na M:N omezení služeb
- Migrace `20260418193000_booking_model_review_fixes` doplňuje minimální provozní ochrany:
  - explicitní režim omezení služeb na slotu
  - reschedule chain pro rezervace
  - unique ochranu proti duplicitní rezervaci stejného klienta do stejného slotu
  - PostgreSQL exclusion constraint proti překrývajícím se aktivním slotům
- Nové slot admin workflow nevyžadovalo další migraci; navazuje přímo na už existující schema a constrainty.
- Migrace `20260419103000_service_public_bookability` přidává `Service.isPubliclyBookable` a backfilluje ho podle dosavadního `isActive`, aby se zachovalo chování migrovaných služeb.
- Při další iteraci booking workflow preferuj nové migrace nad ruční editací starších SQL souborů.

## Testování
- Minimální kontrola při každé změně:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- `npm run dev` i `npm run build` nyní před startem automaticky spouští `prisma generate`, takže po změně Prisma schématu nevznikne rozjezd mezi generovaným klientem a runtime admin obrazovkami.
- Pokud měníš e-mail delivery, ověř i `npm run email:worker:once`.
- Při změně veřejného webu navíc ručně ověř:
- Po změně admin katalogu služeb ručně ověř i:
  - `/admin/sluzby` i `/admin/provoz/sluzby` na desktopu a mobilu
  - přepnutí `Veřejně rezervovatelná` a dopad na `/rezervace`
  - změnu délky služby a skrytí slotů, které jsou po změně kratší než služba
  - editaci služby v neaktivní kategorii a očekávané skrytí z veřejného bookingu
  - mobilní header a CTA na `/`, `/sluzby`, `/kontakt`
  - správnost interních odkazů v footeru
  - metadata a titulky pro detail služby
- Po změně Prisma schematu navíc:
  - `npm run db:generate`
  - `npm run db:migrate`
  - `npx prisma validate --schema prisma/schema.prisma`
- Po změně slot admin workflow ručně ověř i:
  - vytvoření kolizního slotu odmítnuté serverem
  - editaci slotu s aktivní rezervací a blokaci neplatného snížení kapacity
  - archivaci pouze bez aktivní rezervace
- Při úpravě lokálního dev serveru nebo `next.config.ts` ručně ověř i otevření aplikace z vedlejšího zařízení v LAN; pokud browser hlásí blokaci `/_next/webpack-hmr`, zkontroluj `allowedDevOrigins` a restartuj dev server.

## Bezpečnost
- Tajné údaje držet pouze v env.
- `ADMIN_SESSION_SECRET` musí mít minimálně 32 znaků.
- Admin routy nikdy neodemykat jen na základě klientského stavu.
- Cancel/reschedule tokeny generovat jako náhodné tajné hodnoty, do DB ukládat pouze jejich hash.
- E-mail a telefon normalizovat na vstupu server-side ještě před zápisem do `Client` a `Booking`.
- Při veřejné rezervaci zamknout slot v transakci a znovu ověřit kapacitu až těsně před vytvořením `Booking`.
- Při serializable konfliktu nebo deadlocku booking flow transakci krátce retryne místo okamžitého pádu na generickou chybu.
- Server-side validace musí znovu ověřit i to, že délka vybrané služby reálně odpovídá délce slotu.
- Pro anti-spam ochranu zapisuj submission logy i pro blokované pokusy, aby šlo dělat provozní audit bez zbytečného přidávání další infrastruktury.
- E-mailové šablony drž jako čisté funkce bez přímé DB závislosti, aby šly jednoduše unit testovat.
- Background worker je provozní proces, ne web request; při nasazení musí běžet odděleně od Next.js serveru.

## Poznámky k releasu
- Release checklist.
- Migrační kroky (pokud jsou potřeba).

## Týdenní plánování slotů
- Hlavní workflow běží na `/admin/volne-terminy` a `/admin/provoz/volne-terminy`.
- Mobil nepoužívá celou stěnu velkých denních karet; týden vybírá přes kompaktní horizontální přepínač dnů a jeden přímý editor vybraného dne.
- Route `novy`, `[slotId]` a `[slotId]/upravit` jsou zachované kvůli kompatibilitě URL, ale přesměrují obsluhu zpět do planneru ve správném týdnu.
- Mřížka používá 28 půlhodinových buněk na den (okno `06:00-20:00`).
- Výpočet začátku týdne musí vycházet z lokálního kalendářního dne `Europe/Prague` (pondělí jako první den), ne z `getUTCDay()` nad UTC půlnocí.
- `createdByUserId` při planner mutacích ber z reálného `AdminUser.id`; bootstrap session identifikátory (`bootstrap-owner`, `bootstrap-staff`) nejsou DB FK a musí fallbacknout na `null`.
- Zápis do DB probíhá přes merge/split logiku:
  - prázdné nebo zelené buňky se z klienta pošlou jako rozsah buněk
  - server z nich spočítá časové hranice v časové zóně `Europe/Prague`
  - den znovu načte ze serveru
  - chráněné intervaly (rezervace, omezení služeb, neaktivní sloty, sloty s poznámkou nebo jinou kapacitou) odmítne měnit
  - zbylé jednoduché publikované sloty smaže a znovu založí jako minimální sadu souvislých intervalů
- Copy day/week přenáší jen běžnou dostupnost; rezervace ani omezené intervaly se nekopírují.
- Jednoduchá týdenní šablona je uložená lokálně v prohlížeči, takže nevyžaduje novou tabulku ani další env.

## Ruční QA pro planner
- Ověř owner i salon variantu `/admin/volne-terminy` a `/admin/provoz/volne-terminy`.
- Ověř přidání jedné půlhodiny kliknutím do prázdného dne.
- Ověř přidání delšího úseku tažením a následné sloučení do jednoho `AvailabilitySlot`.
- Ověř odebrání části dostupnosti ze zeleného bloku a správné rozdělení na zbylé intervaly.
- Ověř, že zásah do rezervace nebo omezeného slotu vrátí srozumitelnou chybu a nic nepřepíše.
- Ověř kopírování dne, kopírování týdne a použití lokální šablony.
