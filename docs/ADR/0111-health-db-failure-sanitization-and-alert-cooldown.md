# ADR 0111: Sanitizace DB health chyby a cooldown alertu

## Kontext

Veřejný `GET /api/health` při nedostupné databázi vracel raw `Error.message`; ten mohl obsahovat host, databázi nebo detail Prisma/ovladače. Každý request navíc synchronně spouštěl owner Pushover alert, takže minutový monitoring mohl vyvolat notifikační bouři a zbytečně prodlužoval `503` odpověď.

## Rozhodnutí

- Veřejný kontrakt pro nedostupný základní DB ping je HTTP `503` a `error.code = DATABASE_UNAVAILABLE`. Pokud ping projde, ale selže pouze následný detailní dotaz health snapshotu nad e-mailovou frontou, kontrakt je HTTP `200`, `status=warning` a `error.code = EMAIL_HEALTH_UNAVAILABLE`.
- Health handler nepředává raw DB chybu ani do veřejného payloadu, ani do textu owner alertu.
- Owner alert `health-db-check` se dispatchuje best-effort bez čekání v requestu a samostatný in-memory cooldown jej v jednom runtime procesu propustí nejvýše jednou za 10 minut.
- Cooldown je fixovaný v kódu; nepřidává novou env proměnnou ani závislost.

## Alternativy

- Perzistentní nebo distribuovaný lock v DB/Redis: zamítnuto pro tento nízkorizikový fix, protože při samotném DB outage není DB lock dostupný a projekt Redis nepoužívá.
- Přesun alertu do samostatné fronty: zamítnuto, protože by vyžadoval nový spolehlivý kanál pro incident právě v době, kdy hlavní DB není k dispozici.
- Zachovat 30s obecný Pushover limit: zamítnuto, protože pro externí monitoring není dostatečný.

## Důsledky

- Monitoring má strojově stabilní a bezpečný signál bez interní diagnostiky.
- Schema drift nebo chyba detailního Prisma dotazu nemění veřejný status na HTTP `500` ani neblokuje release, pokud je základní DB ping funkční; diagnostický objekt se zapisuje pouze do serverového journalu a monitoring dostane `warning`.
- Pushover neprodlužuje health odpověď a při opakovaných requestech nevzniká lokální alert flood.
- V multi-instance provozu může každý proces poslat jeden alert; centrální alerting zůstává odpovědností monitoringu.

## Stav

Schváleno.
