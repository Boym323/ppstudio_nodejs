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
- `src/config/navigation.ts` drží centrální definici admin sekcí, slugů a navigace pro obě role.
- `src/features/admin/components/admin-sidebar-nav.tsx` je klientská navigace s aktivním stavem podle pathname.
- `src/features/admin/components/admin-overview-page.tsx` a `admin-section-page.tsx` renderují role-aware read model nad Prisma daty.
- `src/features/admin/components/admin-email-logs-page.tsx` je owner-only observability obrazovka pro email frontu, retry pokusy a poslední chyby.
- `src/features/admin/components/admin-email-log-detail-page.tsx` a route `/admin/email-logy/[emailLogId]` přidávají detail jednoho logu s payloadem, chybou a operacemi pro ruční retry nebo uvolnění zaseknutého jobu.
- Po úspěšné akci detail vrací server-rendered flash banner přes query parametr, aby obsluha viděla okamžitou zpětnou vazbu bez client state.
- `src/features/admin/lib/admin-data.ts` je čistá serverová read vrstva pro admin dashboardy a sekce.
- Lite admin záměrně nepoužívá technický jazyk ani sekce typu nastavení, email logy nebo správa uživatelů.
- Pro `SALON` držíme kratší menu a na úvodní obrazovce zviditelňujeme dnešní rezervace, nejbližší termíny a rychlé akce pro přidání slotu nebo otevření rezervace.
- `salonAdminNavigation` se skládá ze stejné centrální definice sdílených sekcí jako owner navigace, aby route guardy, dostupné URL a menu nemohly časem ujet od sebe.
- Dynamické admin routy jako `/admin/[section]`, `/admin/provoz/[section]` a `/admin/email-logy/[emailLogId]` mají vlastní layouty se stejným `AdminShell`, aby se neztratil admin vizuál ani ochrana při přímém vstupu na detailní URL.

## Konvence
- Route soubory držet tenké, byznys logiku přesouvat do `features`, `content` a `lib`.
- Komponenty pojmenovávat podle odpovědnosti, ne podle umístění na stránce typu `Section1`.
- Server-side validaci preferovat před klientskými závislostmi.
- Nezakládat univerzální `utils` složky ve feature vrstvách bez jasné potřeby.
- U veřejného webu nepřidávat efektní animace bez jasného UX důvodu.
- Booking mutations držet ve feature service vrstvě a server action používat jen jako tenký vstupní adaptér.

## Technický dluh a rozhodnutí
- Klíčová rozhodnutí zapisuj jako krátké ADR záznamy.
- Uveď důvod, alternativy a dopad.

## Datová Vrstva
- Prisma schema definuje v1 základ pro správu služeb, slotů, klientů a rezervací.
- Prisma 7 CLI konfigurace je v `prisma.config.ts`, ne v `schema.prisma`.
- Runtime Prisma klient používá `@prisma/adapter-pg` + `pg`, protože Prisma 7 vyžaduje pro PostgreSQL explicitní driver adapter.
- `AdminUser` zůstává oddělený od klientských kontaktů; klientská vrstva je modelovaná přes `Client`.
- `AvailabilitySlot` je navržený jako ručně publikovatelný termín s kapacitou a stavem zveřejnění.
- `AvailabilitySlot` má explicitní `serviceRestrictionMode`, takže admin rozhraní pozná rozdíl mezi slotem bez omezení a slotem, který čeká na výběr služeb.
- Vazba `AvailabilitySlotService` umožňuje omezit slot jen na vybrané služby bez zabetonování schématu na jednu službu na slot.
- Import kategorií a služeb je řešený jako JSON upsert přes `scripts/import-services.mjs`; identity záznamů drží `slug`.
- `Booking` ukládá snapshot jména služby, ceny a času, takže historické rezervace zůstanou konzistentní i po úpravě katalogu.
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
- Při další iteraci booking workflow preferuj nové migrace nad ruční editací starších SQL souborů.

## Testování
- Minimální kontrola při každé změně:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- `npm run dev` i `npm run build` nyní před startem automaticky spouští `prisma generate`, takže po změně Prisma schématu nevznikne rozjezd mezi generovaným klientem a runtime admin obrazovkami.
- Pokud měníš e-mail delivery, ověř i `npm run email:worker:once`.
- Při změně veřejného webu navíc ručně ověř:
  - mobilní header a CTA na `/`, `/sluzby`, `/kontakt`
  - správnost interních odkazů v footeru
  - metadata a titulky pro detail služby
- Po změně Prisma schematu navíc:
  - `npm run db:generate`
  - `npm run db:migrate`
  - `npx prisma validate --schema prisma/schema.prisma`

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
