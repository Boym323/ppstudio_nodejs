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

## DEV přihlášení

Offline příkaz:

```sh
NODE_ENV=development PPSTUDIO_DEV_BOOTSTRAP=1 npm run admin:bootstrap-dev < /bezpecna/cesta/dev-heslo.txt
```

Heslo musí mít nejméně 12 znaků. CLI připraví pouze vyhrazený účet
`dev-planner@example.test`, ID `dev-bootstrap-planner-owner`; opakované spuštění
obnoví jeho DEV heslo. Nevyužívá produkční účty ani hesla. Před importem Prisma
ověřuje DEV runtime, explicitní opt-in, privátní DB host a název databáze
`ppstudio…_dev` nebo `ppstudio…_test`. Produkční runtime či běžný produkční DB
název odmítne. Webový auth bypass neexistuje; přihlášení používá běžné heslo,
session, rate limit a oprávnění. Stejně jako ostatní provozní CLI předpokládá
správně označené prostředí a důvěryhodný přístup k jeho konfiguraci.

## Hydratace a caret-color

Ve zdrojích aplikace ani browser testech před auditem není writer `caret-color`.
Playwright screenshotter (`playwright-core/lib/coreBundle.js`, větev `hideCaret`)
naopak nastavuje na `input,textarea,[contenteditable]` inline
`caret-color: transparent !important` a po screenshotu jej obnovuje. Takový
zásah před dokončením hydratace může vytvořit atributový mismatch. Je to doložený
externí writer; bez původní auditní trace nelze tvrdit, že způsobil právě původní
hlášení. Nepřidáváme `suppressHydrationWarning` ani plošné mazání stylů.
Regrese v čistém Chromium bez rozšíření kontroluje serverové HTML, hydratovaný
DOM a konzolové chyby loginu a veřejné rezervace před screenshoty.

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
konfigurace, dočasný UTC read/write probe (odstraněn), vyhrazený testovací účet
(ponechán) a čistý hydratační browser test s vlastní službou (odstraněna).

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

- `npm test`: 945 úspěšných unit testů a 342 DB integrací, bez chyb.
  Jeho 3 původně přeskočené auth testy a 1 integrace vyžadující module mocks
  byly následně spuštěny s `RUN_DB_INTEGRATION_TESTS=1` a
  `--experimental-test-module-mocks`: všechny 4 prošly bez skipu.
- `npm run typecheck`, `npm run lint` a cílený lint později upravených testů.
- `npm run pretest:e2e` → `npm run build`, se samostatným `.next-e2e`,
  produkčním režimem bundlu a izolovaným DEV/test prostředím. Žádný deployment.
- DST sada (planner time + reminder): 19/19 v `TZ=UTC` a 19/19 v
  `TZ=Europe/Prague`. Reminder zůstal beze změny.
- Prisma/raw SQL/default timestamp integrace: 2/2, tři různá spojení poolu
  v každém scénáři. Samostatně ověřeny 3 kombinace timezone role/databáze.
- Skutečný DEV: Prisma read/write a DB default s UTC session, nové testovací
  přihlášení a čistá hydratace v Chromium na skutečném `next dev`.
- Relevantní Playwright specs `planner-lab`, `hydration` a `dev-login` na
  Chromium + Mobile Chrome: 11 úspěšných běhů, 9 vynechaných kombinací podle
  cílového zařízení; každý scénář proběhl na určeném projektu. Desktopové i
  dotykové gesto pro 26. 10. 2026 vytvořilo 1 operaci / 1 audit.
  Browser regrese ověřily kliknutí, FIFO při zadržené síti, drag, undo a
  ztracenou odpověď po commitu. Screenshotový writer `caret-color` byl
  zachycen pomocí MutationObserver; čistá hydratace nehlásila mismatch.
- `npm run db:check-migrations`, `npm run changelog:check -- --base feb85f65412e6086f8f2cc7f12fcb47ff75993f5`
  a `git diff --check`.

Úplné výstupy jednotlivých běhů jsou v `/tmp/ppstudio-dst-results/`.
Finální souhrn je v `npm-test-verified.log`, `additional-db-tests.log`,
`build-verified.log`, `typecheck-final.log`, `browser-verified.log` a
`hydration-actual-dev.log`; původní počty jsou v `baseline-counts.json` a
`before-noop.log`. Starší neúspěšné pracovní běhy zůstávají odděleně.

Zbývající omezení: timestampy bez zóny nadále vyžadují konvenci UTC; původ
historických skupin musí objasnit až budoucí migrace. Bez původní auditní trace
nelze přiřadit původní hydratační hlášení konkrétnímu externímu zásahu, i když
Playwright writer je prokázán. DEV bootstrap spoléhá také na správně označené
prostředí a názvy databází. Ostatní E2E oblasti ani WebKit nebyly součástí
tohoto cíleného browser běhu.

## Změněné soubory

- `AGENTS.md`
- `CHANGELOG.md`
- `docs/AVAILABILITY_PLANNER.md`
- `docs/DEVELOPMENT.md`
- `docs/DST_AUDIT.md`
- `package.json`
- `scripts/backfill-service-copy.ts`
- `scripts/bootstrap-dev-admin.ts`
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
- `src/lib/auth/dev-bootstrap.test.ts`
- `src/lib/auth/dev-bootstrap.ts`
- `src/lib/postgres-utc.integration.test.ts`
- `src/lib/postgres-utc.test.ts`
- `src/lib/postgres-utc.ts`
- `src/lib/prisma.ts`
- `tests/e2e/dev-login.spec.ts`
- `tests/e2e/hydration.spec.ts`
- `tests/e2e/planner-lab.spec.ts`
