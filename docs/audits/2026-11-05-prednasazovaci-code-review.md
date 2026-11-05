# Přednasazovací code review – revize 5. 11. 2026

> Evidenční záznam doporučení ze statické kontroly GitHubu. Nejde o potvrzené produkční incidenty ani o důkaz dokončení oprav. Stav jednotlivých bodů ověřuj před dalším nasazením v aktuálním `main`.

## Rozsah

- Základ posledního doloženého nasazení: `0bca28181424c5a216e584219ace6294d4525349` (3.39.0).
- Auditovaný `main` před dokumentačními zápisy: `f7ec3d0e41ec4715e8a8343e9e622529a45e4dd6` (31 nových commitů).
- Kontrola byla statická; nebyly při ní spuštěny nové integrační testy ani měření PostgreSQL výkonu.

## 1. Obnova rozpracované veřejné rezervace – opraveno

- Soubor: `src/features/booking/components/booking-flow.tsx`.
- Původní nález: při existujícím konceptu `isRestoringDraft=true` a formulář používá `inert` do dokončení `refreshPublicBookingCatalogAction()`. Chybí vlastní timeout/fallback pro požadavek, který se nikdy nevyřeší.
- Riziko: při dlouho neodpovídajícím požadavku může formulář zůstat neinteraktivní.
- Navržená minimální oprava: časově omezená obnova (cílově např. 5 sekund), bezpečně obnovit jen kontaktní pole, neověřený termín neobnovovat, odblokovat formulář, zachovat standardní serverové ověření při odeslání.
- Implementováno: obnova čeká nejvýše 5 sekund, poté obnoví kontakty bez neověřeného termínu a odblokuje formulář s oznámením. Dokončení proběhne právě jednou; pozdní odpověď se ignoruje a unmount zruší časovače i aplikaci výsledku. Serverová validace, voucher i analytika zůstávají zachované.
- Regrese: `src/features/booking/components/booking-flow/booking-draft.test.ts` ověřuje úspěch, nevyřízený požadavek a timeout, odmítnutí, pozdní úspěch i odmítnutí a unmount. **Stav: opraveno a cílené testy prošly.**

## 2. Cenové snapshoty dokončených rezervací – uzavřeno, neměnit

- Podrobné vysvětlení a produkční SQL ověření: [Audit cenových snapshotů rezervací](2026-11-05-cenove-snapshoty-rezervaci.md).
- Produkční výsledek z 5. 11. 2026: `COUNT(*) = 0` pro `status='COMPLETED'` s oběma `finalPriceCzk IS NULL` a `servicePriceFromCzk IS NULL`.
- Pro doložená dokončená data se fallback na aktuální ceník nepoužije; bez dalšího důkazu není důvod cenovou logiku upravovat. **Stav: uzavřeno.**

## 3. Integrační ověření e-mailů v režimu background – doplněno

- Soubory: `.github/workflows/ci.yml`, `src/features/admin/lib/admin-booking.integration.test.ts`, `src/lib/email/booking-preflight.test.ts`.
- Původní nález: CI nastavovalo `EMAIL_DELIVERY_MODE=log`; testy oznámení `booking-service-changed-v1` zahrnují větvení pro `background`, ale CI standardně neprochází reálné doručení tímto režimem včetně workeru.
- Požadované ověření: izolovaný DB integrační scénář v `background`: fronta `PENDING` → worker, aktuální payload/identita klientky, platnost tokenů, ICS příloha a korektní dokončení/selhání.
- Doplněn samostatný CI krok s `EMAIL_DELIVERY_MODE=background` a filtrem `^background:` v `admin-booking.integration.test.ts`. Používá skutečnou testovací DB, frontu, worker a renderer; provider a chybová externí notifikace jsou nahrazeny fake implementací. SMTP údaje jsou výslovně testovací.
- Devět scénářů ověřuje `PENDING` → worker → `SENT`, identitu klientky v payloadu, službu, cenu a čas, oba odkazy a jejich hashované, platné tokeny, aktualizovanou ICS přílohu bez bearer tokenů, retry a terminální chybu s redakcí odkazů. Zastaralá generace, cena, termín, stav, služba i jméno nesmějí dosáhnout provideru (`system-skip`).
- **Stav: integrační průchod prošel; produkční e-mailová chyba nebyla potvrzena a e-mailová logika se neměnila.**

## 4a. Expirace údajů v sessionStorage – nízká priorita, ponechat

- `src/features/booking/components/booking-flow/booking-draft.ts` kontroluje TTL 30 minut při čtení a neplatný koncept smaže.
- Údaje mohou zůstat v otevřené záložce, dokud nedojde k dalšímu čtení; aktivní timer by byl pouze dodatečný privacy polish.
- Bez incidentu není nutná změna. **Stav: záměrně odloženo.**

## 4b. JSON dotaz na historii ručních výjimek – měřit jen při potížích

- `src/features/booking/lib/booking-slot-compaction.ts`: lookup historie přes `metadata.manualOverrideSlotId`.
- V Prisma schématu `BookingStatusHistory.metadata` není samostatný index pro tuto cestu.
- Bez důkazu dlouhé odezvy z `EXPLAIN (ANALYZE, BUFFERS)` není odůvodněné zavádět index či migraci. **Stav: sledovat, neopravovat preventivně.**

## Rozhodnutí

Body **1 a 3** jsou implementované a cíleně ověřené; před sloučením je nutné ověřit CI výsledného PR. Bod **2 je uzavřený**; **4a a 4b** nepovažovat za release blocker. Implementace a CI: [PR #105](https://github.com/Boym323/ppstudio_nodejs/pull/105).

Lokální ověření na izolované databázi `ppstudio_audit_test`: 50 cílených unit testů, 88 integračních testů admin rezervací a workeru a 9 samostatných background scénářů prošlo. Prošly také TypeScript 7, ESLint dotčených souborů a `changelog:check -- --base origin/main`. Existující test souběhu nyní přijímá oba platné konfliktní kódy (`SLOT_UNAVAILABLE` i `BOOKING_CONFLICT`) při zachování kontroly zákazu překrytí; produkční logiku tato úprava nemění.
