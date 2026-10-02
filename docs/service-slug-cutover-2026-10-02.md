# Service Slug Cutover 2026-10-02

Tento cutover přejmenovává pouze veřejné slugy existujících služeb. `Service.id`, rezervace, vouchery ani jejich historické snapshoty nemění.

## Princip

Pro každý starý slug vznikne jedinečný `ServiceSlugAlias`. Veřejný detail i předvyplněná rezervace starý slug rozpoznají a přesměrují na kanonickou URL s novým slugem. Sitemap, nové odkazy, Matomo a Meta Pixel používají nový kanonický slug.

## DEV → PROD

1. Aplikujte migraci `20261002094529_add_service_slug_aliases` a nasaďte kód resolveru aliasů.
2. Zkontrolujte plán podle stabilních `serviceId`, očekávaných a cílových slugů. Cílový slug nesmí používat žádná jiná služba ani alias.
3. Spusťte dry-run:

   ```bash
   npm run service-slug:cutover-2026-10-02 -- --file <plan.json>
   ```

   Všechny řádky musí vrátit `expectedMatches: true` a `alreadyApplied: false`.
4. V produkci po schváleném dry-runu spusťte jediný proces s `PPSTUDIO_ALLOW_SERVICE_SLUG_CUTOVER_PROD=1`:

   ```bash
   npm run service-slug:cutover-2026-10-02 -- --file <plan.json> --execute --confirm=service-slug-cutover-2026-10-02
   ```

5. Ihned zopakujte dry-run. Každý řádek musí vrátit `alreadyApplied: true`.
6. Ověřte starý detail i starou `?service=` rezervaci, kanonický detail, sitemapu a nové Matomo eventy.

Zápis je serializovatelný a fail-closed. Částečně aplikovaný nebo neočekávaný stav odmítne; plně aplikovaný plán je no-op.

## Historická analytika

Existující Matomo a Meta Pixel záznamy se nepřepisují. Od cutoveru se zapisují nové slugy; v historických Matomo reportech případně dočasně spojte staré a nové hodnoty.
