# DST audit – DEV opravy

## Planner

FullCalendar 7 může pro jediné uvolnění ukazatele vyvolat `dateClick` i `select`.
Oba callbacky sdílejí původní DOM událost. Planner si její identitu uchovává ve
`WeakSet`; nezávisí na rychlosti počítače, sítě ani pořadí callbacků. Nové gesto
včetně opačné operace nad stejným rozsahem má novou událost. FIFO, serializovatelná
transakce, ochrana bookingů a idempotentní `operationId` zůstávají aktivní.
No-op ukládá `AvailabilityOperation` pro bezpečný retry, ale nemění sloty,
nevytváří audit a nenabízí undo. Při retry se příznak skutečné změny odvodí z existence jejího auditu;
nevyžaduje to změnu schématu ani interpretaci textu zprávy.

## PostgreSQL a historická data

Aplikační PrismaPg i samostatné zapisovací skripty posílají startup parametr
`options=-c timezone=UTC` na každé nově otevřené spojení. Parametr se připojí za
případné existující URL options, které mají v `pg` přednost před PoolConfig.
Platí tedy i pro nové klienty rozšířeného poolu, raw SQL a databázové
`DEFAULT CURRENT_TIMESTAMP`. Nesmí se následně volat session `SET TIME ZONE`
mimo izolované diagnostické testy. Pro provoz doporučujeme navíc UTC na roli
a databázi; změna administrátorských defaults sama nestačí na již otevřený pool.

Read-only kontrola DEV `ppstudio_dev` / role `ppstudio_dev` při auditu:
session `Etc/UTC`, role bez `rolconfig`, bez override v `pg_db_role_setting`.
Žádné ALTER ROLE / ALTER DATABASE nebylo nad touto DB provedeno. Na samostatné
lokální DB/roli jsme ověřili také kombinace DB=UTC / role=Europe/Prague,
DB=Europe/Prague / role=UTC a DB=Europe/Prague / role bez override. Aplikační
spojení měla vždy UTC; tuto pomocnou DB i roli jsme pak odstranili. Integrační
regrese ověřuje tři souběžná spojení při výchozím UTC i Europe/Prague,
Prisma zápis/čtení, raw INSERT i DB default. `26. 10. 2026 06:00–06:30`
v Praze odpovídá `2026-10-26T05:00:00Z–05:30:00Z`.

Tato oprava nepřepisuje žádný existující timestamp ani nemění typ sloupců.
Dlouhodobě doporučujeme samostatně plánovanou migraci absolutních okamžiků na
`timestamptz` (`@db.Timestamptz(3)`), nikoli migraci lokálních obchodních hodin:

1. Pořídit ověřitelnou zálohu, inventuru timestamp sloupců a jejich writerů.
   Určit původ a skutečnou konvenci každé historické skupiny (Prisma, raw SQL,
   databázový default, import). Timestamp bez zóny sám tuto informaci nenese.
2. Data prokazatelně uložená jako UTC převádět explicitním
   `old_timestamp AT TIME ZONE 'UTC'`, nikoli implicitním castem podle session.
   Historické lokální pražské hodnoty převádět podle doložené provenience přes
   `AT TIME ZONE 'Europe/Prague'`. Podzimní dvojznačné a jarní neexistující časy
   vyžadují porovnání s logy/zálohami a zaznamenané rozhodnutí; nehádat offset.
3. Preferovat nové stínové sloupce, oddělený backfill a porovnání epoch,
   vazeb booking/slot, délek, řazení a počtů před přepnutím. Během přechodu
   zajistit konzistentní zápisy nebo krátké řízené zastavení writerů.
4. Ověřit defaulty, indexy, exclusion constraints, Prisma adaptér, raw SQL,
   exporty i DST scénáře v UTC a Europe/Prague. Přepnout až po shodě a připravit
   rollback s uchováním původních hodnot i mapy případných korekcí.


## Reminder

Mechanismus je nezměněný: 25–26 skutečně uplynulých hodin, nikoli stejná lokální
hodina předchozího kalendářního dne. Testy ověřují běžný den, jarní i podzimní
DST, včetně hranic okna a termínu 26. 10. 2026 v 06:00 v Praze. Catch-up
po výpadku zůstává zachován podle dosavadní implementace.

## Naměřené výsledky a kontroly na DEV (25. 10. 2026)

Výchozí `main` byl po `git fetch origin main` shodný s `origin/main`:
`feb85f65412e6086f8f2cc7f12fcb47ff75993f5`. Opravy jsou na samostatné větvi
`fix/dev-dst-audit`. Testovací fixture a úklid běžely v lokální
`ppstudio_dst_test`; skutečný DEV `ppstudio_dev` byl použit pro read-only kontrolu
konfigurace a dočasný UTC read/write probe (odstraněn).

| Scénář | Před: operace / audity | Po: operace / audity |
| --- | --- | --- |
| Jedno kliknutí 26. 10. 2026 06:00–06:30, studený DEV | 2 / 2 | 1 / 1 |
| No-op ADD + REMOVE a retry ADD | 2 / 2 | 2 / 0 |
| Ztracená odpověď po commitu + retry | — | 1 / 1 při 2 HTTP pokusech |
| Kliknutí + drag během čekání na síť + undo | — | 3 / 3 (2 změny + 1 undo) |

„Operace“ znamená počet uložených `AvailabilityOperation`; HTTP retry může
přijít opakovaně se stejným klíčem. První reprodukované dvojité kliknutí mělo
2 serverové ADD požadavky a 2 audity, z nichž druhý měl prázdný rozdíl slotů.
Po zahřátí původního DEV se vyskytl i běh s jediným požadavkem: původní
400ms ochrana tedy závisela na načasování. Oprava rozlišuje identitu události.
No-op má záměrně idempotentní záznam, nikoli audit změny. Nezměnily se žádné
existující timestampy ani databázové schéma.

Prošlé kontroly:

- Původní společný DEV audit: `npm test` dokončil 945 unit a 342 DB integračních testů; část DEV-only testů byla následně oddělena do samostatného PR. Výsledky finální větve potvrzuje GitHub CI.
- `npm run typecheck`, `npm run lint` a cílený lint později upravených testů.
- `npm run pretest:e2e` → `npm run build`, se samostatným `.next-e2e`,
  produkčním režimem bundlu a izolovaným DEV/test prostředím. Žádný deployment.
- DST sada (planner time + reminder): 19/19 v `TZ=UTC` a 19/19 v
  `TZ=Europe/Prague`. Reminder zůstal beze změny.
- Prisma/raw SQL/default timestamp integrace: 2/2, tři různá spojení poolu
  v každém scénáři. Samostatně ověřeny 3 kombinace timezone role/databáze.
- Skutečný DEV: Prisma read/write a DB default s UTC session.
- Planner Playwright regresní scénáře na Chromium a Mobile Chrome prošly: desktopové i dotykové gesto pro 26. 10. 2026 vytvořilo 1 operaci / 1 audit. Ověřeno také FIFO při zadržené síti, drag, undo a ztracená odpověď po commitu.
- `npm run db:check-migrations`, `npm run changelog:check -- --base feb85f65412e6086f8f2cc7f12fcb47ff75993f5`
  a `git diff --check`.

Úplné výstupy jednotlivých běhů jsou v `/tmp/ppstudio-dst-results/`.
Finální souhrn je v `npm-test-verified.log`, `additional-db-tests.log`,
`build-verified.log`, `typecheck-final.log` a `browser-verified.log`; původní počty jsou v `baseline-counts.json` a
`before-noop.log`. Starší neúspěšné pracovní běhy zůstávají odděleně.

Zbývající omezení: timestampy bez zóny nadále vyžadují konvenci UTC; původ
historických skupin musí objasnit až budoucí migrace. Ostatní E2E oblasti nebyly
součástí cílených DEV browser testů; úplné pokrytí ověřuje GitHub CI.

## Změněné soubory

- `CHANGELOG.md`
- `docs/AVAILABILITY_PLANNER.md`
- `docs/DST_AUDIT.md`
- `scripts/backfill-service-copy.ts`
- `scripts/check-migration-history.mjs`
- `scripts/clear-booking-data.mjs`
- `scripts/import-services.mjs`
- `scripts/media-library-v2-backfill.ts`
- `scripts/repair-legacy-chained-slots.mjs`
- `src/features/admin/components/admin-weekly-planner-lab-client.test.ts`
- `src/features/admin/components/admin-weekly-planner-lab-client.tsx`
- `src/features/admin/components/planner-lab-gesture.test.ts`
- `src/features/admin/components/planner-lab-gesture.ts`
- `src/features/admin/components/planner-lab-save-queue.ts`
- `src/features/admin/lib/admin-slots/mutations.integration.test.ts`
- `src/features/admin/lib/admin-slots/mutations.ts`
- `src/features/admin/lib/admin-slots/types.ts`
- `src/features/booking/lib/booking-reminders.test.ts`
- `src/lib/postgres-utc.integration.test.ts`
- `src/lib/postgres-utc.test.ts`
- `src/lib/postgres-utc.ts`
- `src/lib/prisma.ts`
- `tests/e2e/planner-lab.spec.ts`
