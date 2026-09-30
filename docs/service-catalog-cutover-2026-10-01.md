# Service Catalog Cutover 2026-10-01

## Stav auditu kódu

- `Service.id` je stabilný primární klíč a `Booking.serviceId` i `Voucher.serviceId` na něj navazují.
- Nová rezervace ukládá `serviceNameSnapshot` a `servicePriceFromCzk`; přesun rezervace mění pouze termín, ne cenové ani jmenné snapshoty.
- SERVICE voucher má `serviceId`, `serviceNameSnapshot` a `servicePriceSnapshotCzk`. Uplatnění porovnává `serviceId`, proto přejmenování stejného řádku nezpůsobí `SERVICE_MISMATCH`.
- Uplatnění SERVICE voucheru ukládá do `VoucherRedemption.amountCzk` jeho issuance-time `servicePriceSnapshotCzk`; payment summary samostatně kryje aktuální cenu rezervované služby. Jiná služba vrací `SERVICE_MISMATCH`.
- Admin detail nyní zobrazuje samostatně „Při vystavení“ (snapshot voucheru) a „Aktuální služba“ (živá relace `Service`).

Žádná Prisma migrace není potřeba: vyžadované snapshoty i `ServicePriceChangeLog` a `ServiceChangeLog` už existují.

## Audit dat

Tento repozitář neobsahuje ani nepoužil produkční data. Report pro DEV nebo schválenou read-only produkční relaci vytvoří:

```bash
npx tsx scripts/service-catalog-audit-2026-10-01.ts > service-catalog-audit-2026-10-01.json
```

Výstup obsahuje pro každou službu `id`, `slug`, `name`, `publicName`, `priceFromCzk`, `durationMinutes`, počet otevřených SERVICE voucherů, počet budoucích PENDING/CONFIRMED rezervací a seznam všech SERVICE voucherů, kterým chybí `serviceId`, `serviceNameSnapshot`, `servicePriceSnapshotCzk` nebo `serviceDurationSnapshot`; nevyhoví ani prázdný či whitespace název služby. Cutover se nesmí provést, pokud integrity kontrola není `valid: true`.

## Bezpečný postup DEV → PROD

1. Doplňte schválený plán z `scripts/service-catalog-cutover-2026-10-01.example.json`: výhradně existující stabilní `serviceId`, přesné současné hodnoty a cílový název/publicName/cenu. Slug se do plánu nedává a mechanismus jej nemění.
2. V DEV spusťte audit, poté dry-run: `npm run service-catalog:cutover-2026-10-01 -- --file <plan.json>`. Dry-run nic nezapisuje. Každý řádek musí mít `expectedMatches: true` a `alreadyApplied: false`.
3. Proveďte integrační/regresní kontroly a schvalte stejný plán.
4. V produkci nejprve proveďte pouze read-only audit a dry-run s totožným plánem. Znovu ověřte ID, expected values a voucherovou integritu.
5. V plánovaném okně spusťte jediný proces s explicitním ochranným potvrzením a dočasně nastaveným `PPSTUDIO_ALLOW_SERVICE_CATALOG_CUTOVER_PROD=1`: `npm run service-catalog:cutover-2026-10-01 -- --file <plan.json> --execute --confirm=service-catalog-cutover-2026-10-01`.
6. Ihned zopakujte dry-run. Musí vrátit `alreadyApplied: true` pro všechny řádky; záznamy v `ServicePriceChangeLog` a `ServiceChangeLog` musí být právě po jednom na změněný řádek.

Zápis proběhne v jedné serializovatelné transakci. Jakýkoli chybějící řádek nebo mismatch vrátí chybu a rollbackne všechny změny. Opakované spuštění plně aplikovaného plánu je no-op bez duplicitních logů.

## Rollback

Nevytvářejte náhradní/successor služby a neměňte historické booking ani voucher snapshoty. Plán obsahuje v `expected` i `target` vždy název, veřejný název, cenu a `durationMinutes`. Připravte druhý plán se stejnými `serviceId`, jehož `expected` jsou cílové hodnoty prvního plánu a `target` původní hodnoty; nejdříve dry-run, pak stejný explicitně potvrzený execute. Tím vznikne auditovatelný reversní záznam. Pokud mezitím někdo službu upravil, mechanismus rollback bezpečně odmítne a vyžádá nový schválený plán.

## Verdikt

**NOT READY FOR 2026-10-01 CUTOVER** bez konkrétního schváleného mapování `serviceId` → expected/target a bez čistého auditního výstupu z cílové databáze. Implementace je připravena k DEV ověření; žádný cutover ani produkční zápis nebyl proveden.
