# ADR 0117: Release quality gates

## Stav

Accepted

## Kontext

- Produkční `deploy/release.sh` ověřoval Prisma, lint a build, ale neprováděl samostatný TypeScript typecheck.
- Repozitář už má v GitHub Actions oddělené joby `typecheck`, `test` a `e2e`; při správně nastavených required status checks jsou před releasem povinné.
- `npm test` aktivuje databázové integrační testy a Playwright E2E provádějí zapisující scénáře. Release helper načítá produkční `.env`, proto by jejich lokální spuštění v něm mohlo zapisovat do produkční databáze.

## Rozhodnutí

- Do bez-zápisového preflightu release helperu zařadit `npm run typecheck` a následný `npm run test:release` mezi lint a build. `test:release` nezapíná `RUN_DB_INTEGRATION_TESTS`, takže nemůže zapisovat do produkční databáze.
- Jako podmínku produkčního releasu nadále vyžadovat úspěšné CI checky databázového `test` a `e2e` pro stejný commit prostřednictvím GitHub branch protection nebo rulesetů.
- Databázové integrační testy ani E2E nespouštět automaticky v `deploy/release.sh`, dokud nemají izolovanou release databázi a testovací prostředí.

## Důsledky

- TypeScript i unit/regresní test release zastaví před buildem, migrací i přepnutím runtime, aniž by otevřel produkční DB.
- Databázové integrační a E2E regrese zůstávají blokující na bezpečně izolovaných CI službách PostgreSQL.
- Operátor musí před produkčním releasem ověřit úspěch povinných GitHub checků.
