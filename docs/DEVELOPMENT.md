# Podrobná Vývojová Dokumentace

Tento dokument slouží jako detailní technická dokumentace vývoje.

## Architektura
- `src/app` obsahuje pouze routy, layouty a route handlers.
- `src/components` drží čistě sdílené stavební prvky.
- `src/features` seskupuje konkrétní produktové oblasti:
  - `home`
  - `booking`
  - `admin`
- `src/lib` obsahuje infrastructure kód bez prezentační logiky.
- `src/config` drží metadata, navigaci a validované prostředí.

## Route Strategie
- `(public)` pro prezentační web.
- `(booking)` pro rezervace bez míchání admin logiky.
- `(admin)` pro backoffice.
- Další vnitřní route group `(protected)` uvnitř adminu chrání sekce vyžadující session.

## Auth Strategie
- Login probíhá přes `src/app/api/auth/login/route.ts`.
- Validace přihlašovacích údajů je server-side přes Zod.
- Session payload je podepsaný JWT token v `httpOnly` cookie.
- `src/proxy.ts` řeší rychlé odfiltrování nepřihlášených návštěv adminu.
- Role-based autorizace se dokončuje uvnitř serverových helperů v `src/lib/auth/session.ts`.
- Lite admin účet se v aplikaci hlásí přes bootstrap env proměnné, ale nese databázovou roli `SALON`.

## Konvence
- Route soubory držet tenké, byznys logiku přesouvat do `features` a `lib`.
- Komponenty pojmenovávat podle odpovědnosti, ne podle umístění na stránce typu `Section1`.
- Server-side validaci preferovat před klientskými závislostmi.
- Nezakládat univerzální `utils` složky ve feature vrstvách bez jasné potřeby.

## Technický dluh a rozhodnutí
- Klíčová rozhodnutí zapisuj jako krátké ADR záznamy.
- Uveď důvod, alternativy a dopad.

## Datová Vrstva
- Prisma schema definuje v1 základ pro správu služeb, slotů, klientů a rezervací.
- Prisma 7 CLI konfigurace je v `prisma.config.ts`, ne v `schema.prisma`.
- `AdminUser` zůstává oddělený od klientských kontaktů; klientská vrstva je modelovaná přes `Client`.
- `AvailabilitySlot` je navržený jako ručně publikovatelný termín s kapacitou a stavem zveřejnění.
- `AvailabilitySlot` má explicitní `serviceRestrictionMode`, takže admin rozhraní pozná rozdíl mezi slotem bez omezení a slotem, který čeká na výběr služeb.
- Vazba `AvailabilitySlotService` umožňuje omezit slot jen na vybrané služby bez zabetonování schématu na jednu službu na slot.
- `Booking` ukládá snapshot jména služby, ceny a času, takže historické rezervace zůstanou konzistentní i po úpravě katalogu.
- `Booking` drží i reschedule chain přes self-relation, což zjednodušuje reporting i provozní dohled nad přesunutými termíny.
- `BookingStatusHistory` drží auditní stopu změn stavu včetně aktéra a strukturovaných metadat.
- `BookingActionToken` ukládá hash tokenu, expiraci a použití/revokaci pro bezpečné self-service storno nebo přesun termínu.
- `EmailLog` je připravený na notifikační workflow a troubleshooting komunikace s klientem.
- `Setting` je generická tabulka pro serverově spravované konfigurační hodnoty bez nutnosti přidávat nové sloupce.

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
  - `npm run build`
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

## Poznámky k releasu
- Release checklist.
- Migrační kroky (pokud jsou potřeba).
