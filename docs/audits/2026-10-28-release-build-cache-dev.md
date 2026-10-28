# Audit release build cache na DEV

Datum měření: 2026-10-28<br>
Větev: `fix/release-build-cache-dev-20261028`<br>
Výchozí commit: `8d3a943a` (`main`)<br>
Prostředí: DEV checkout `/var/www/ppstudio`, Node.js `v24.21.0`, npm `11.19.0`, Next.js `16.4.3`

## Rozsah a bezpečnost

Ověření proběhlo výhradně v dočasných DEV staging worktrees pod `/tmp/ppstudio-release-bench.SV2QDh`. Použitý `.env` byl DEV konfigurace; nebyl spuštěn `deploy/release.sh` proti službám, nebyla provedena migrace, změna systemd, aktivace release ani přístup k produkční databázi. Po měření byly dočasné worktrees a cache odstraněny.

Next.js v tomto projektu skutečně vytvářel persistentní Turbopack cache v `.next/cache/turbopack` (naměřená verze adresáře `v16.4.3-29bbeab0`). Do sdílené cache se ukládají pouze `turbopack` a případný `swc`; `.next/cache/fetch-cache` se nepřenáší. Next seed log při warm buildu potvrdil použití seed worktree:

```text
Seeded Turbopack cache from .../.build-cache-worktree/.next/cache/turbopack/v16.4.3-29bbeab0.
```

Konfigurace používá oficiální Next volby `turbopackFileSystemCacheForBuild` a `turbopackSeedCacheFromWorktree`. Relevantní dokumentace: [Turbopack filesystem cache](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache) a [zdroj konfigurace Next.js](https://github.com/vercel/next.js/blob/canary/packages/next/src/server/config-shared.ts).

## Skutečné cold/warm měření

Oba běhy použily stejný DEV hardware, stejné závislosti, `NODE_ENV=production`, `NEXT_DEPLOYMENT_ID=benchmark-dev` a `npm --ignore-scripts run build`. Warm běh proběhl v novém staging adresáři, nikoli opakovaně ve stejné cestě.

| Metrika | A – cold | B/C – warm v jiném stagingu | Rozdíl |
|---|---:|---:|---:|
| Build time | 89,85 s | 72,51 s | −17,34 s (−19,3 %) |
| CPU user + system | 185,09 s | 145,62 s | −39,47 s (−21,3 %) |
| Max RSS | 1 701 980 KiB | 1 551 840 KiB | −150 140 KiB (−8,8 %) |
| File system inputs / outputs | 0 / 1 | 0 / 1 | bez rozdílu |
| Cache restore | — | 755 ms | — |
| Cache save | 1 135 ms | 709 ms | −426 ms |
| Cache na disku, jedna generace | 170 372 383 B | 170 300 234 B | podle obsahu |

Časy CPU, RSS a kernelové file-system counters pocházejí z `/usr/bin/time -v`. Cgroup neměla nastavený limit paměti (`memory.max=max`), proto report uvádí procesní RSS, nikoli limit celé cgroup. Counters `File system inputs/outputs` nejsou velikost přenesených bajtů zařízení a v tomto běhu nebyly vhodnou metrikou diskové propustnosti. Turbopack neposkytl číselný počet znovu použitých výsledků; reuse je doložený seed logem a měřitelným rozdílem build času.

Výsledný `routes-manifest.json` i `required-server-files.json` obsahovaly aktuální `deploymentId: "benchmark-dev"`. Tím je ověřeno, že deployment ID se nepropsalo do invalidace cache, ale stále se promítlo do artefaktu warm buildu. Běh byl úspěšný a vytvořil funkčně použitelný produkční build; byte-for-byte shoda nebyla požadována kvůli deployment metadatům.

Celý produkční release preflight nebyl měřen: jeho spuštění by zahrnovalo kontroly systemd, zastavení writerů, migraci a aktivaci runtime, což bylo mimo povolený DEV-only rozsah. Uvedené časy jsou proto přesně oddělené časy produkčního Next buildu a samostatného restore/save, nikoli fingovaný čas celého nasazení.

## Scénáře A–H

| Scénář | Ověření | Výsledek |
|---|---|---|
| A – Cold build | Reálný `next build` bez cache | Prošel, 89,85 s |
| B – Warm build | Reálný `next build` s Turbopack seedem | Prošel, 72,51 s |
| C – Nový staging adresář | Druhý Git worktree s jinou absolutní cestou | Seed log potvrzen, reuse funguje |
| D – Změna zdroje | Regresní test změny build vstupu v cache klíči | Cache se neobnoví |
| E – Změna konfigurace | Regresní test změny `next.config.ts`, `.env` a package locku | Cache se neobnoví |
| F – Poškozená cache | Tampered soubor + simulovaná chyba `Failed to restore task data` | Pouze stagingová kopie se smaže, právě jeden čistý retry |
| G – `--no-cache` | `USE_BUILD_CACHE=0` v regresním scénáři | Obnova i uložení jsou přeskočené, persistentní Turbopack cache je vypnutá |
| H – Přerušené ukládání | Simulované selhání kopírování | Původní `current` i generace zůstaly použitelné |

Regresní scénáře navíc kontrolují chybějící/neplatná metadata, změnu identifikátoru prostředí, nekompatibilní formát, symlink v cache, atomický pointer, omezení diskové velikosti a fail-closed pořadí oprávnění před odstávkou. Selhání běžné TypeScript kompilace se automaticky neopakuje.

## Závěr a rizika

Na tomto jednom DEV měření je prokázané zrychlení cold → warm buildu v odlišném stagingu o 17,34 s (19,3 % wall time). Výsledek není zobecnitelné SLA; závisí na hardwaru, obsahu změn a stavu OS page cache. Persistentní seed je experimentální Next.js build capability, takže při upgradu Nextu je nutné znovu ověřit log seedování i regresní testy. Další provozní riziko představuje ruční odstranění nebo změna práv adresáře `.build-cache-worktree`; release helper v takovém případě fail-closed pokračuje studeným buildem nebo releasem skončí podle konkrétní chyby. Cache je záměrně oddělena podle prostředí a neobsahuje runtime fetch/ISR data, secrets ani uživatelská data.
