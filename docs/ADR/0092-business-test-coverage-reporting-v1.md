# ADR 0092: Business Test Coverage Reporting v1

## Stav
Accepted

## Kontext
- Projekt měl E2E scénáře a řadu lokálních `node:test` souborů, ale nebylo zřejmé, jaké je skutečné pokrytí business logiky.
- Původní `npm test` předával shelli nequoted glob `src/**/*.test.ts`; v běžném Bash nastavení se tak nespouštěl celý strom testů.
- Potřebujeme levně zpřehlednit pokrytí zejména pro rezervační flow, e-mailovou logiku a admin provoz bez migrace na jiný runner.

## Rozhodnutí
- Zachovat stávající stack `node --test` + `tsx`.
- Opravit test discovery přes quoted glob `src/**/*.test.ts`.
- Přidat `c8` jako coverage vrstvu nad existující runner.
- Coverage report cílit především na business moduly:
  - `src/features/booking/lib/**/*.ts`
  - `src/features/admin/lib/**/*.ts`
  - `src/features/admin/actions/**/*.ts`
  - `src/features/vouchers/lib/**/*.ts`
  - `src/lib/email/**/*.ts`
- Generovat reporty `text-summary`, `html`, `lcov` a `json-summary` do `coverage/`.
- Coverage běh držet bez `RUN_DB_INTEGRATION_TESTS=1`, aby zůstal lehký a spustitelný i bez lokální DB.

## Důsledky
- Tým má rychlý a opakovatelný přehled nad unit/business pokrytím bez přestavby testovací infrastruktury.
- `npm test` dál ověřuje plnou sadu včetně DB integračních testů tam, kde jsou prostředím povolené.
- Coverage čísla nebudou reprezentovat celé UI nebo E2E vrstvu; záměrně měří hlavně serverovou business logiku.
