# Ochrana prostředků při release

## Závěr incidentního šetření

Incident z 27. 10. 2026 prokazuje časovou shodu mezi náročným release buildem,
vyčerpáním prostředků LXC a timeouty PostgreSQL. Z dostupných produkčních údajů
ale nelze dokázat, že build timeouty způsobil. PostgreSQL nebyl restartován a
nebyl zachycen OOM kill; proto je bezpečný závěr pouze tento: release build byl
provozní konkurent a neměl mít možnost spotřebovat téměř celý rozpočet LXC.

Toto PR zavádí ochranu dostupnosti, neprezentuje ji jako důkaz původní příčiny.

## Implementovaná ochrana

Před zastavením writerů běží `npm ci`, Prisma preflight, lint, typecheck,
`test:release` a `next build` v transientním systemd cgroup scope. Výchozí
limity jsou záměrně konzervativní pro produkční LXC s 5 GiB RAM a 2 vCPU:

| Limit | Výchozí hodnota | Účel |
| --- | ---: | --- |
| `CPUQuota` | `100%` | nejvýše jeden vCPU pro release preflight |
| `CPUWeight` | `20` | nízká relativní priorita proti běžným službám |
| `IOWeight` | `20` | nízká relativní priorita blokového I/O |
| `MemoryHigh` | `2800M` | tlak na reclaim/throttling před kritickým limitem |
| `MemoryMax` | `3G` | selhání buildu místo vytlačení živé aplikace |
| `TasksMax` | `512` | ochrana proti nekontrolovanému počtu workerů |
| `Nice` | `10` | nižší CPU priorita uvnitř přiděleného rozpočtu |

`MemoryMax` není OOM ochrana celé LXC: při překročení selže pouze scope
release. Systemd nebo cgroup v2 musí nastavení přijmout; při nepodporovaném
hostiteli release skončí před prvním dlouhým krokem. Do nechráněného běhu lze
přejít jen explicitně pro DEV diagnostiku:

```bash
PPSTUDIO_RELEASE_CGROUP_MODE=off \
PPSTUDIO_RELEASE_ALLOW_UNSCOPED=1 \
PPSTUDIO_RELEASE_UNSCOPED_TARGET=DEV \
NODE_ENV=development \
./deploy/release.sh --skip-pull --yes
```

Validace tento režim odmítne v `NODE_ENV=production` i bez ohledu na ostatní
flagy; mimo `development`/`test` navíc vyžaduje přesný cíl `DEV`. Tento režim se
na produkci nepoužívá. Hodnoty lze pro experiment změnit přes
`PPSTUDIO_RELEASE_CPU_QUOTA`, `PPSTUDIO_RELEASE_CPU_WEIGHT`,
`PPSTUDIO_RELEASE_IO_WEIGHT`, `PPSTUDIO_RELEASE_MEMORY_HIGH`,
`PPSTUDIO_RELEASE_MEMORY_MAX`, `PPSTUDIO_RELEASE_TASKS_MAX` a
`PPSTUDIO_RELEASE_NICE`.

### Next.js a Turbopack

Next.js 16.4.3 dokumentuje volby `--turbopack`/`--webpack` a diagnostické
profilování, ale neposkytuje podporovaný obecný přepínač pro maximální počet
build workerů. Do release se proto nepřidává nezdokumentovaný `TURBOPACK_*`
nebo `NODE_OPTIONS` workaround. Build zůstává na výchozím Turbopacku a
paralelismus je omezen na úrovni cgroup, kde zahrne i všechny jeho child
processy. Dokumentovaná filesystem cache pro build je ve v16.4.3 výchozí;
její účinek se musí posuzovat měřením cold/warm buildů a velikosti I/O, ne
předpokladem, že warm cache vždy sníží tlak na LXC.

Ochrana nemění systemd unity webu ani workeru, jejich RAM, šifrovací klíče,
DB konfiguraci nebo pořadí migrací. Staging release dál vzniká mimo `current`;
build ani preflight proto nepotřebují zastavit živý web. Migrace a voucherový
bootstrap zůstávají mimo build scope a stále se spouštějí až po zastavení a
ověření writerů.

## Ověření na DEV

Ověřeno 27. 10. 2026 v DEV checkoutu:

- Debian LXC, systemd `257.13`, cgroup v2 (`cgroup2fs`)
- dostupné controllery `cpu`, `io`, `memory`, `pids` a `cpuset`
- DEV vidí 4 vCPU a 16 GiB RAM, tedy **nereprezentuje** produkční limit 2 vCPU / 5 GiB
- transientní scope s `CPUQuota=50%`, `CPUWeight=20`, `IOWeight=20`,
  `MemoryHigh=256M`, `MemoryMax=512M` a `TasksMax=128` byl přijat a hodnoty
  byly potvrzeny přes `systemctl show`
- nebyla použita produkční URL, produkční databáze ani produkční LXC

Toto ověření potvrzuje podporu mechanismu v DEV, nikoli jeho účinek na
produkční latenci. Před prvním produkčním použitím musí operátor stejným
read-only probe ověřit cgroup delegaci konkrétního LXC.

### Audit aktivního scope

V aktivním DEV scope `ppstudio-dev-cgroup-audit-17304` byl 27. 10. 2026
naměřen skutečný cgroup v2 stav. Hodnoty `memory.*` jsou rozpočet a součet
celého scope; RSS je pouze rezidentní paměť sledovaného procesu a nelze jej
zaměňovat za paměť cgroup:

| Metrika | Naměřená hodnota | Výklad |
| --- | ---: | --- |
| `cpu.max` | `100000 100000` | kvóta 100 %, jeden vCPU |
| `memory.high` | `2936012800` B | 2800 MiB |
| `memory.max` | `3221225472` B | 3 GiB |
| `memory.current` | `271929344` B | přibližně 259 MiB, celý scope |
| `memory.peak` | `809975808` B | přibližně 772 MiB, celý scope |
| RSS sledovaného procesu | `269180` KiB | přibližně 263 MiB, jeden proces |

`memory.events` během aktivního scope obsahovalo `low=0`, `high=0`, `max=0`,
`oom=0`, `oom_kill=0`, `oom_group_kill=0` a `sock_throttled=0`. Proces skončil
úspěšně a jeho cgroup byl `/system.slice/ppstudio-dev-cgroup-audit-17304.scope`.
Jde o ověření mechanismu na DEV; DEV má 16 GiB RAM a 4 vCPU, takže z něj nelze
odvodit produkční SLO ani vyloučit tlak na produkční LXC.

## Měřicí protokol

Každé srovnání se provádí v novém DEV release workspace a minimálně ve dvou
variantách: bez scope (pouze s explicitním diagnostickým opt-inem) a s výchozím
scope. Pro obě varianty se zaznamená:

- cold build, warm build, poškozená cache a build s nedostupnou cache
- maximální RSS a exit status buildu (`/usr/bin/time -v`)
- CPU čas a wall-clock build time
- `memory`, `cpu` a `io` PSI z `/proc/pressure/*`
- diskové I/O přes `iostat -xm 1` nebo ekvivalentní hostitelský nástroj
- HTTP p50/p95/p99, timeouty a HTTP chyby na DEV smoke endpointu
- úspěšnost a latence read-only `SELECT 1` požadavků na DEV PostgreSQL

Příklad monitorovacího okna:

```bash
# pouze DEV; DATABASE_URL musí mířit na lokální/testovací PostgreSQL
vmstat 1
iostat -xm 1
watch -n 1 'cat /proc/pressure/cpu /proc/pressure/memory /proc/pressure/io'

# v odděleném terminálu opakuj pouze read-only požadavky
for i in $(seq 1 100); do
  psql "$DATABASE_URL" -XAtqc 'SELECT 1' >/dev/null || echo "DB_FAIL $i"
done
```

Výsledky se zapisují do PR nebo incidentního protokolu jako dvojice měření,
nikoli jako odhad. Bez měření se nesmí tvrdit zrychlení ani zlepšení p95.

### Naměřený DEV probe 27. 10. 2026

Probe běžel v dočasném workspace s fyzickou kopií `node_modules`, build-time
env mířil na `127.0.0.1` a DB kontrola používala pouze `sudo -u postgres psql
-d postgres -XAtqc 'SELECT 1'`. HTTP byl syntetický lokální endpoint; nebyla to
homepage aplikace. Cold scénář před buildem vyčistil `.next/cache`.

| Varianta | Výsledek | Wall time | CPU | Max RSS | DB read-only |
| --- | --- | ---: | ---: | ---: | ---: |
| baseline cold, 2 vCPU / 5G | úspěch | 1:46,21 | 165 % | 1 615 MiB | 120/120 |
| baseline warm, 2 vCPU / 5G | úspěch | 0:40,57 | 182 % | 1 409 MiB | neměřeno |
| scope warm, 1 vCPU / 3G | úspěch | 1:08,11 | 99 % | 1 389 MiB | neměřeno |
| scope cold, `MemoryHigh=2800M`, `MemoryMax=3G` | úspěch | 2:45,15 | 96 % | 1 649 MiB | 120/120 |
| scope warm s poškozeným `.sst` cache souborem | fail-closed, `Panic in async function` | 0:06,40 | 89 % | 378 MiB | neprováděno |

V obou cold scope měřeních byl současně spuštěn lokální HTTP fixture; po jeho
startu proběhlo 120/120 HTTP požadavků s HTTP 200. V optimalizované cold variantě
byl nejvyšší zaznamenaný desetiminutový PSI vzorek přibližně CPU
`some/full=53,50/48,43 %`, memory `16,74/15,52 %`, I/O `0,54/0,54 %`.
Jde o snapshot celého DEV LXC, nikoli pouze cgroup buildu, a obsahuje jiné
procesy hostitele; hodnoty proto nejsou produkční SLO.

Předchozí experiment s `MemoryHigh=2G` měl při stejném buildu cgroup memory
current přibližně 2,4 GB a byl po 7:07 ručně přerušen v TypeScript fázi. Tento
výsledek byl důvodem pro změnu soft limitu na `2800M`; hard cap `3G` zůstal.
Naměřená data tedy dokazují trade-off mezi CPU/časem buildu a izolací, nikoli
kauzální odstranění produkčního incidentu.

Warm cache je v tomto DEV workspace rychlejší než cold cache, ale poškozený
Turbopack `.sst` soubor vedl k fail-closed pádu. Produkční release proto cache
mezi novými staging workspace automaticky nekopíruje: každý release má
reprodukovatelný cold fallback a selhání cache nemůže aktivovat neúplný artefakt.
Případné budoucí sdílení cache musí nejdřív přidat validaci, atomickou obnovu a
samostatné měření I/O; zrychlení warm buildu samo o sobě není důvodem vystavit
release společné poškozené cache.

### Finální provozní regresní běh PR #91 na DEV

Byl spuštěn skutečný `next start` nad lokální databází `ppstudio_dst_test` a
souběžně omezený `next build` v systemd scope s výchozími limity tohoto PR.
Běh nepracoval s produkční URL, produkční databází ani produkčními writery.

| Route | Požadavků | HTTP chyby | p95 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| `/` | 485 | 0 | 68,559 ms | 874,995 ms |
| `/sluzby` | 485 | 0 | 64,799 ms | 199,301 ms |
| `/api/health` | 485 | 0 | 9,440 ms | 65,919 ms |

Build skončil s exit statusem 0 za `3:05,05`. Read-only PostgreSQL probe
proběhl 485/485 krát bez chyby; po běhu byl PostgreSQL `active`, v cílové DB
bylo `1 active` a `4 idle` spojení. Serverový log neobsahoval chyby podle
kontroly `error|exception|failed|terminated`.

U tohoto souběžného běhu se po ukončení scope nepodařilo získat jeho aktivní
cgroup cestu, proto z něj není uváděn `memory.events` ani OOM závěr. OOM stav
je doložen pouze výše uvedeným samostatným aktivním scope probe, kde byly
všechny OOM čítače nulové. `/usr/bin/time` obalený kolem `systemd-run` rovněž
není použit jako náhrada za celkovou paměť cgroup.

Regresní test s mockem `systemd-run` ověřuje předání všech limitů, pracovního
adresáře a prostředí, exit status příkazu i fail-closed chování. Při chybě
mocku nevznikne marker nechráněného příkazu; statická kontrola pořadí zároveň
potvrzuje, že `RELEASE_WRITERS_STOPPED=1` i zastavení writerů následují až po
úspěšném buildu. Chyba `systemd-run` se tak nemůže změnit v nechráněný běh ani
v předčasné zastavení produkčních writerů.

## Srovnávané varianty a rozhodnutí

| Varianta | Stav | Rozhodnutí |
| --- | --- | --- |
| Build ve staging adresáři bez limitu | původní chování | nepřijatelné pro 5 GiB / 2 vCPU, protože může soupeřit s živým webem o celý LXC |
| Build ve staging adresáři v systemd cgroup | implementováno | výchozí DEV/prod release cesta; případné překročení limitu failne před migrací |
| Build na produkci po zastavení webu | existující fallback | neřeší dostupnost během dlouhého buildu a nemá být standard |
| Build mimo produkční LXC + přenos artefaktu | doporučení pro další krok | vhodné, pokud se prokáže shoda Node, ABI, architektury, build-time env a integrity artefaktu |

## Bezpečný artefaktový release mimo LXC

CI/DEV build je preferovaná další varianta, ale toto PR jej automaticky
nenasazuje. Přenos musí obsahovat zdrojový release, `.next`, `node_modules`
nebo reprodukovatelný install z lockfilu podle cílového ABI, `.release-env` až
na cíli a manifest SHA-256. Cíl před aktivací ověří:

1. Node.js/npm major a přesnou architekturu/OS ABI,
2. shodu `package-lock.json` a native modulů (`sharp`, `@napi-rs/canvas`, Prisma),
3. build-time `NEXT_PUBLIC_*` hodnoty a stabilní
   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`,
4. podpis nebo SHA-256 manifestu, úplnost souborů a bezpečné vlastnictví,
5. lokální health/smoke test, rollback symlinku a kompatibilitu migrací.

Bez těchto kontrol je lokální build na produkci pomalejší, ale reprodukovatelnější
než nasazení artefaktu s neověřenými nativními závislostmi.

## Doporučený rollout

1. Na DEV proveď baseline/optimalizovanou dvojici cold/warm/cache-failure měření
   podle protokolu výše.
2. Na produkčním hostiteli ověř read-only cgroup probe bez aplikace a bez DB zápisu.
3. Před release potvrď CI checky, čistý working tree, zálohu DB/storage a Node 24.
4. Použij `./deploy/release.sh`; neaktivuj `PPSTUDIO_RELEASE_CGROUP_MODE=off`.
5. Při selhání limitu, buildu, migrace, bootstrapu nebo smoke testu ponech
   fail-closed rollback a neobcházej jej ručním startem starého runtime nad
   neověřeným schématem.
