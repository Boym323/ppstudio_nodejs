# Deployment

Postup nasazení aplikace do produkce.

## Release checklist
1. `npm ci`
2. Ověř správné produkční env proměnné (`DATABASE_URL`, `ADMIN_SESSION_SECRET`, admin bootstrap účty)
3. Zálohuj databázi, pokud release obsahuje novou Prisma migraci.
4. `npm run db:generate`
5. `npm run db:migrate`
6. `npm run lint`
7. `npm run build`
8. Aktualizuj `CHANGELOG.md`
9. Ověř aktuálnost dokumentace (`MANUAL.md`, `docs/*`)
10. Projdi ruční QA veřejného webu na mobilu i desktopu:
   - homepage
   - služby a detail služby
   - kontakt
   - FAQ a právní stránky
   - CTA na rezervaci
11. Projdi ruční QA admin částí:
   - login redirect pro `OWNER` a `SALON`
   - dostupnost owner-only sekcí jen pro `OWNER`
   - lite admin navigaci a mobilní čitelnost na `/admin/provoz/*`

## Nasazení
1. Pull nové verze na server.
2. Instalace závislostí (`npm ci`).
3. Generování Prisma klienta (`npm run db:generate`).
4. Aplikace databázových změn (`npm run db:migrate`).
5. Build (`npm run build`).
6. Restart procesu aplikace.

## Poznámky k DB migracím
- Migrace `20260418184500_schema_v1_booking_core` převádí legacy `BookingRequest` na `Booking` a backfilluje nové tabulky.
- Migrace `20260418193000_booking_model_review_fixes` přidává explicitní slot restriction mode a DB constraint proti překrývajícím se aktivním slotům.
- Před produkční aplikací migrace ověř data, která by mohla mít rezervaci bez přiřazené služby; tato migrace takové řádky záměrně odmítne.
- Pokud v databázi existují duplicitní rezervace stejného klienta do stejného slotu, nová migrace se zastaví a vyžádá jejich ruční vyčištění.
- Pokud nasazuješ jen frontend bez DB změn, `npm run db:migrate` zůstává bezpečný no-op.

## Rollback
1. Návrat na předchozí commit/release tag.
2. `npm ci && npm run db:generate && npm run build`
3. Pokud release obsahoval migraci, ověř kompatibilitu rollbacku s databází.
4. U datově transformačních migrací rollback neprováděj naslepo; nejdřív ověř, zda starší aplikace umí pracovat s novým schématem.
5. Restart procesu.
6. Ověření funkčnosti.
