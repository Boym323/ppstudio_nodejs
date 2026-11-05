# Přednasazovací code review – revize 5. 11. 2026

> Evidenční záznam doporučení ze statické kontroly GitHubu. Nejde o potvrzené produkční incidenty ani o důkaz dokončení oprav. Stav jednotlivých bodů ověřuj před dalším nasazením v aktuálním `main`.

## Rozsah

- Základ posledního doloženého nasazení: `0bca28181424c5a216e584219ace6294d4525349` (3.39.0).
- Auditovaný `main` před dokumentačními zápisy: `f7ec3d0e41ec4715e8a8343e9e622529a45e4dd6` (31 nových commitů).
- Kontrola byla statická; nebyly při ní spuštěny nové integrační testy ani měření PostgreSQL výkonu.

## 1. Obnova rozpracované veřejné rezervace – doporučeno opravit, otevřeno

- Soubor: `src/features/booking/components/booking-flow.tsx`.
- Při existujícím konceptu `isRestoringDraft=true` a formulář používá `inert` do dokončení `refreshPublicBookingCatalogAction()`. Chybí vlastní timeout/fallback pro požadavek, který se nikdy nevyřeší.
- Riziko: při dlouho neodpovídajícím požadavku může formulář zůstat neinteraktivní.
- Navržená minimální oprava: časově omezená obnova (cílově např. 5 sekund), bezpečně obnovit jen kontaktní pole, neověřený termín neobnovovat, odblokovat formulář, zachovat standardní serverové ověření při odeslání.
- Doložit testem nevyřízeného požadavku, timeoutu a pozdní odpovědi. **Stav: neopraveno v rámci tohoto auditu.**

## 2. Cenové snapshoty dokončených rezervací – uzavřeno, neměnit

- Podrobné vysvětlení a produkční SQL ověření: [Audit cenových snapshotů rezervací](2026-11-05-cenove-snapshoty-rezervaci.md).
- Produkční výsledek z 5. 11. 2026: `COUNT(*) = 0` pro `status='COMPLETED'` s oběma `finalPriceCzk IS NULL` a `servicePriceFromCzk IS NULL`.
- Pro doložená dokončená data se fallback na aktuální ceník nepoužije; bez dalšího důkazu není důvod cenovou logiku upravovat. **Stav: uzavřeno.**

## 3. Integrační ověření e-mailů v režimu background – doporučeno doplnit, otevřeno

- Soubory: `.github/workflows/ci.yml`, `src/features/admin/lib/admin-booking.integration.test.ts`, `src/lib/email/booking-preflight.test.ts`.
- CI nastavuje `EMAIL_DELIVERY_MODE=log`; testy oznámení `booking-service-changed-v1` zahrnují větvení pro `background`, ale CI standardně neprochází reálné doručení tímto režimem včetně workeru.
- Doplnit izolovaný DB integrační scénář v `background`: fronta `PENDING` → worker, aktuální payload/identita klientky, platnost tokenů, ICS příloha a korektní dokončení/selhání.
- Žádné skutečné e-maily při testu neodesílat, použít fake transport. **Stav: chybějící pokrytí, není potvrzený produkční bug.**

## 4a. Expirace údajů v sessionStorage – nízká priorita, ponechat

- `src/features/booking/components/booking-flow/booking-draft.ts` kontroluje TTL 30 minut při čtení a neplatný koncept smaže.
- Údaje mohou zůstat v otevřené záložce, dokud nedojde k dalšímu čtení; aktivní timer by byl pouze dodatečný privacy polish.
- Bez incidentu není nutná změna. **Stav: záměrně odloženo.**

## 4b. JSON dotaz na historii ručních výjimek – měřit jen při potížích

- `src/features/booking/lib/booking-slot-compaction.ts`: lookup historie přes `metadata.manualOverrideSlotId`.
- V Prisma schématu `BookingStatusHistory.metadata` není samostatný index pro tuto cestu.
- Bez důkazu dlouhé odezvy z `EXPLAIN (ANALYZE, BUFFERS)` není odůvodněné zavádět index či migraci. **Stav: sledovat, neopravovat preventivně.**

## Rozhodnutí

Před dalším release upřednostnit **1 a 3**. Bod **2 je uzavřený**; **4a a 4b** nepovažovat za release blocker. Při navazující implementaci opravit stavové řádky a přidat odkazy na konkrétní PR a testy. Dokumentace sama o sobě není opravou kódu.
