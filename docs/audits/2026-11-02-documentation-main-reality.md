# Kontrola souladu dokumentace s main – 2. 11. 2026

## Rozsah a zdroje
- Výchozí commit: `47a0b949a8412e35e56b6886a304258bcdaab2db` na `main`, verze `3.38.3` dle `package.json`, `README.md` a `CHANGELOG.md`.
- Staticky ověřené zdroje: `src/features/admin/components/admin-weekly-planner-lab-client.tsx`, `src/features/admin/components/planner-lab-week.ts`, `src/features/admin/actions/slot-planner-actions.ts`, `src/features/admin/lib/admin-slots/time.ts`, `src/features/booking/components/booking-flow.tsx`, `src/features/booking/actions/create-public-booking.ts`, `package.json` a ADR 0118.
- **Nejedná se o ověření nasazené produkce, živé databáze ani browserové regresní testy.**

## Potvrzený stav
- OWNER/SALON používají společný FullCalendar s režimy `view/add/remove` a FIFO autosave. Výchozí desktop je Po–Pá, mobil Den; mobil má výšku `auto`, posuv stránky a long-press výběr. Rozsah 06:00–20:00; mřížka 30 min a snap 15 min.
- Kopírování dne/týdne, hromadná publikace konceptu a pravý inspektor **nejsou v produkčním UI**. Starší ADR tyto postupy zachovávají jen historicky.
- Veřejný booking má čtyři kroky; dostupnost se kontroluje znovu při zápisu. Doporučených termínů je maximálně čtyři na mobilu a šest na desktopu.
- Hlavní verze runtime: `next 16.4.3`, `react 19.3.1`, `prisma 7.10.1`, Node 24.
- Dvojitá čísla ADR `0026` a `0090` jsou vědomá historická výjimka podle `docs/ADR/README.md`. Používej úplné názvy souborů.

## Dokumentace aktualizovaná při kontrole
- `MANUAL.md`: současné režimy a mobilní ovládání planneru, autosave, odstraněné akce a správný DST QA postup.
- `docs/AVAILABILITY_PLANNER.md`, `docs/BOOKING_FORM.md`: hlavní kódové kontrakty a chování UI ověřeny pro 3.38.3.
- `ARCHITECTURE.md`, `docs/DEPENDENCIES.md`: reověření stacku a odstranění neplatného popisu inspektoru.
- `docs/ADR/0089-prague-time-dst-booking-v1.md`, `docs/ADR/README.md`: oddělení historických postupů od dnešního workflow.

## Údržba
Při další změně najdi zdroj pravdy v kódu, `prisma/schema.prisma`, `package.json` a `package-lock.json`. Datum tohoto auditu samo o sobě nedokazuje aktuálnost po dalším releasu. U čistě dokumentačních změn postačí ověřit diff a relativní odkazy, bez celé E2E sady.
