# Deployment

Postup nasazení aplikace do produkce.

## Release checklist
1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. Aktualizuj `CHANGELOG.md`
5. Ověř aktuálnost dokumentace (`MANUAL.md`, `docs/*`)

## Nasazení
1. Pull nové verze na server.
2. Instalace závislostí (`npm ci`).
3. Build (`npm run build`).
4. Restart procesu aplikace.

## Rollback
1. Návrat na předchozí commit/release tag.
2. `npm ci && npm run build`
3. Restart procesu.
4. Ověření funkčnosti.
