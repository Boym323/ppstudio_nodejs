# ADR 0117: Release quality gates

## Stav

Accepted

## Kontext

- Produkční `deploy/release.sh` ověřoval Prisma, lint a build, ale neprováděl samostatný TypeScript typecheck.
- Repozitář už má v GitHub Actions oddělené joby `typecheck`, `test` a `e2e`; při správně nastavených required status checks jsou před releasem povinné.
- `npm test` aktivuje databázové integrační testy a Playwright E2E provádějí zapisující scénáře. Release helper načítá produkční `.env`, proto by jejich lokální spuštění v něm mohlo zapisovat do produkční databáze.

## Rozhodnutí

- Do bez-zápisového preflightu release helperu zařadit `npm run typecheck` mezi lint a build.
- Jako podmínku produkčního releasu vyžadovat úspěšné CI checky `test` a `e2e` pro stejný commit prostřednictvím GitHub branch protection nebo rulesetů.
- Testy ani E2E nespouštět automaticky v `deploy/release.sh`, dokud nemají izolovanou release databázi a testovací prostředí.

## Důsledky

- TypeScript regresi release zastaví před buildem, migrací i přepnutím runtime.
- Unit, integrační a E2E regrese zůstávají blokující na bezpečně izolovaných CI službách PostgreSQL.
- Operátor musí před produkčním releasem ověřit úspěch povinných GitHub checků.
