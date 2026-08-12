# Migrace optimalizace rozvrhu

## Pevná produktová pravidla

- Automatický oběd trvá přesně 45 minut v časové zóně `Europe/Prague`.
- Kandidátní začátky jsou `11:00`, `11:15`, …, `13:00`; kandidát může končit až ve `13:45`.
- Oběd se odvozuje z aktuální dostupnosti a rezervací. Nikdy se neukládá jako DB rezervace ani pevný blok.
- Existující rezervace se nikdy neposouvají. Booking, reschedule i cancellation proto mohou změnit optimální polohu oběda.
- Cleanup je součástí booking blocku pro obsazenost a feasibility.
- Veřejná rezervace nesmí spotřebovat poslední proveditelný 45minutový oběd v den s aktivní lunch policy.
- Smart optimalizace smí pouze měnit pořadí sekce „Doporučené termíny“. Nesmí odstranit validní termíny, měnit authoritative validaci ani přesouvat klientku mezi dny pouze kvůli efektivitě.
- Žádné ML, solver, externí služba, změna FullCalendaru ani nová npm dependency.

## Aktuální architektura

- `getPublicBookingCatalog` načítá publikovanou dostupnost a aktivní rezervace. Rezervace předává jako `bookedIntervals`, kde `endsAt = blockedUntil ?? scheduledEndsAt`, s cleanup lookahead.
- `buildSlotTimeOptions` vytváří veřejné možnosti. Běžní kandidáti používají krok 30 minut; quarter-hour kandidáti vznikají po koncích rezervací a před začátky rezervací pomocí `ceilToQuarterHour`/`floorToQuarterHour`.
- `booking-flow.tsx` odvozuje `selectableTimeOptions` filtrováním disabled možností. `suggestedSlots` je nyní chronologické: `selectableTimeOptions.slice(0, 6)`.
- `buildSlotTimeOptions` respektuje `slot.capacity`, ale create engine aktuálně vynucuje invariant jediného zdroje pomocí `allowedCapacity = 1`. Reschedule bez override používá nejnižší capacity z pokrytí.
- `scheduledEndsAt` je konec služby viditelný klientce. `blockedUntil` je konec occupancy včetně cleanup; null `blockedUntil` znamená `scheduledEndsAt`. Planner queries i public catalog používají pro konflikty blokovaný konec.
- Public create vstupuje přes `createPublicBooking` s `allowManualOverride: false` a pokračuje do `createBookingWithEngine`. Authoritative kontrola dostupnosti, překryvů, capacity a slotů probíhá uvnitř Serializable transakce po čerstvém načtení a locku slotu.
- Public reschedule jde přes `reschedulePublicBookingByToken` a stejný transakční `rescheduleBooking`. Client-originated manual override se odmítá. Admin reschedule používá stejný engine a při explicitním povolení může vytvořit interní výjimku.
- Admin manual booking používá `createManualBooking`; slot mode předává `allowManualOverride: false`, explicitní manual mode `true`. Existující UI už zobrazuje varování o manual override.
- `PlannerWeekData` obsahuje minutové rozsahy (`availableBlocks`, `cleanupBlocks`, service minutes rezervací) i cell rozsahy. `queries.ts` skládá availability, bookings a cleanup s použitím blocked end. FullCalendar adapter vykresluje bookings a cleanup v 30minutových buňkách, zatímco `displayAvailableIntervals` umí zachovat 15minutová read-only okna. Doménový 45minutový event lze tedy reprezentovat přesnými ISO `start`/`end`, ale současný model buněk nesmí být zdrojem pravdy domény.

## Pravidlo aktivace oběda

Globální auto lunch je `enabled` nebo `disabled`; denní režim je `AUTO` nebo `OFF`. Policy je aktivní pro lokální pražské datum pouze tehdy, když je globálně `enabled`, den není `OFF` a sloučená publikovaná dostupnost dne:

1. má skutečnou součtovou rezervovatelnou kapacitu alespoň 5 hodin (ne pouze rozdíl mezi prvním začátkem a posledním koncem),
2. obsahuje alespoň jeden souvislý 45minutový interval se začátkem mezi `11:00` a `13:00`, a
3. publikovaná dostupnost pokračuje za `13:00` lokálního času.

Druhá podmínka záměrně brání tomu, aby krátký dopolední provoz končící v poledne byl blokován obědem. Pravidlo vychází z publikované dostupnosti, nikoli z odhadované pracovní šablony. Pokud je policy neaktivní, lunch feasibility ani lunch-preservation constraint se nepoužije. Pokud je aktivní, každý veřejný kandidát musí po hypotetickém bookingu ponechat alespoň jeden proveditelný lunch kandidát. Převody lokálního data a času používají na hranicích `Europe/Prague`; čistý engine pracuje s instanty.

Fáze 1 zavádí `booking-schedule-optimization.ts` jako pure in-memory engine: `shouldApplyAutoLunch`, `generateLunchCandidates`, `findAvailableLunchCandidates`, `canPreserveAutoLunch`, `findBestAutoLunch` a `measureFragmentation`. Centrální policy drží délku 45 minut, grid 15 minut, začátky 11:00–13:00, minimum směny 5 hodin a `Europe/Prague`. Fragmentace měří počet a velikost volných bloků a návaznost na obsazenost/hranu availability; service-aware orphan metrika zůstává pro Fázi 5. Capacity větší než 1 se do lunch engine v této fázi nezapojuje; integrační vrstva pro něj později použije explicitní fallback.

## Invarianty

- Oběd je vypočtený výsledek, nikoli uložený konkrétní čas.
- Lunch feasibility používá stejné blokované intervaly jako booking occupancy.
- Optimizer nemění availability, bookings ani množinu validních termínů.
- Stávající booking/business pravidla mimo tuto funkci zůstávají beze změny.
- Authoritative validace zůstává na serveru a opakuje se nad čerstvými transakčními daty.
- Zachovává se date-first pořadí; ranking pouze omezeně přeuspořádá termíny v bezpečném horizontu.
- `scheduledEndsAt` zůstává koncem služby; `blockedUntil` zůstává koncem služby plus cleanup.

## Pure engine API

Konceptuálně přidat `src/features/booking/lib/booking-schedule-optimization.ts`. Musí obsahovat čisté, deterministické funkce bez importů Prisma, Reactu, FullCalendaru nebo env:

```ts
type Interval = { startsAt: number; endsAt: number };
type LunchCandidate = { startsAt: number; endsAt: number };
type BookingBlock = Interval & { capacity?: number };

generateLunchCandidates(input: {
  localDate: string; timeZone: "Europe/Prague";
  availability: Interval[]; stepMinutes: 15;
}): LunchCandidate[]; // přesně 11:00..13:00, délka 45 minut

evaluateLunchFeasibility(input: {
  lunchCandidates: LunchCandidate[]; bookedBlocks: BookingBlock[];
  hypotheticalBlock?: Interval; capacity: number;
}): { feasible: boolean; candidates: LunchCandidate[] };

chooseBestLunchCandidate(input: {
  candidates: LunchCandidate[]; bookedBlocks: BookingBlock[];
  availability: Interval[]; capacity: number;
}): LunchCandidate | null;

measureFragmentation(input: {
  freeIntervals: Interval[]; availability: Interval[];
  bookingBlocks: Interval[]; serviceDurationsMinutes: number[];
}): {
  fragmentCount: number; largestFreeBlockMinutes: number;
  orphanMinutes: number; bookingAdjacencyMinutes: number;
  availabilityEdgeMinutes: number; usableServiceBlockMinutes: number;
};

rankBookingCandidates(input: {
  candidates: Array<{ dateKey: string; startsAt: number; endsAt: number }>;
  evaluate: (candidate: Interval) => { lunch: LunchCandidate | null; metrics: ReturnType<typeof measureFragmentation> };
  safeDateHorizon: number;
}): typeof input.candidates;
```

Implementace může interně používat celočíselné minuty nebo epoch milliseconds, ale musí dokumentovat hranici převodu a stabilní tie-breakery. Authoritative vrstva musí volat stejnou feasibility funkci po načtení čerstvých intervalů; nesmí důvěřovat lunch výsledku dodanému klientem.

## Integrace veřejného bookingu

Catalog/availability projection má po standardním rozšíření o délku služby a cleanup dodat publikované intervaly a blokované booking bloky bez N+1 dotazů. UX filtr odstraní pouze možnosti, které by v aktivní den znemožnily oběd. `selectableTimeOptions` zůstane úplným filtrovaným seznamem; doporučené termíny použijí pouze seřazený pohled. Po refreshi katalogu i při stale selection se výpočet zopakuje.

Server musí nezávisle použít stejné lunch pravidlo v `createBookingWithEngine` těsně před zápisem, po čerstvém načtení slotů a rezervací a po ověření hypotetického booking blocku. Selhání vrací existující typ nedostupnosti/konfliktu a nelze jej obejít vstupem z klienta.

Fáze 2 zapojuje public filtering v `booking-flow.tsx` mezi `buildSlotTimeOptions` a odvození `selectableTimeOptions` pomocí `filterTimeOptionsForAutoLunch`. Stejný filtr používá public availability refresh. `getPublicBookingCatalog` předává v `scheduleOptimization` raw publikované intervaly a aktivní booking bloky; data vznikají ze stejných dávkových dotazů jako dosavadní katalog a konec booking bloku je `blockedUntil ?? scheduledEndsAt`. Filtr seskupí možnosti podle pražského lokálního data, připraví kontext dne jednou a všechny hypotetické booking bloky vyhodnotí čistě v paměti. Nemění pořadí ani výběr `suggestedSlots`.

Authoritative kontrola je ve `createBookingWithEngine` uvnitř stávající `Serializable` transakce bezprostředně před `booking.create`, po ověření coverage, kapacity a duplicitní rezervace klientky. `enforceAutoLunchForBooking` načte raw `PUBLISHED` availability daného pražského dne a poté, jen při aktivní policy, čerstvé aktivní rezervace dne. Hypotetický blok používá `requestedStartsAt → requestedBlockedUntil`. Porušení vrací existující `SLOT_UNAVAILABLE` bez nového veřejného error kódu. Explicitní admin manual override zůstává mimo constraint; public a slot mode jej obejít nemohou.

## Transakční bezpečnost

Uvnitř existující Serializable transakce vypočítat lokální datum, načíst publikované pokrytí daného dne a aktivní booking bloky včetně cleanup, vyhodnotit hypotetický nový blok a vyžadovat zbývající lunch kandidát před `booking.create`. Lockování slotu, overlap checks, capacity checks, idempotency checks i retry chování musí zůstat zachovány. Reschedule provede ekvivalentní kontrolu po vyloučení přesouvané rezervace a před `booking.update`; cancellation nic pro lunch neukládá a další výpočet se přirozeně změní.

Stale test ověřuje, že termín dostupný ve starším katalogu server po mezilehlé rezervaci odmítne. Race test používá dva různé publikované sloty a dvě souběžné rezervace, které jsou jednotlivě validní, společně by však odstranily poslední oběd; projde právě jedna. PostgreSQL konflikt `40001`, který Prisma u raw `FOR UPDATE` vrací jako `P2010`, je zahrnut do stávajícího retry mechanismu. Po retry druhá transakce načte čerstvý committed stav a skončí `SLOT_UNAVAILABLE`; výsledná DB zachová lunch invariant.

Globální přepínač je uložen v singletonu `SiteSettings.autoLunchEnabled` s bezpečným výchozím `true`. Denní režim používá model `AutoLunchDayOverride`, kde `dateKey` je lokální kalendářní datum `Europe/Prague`: absence řádku znamená `AUTO`, jediný ukládaný override znamená `OFF`. Neukládá se žádný konkrétní čas oběda. `loadAutoLunchPolicySnapshot` jedním dávkovým načtením připraví stejný snapshot pro public catalog a v autoritativní transakci pro datum požadované rezervace. Změna globálního nastavení používá existující audit `SiteSettingsChangeLog`; denní změna používá `AvailabilityAuditEvent` se zdrojem `auto-lunch-day-override-v1`. Obě změny invalidují `/rezervace`, takže další veřejné načtení vychází z aktuální konfigurace. Cílené unit/validační testy: 32 PASS; DB integrační testy jsou SKIPPED, protože sdílená vývojová DB má existující Prisma drift a bezpečný reset nebyl proveden.

## Fáze 3A — ověření persistence

- Sdílená DB `ppstudio_dev` měla drift před Fází 3: chyběly jí dřívější historické změny, mimo jiné odstranění `ClientContactConflict`, aktualizace `BookingActionTokenType` a související indexy. Nová migrace v ní nebyla aplikovaná.
- Na izolované dočasné PostgreSQL DB prošlo všech 50 migrací včetně `20260811100000_auto_lunch_policy_persistence`; `prisma migrate diff` proti `schema.prisma` neukázal rozdíl. Migrace správně přidává `SiteSettings.autoLunchEnabled` s defaultem `true` a jediný `OFF` override na `dateKey` bez ukládání času oběda.
- Pět DB integračních testů automatického oběda, včetně stale requestu a race condition, prošlo na izolované DB. Po regeneraci Prisma Clientu byly opraveny chybějící povinné atributy auditní události a testovací fixture `SiteSettings`.
- Produkční `npm run build` po opravě typechecku dokončil a vytvořil `.next/BUILD_ID`; loader policy neprovádí dotaz při importu, pouze při runtime volání.

## Fáze 4 — reschedule a admin

- Veřejný i administrační přesun kontroluje lunch invariant v `rescheduleBookingInTransaction` bezprostředně před `booking.update`.
- Kontrola používá čerstvý snapshot policy a publikovanou dostupnost cílového pražského dne; původní přesouvaná rezervace se z obsazenosti odečítá a nový blok končí v `blockedUntil`.
- Standardní admin slot mode se chová stejně jako veřejný přesun a ruční vytvoření rezervace. Jen explicitní `allowManualOverride: true` v administrativním manual mode může invariant obejít.
- Serializable transakce znovu načte stav při submitu; zamítnutý přesun nevytvoří `BookingRescheduleLog` ani notifikaci. DB integrační ověření je dokončeno ve Fázi 4A.

## Fáze 4A — databázové ověření přesunů

- Byl použit izolovaný PostgreSQL database per běh; všech 50 migrací se aplikovalo a `prisma migrate diff` proti `schema.prisma` nevrátil rozdíl. Sdílená `ppstudio_dev` nebyla měněna a dočasné databáze byly po běhu odstraněny.
- Integrační testy potvrzují přesun s `excludeBookingId`, zachování původní rezervace a absenci `BookingRescheduleLog` při zamítnutí, použití `blockedUntil` pro cleanup i aktuální cílovou policy `OFF`.
- Public stale request po změně stavu a souběžný public reschedule jsou autoritativně ověřeny. Race odhalil, že raw `FOR UPDATE` vrací serializační konflikt jako Prisma `P2010` s vnořeným `originalCode` `40001`; retry byl doplněn a po opakování druhý přesun končí `SLOT_UNAVAILABLE`.
- Admin slot mode invariant chrání; pouze explicitní `allowManualOverride: true` jej může obejít. Relevantní public create stale/race integrační testy z Fáze 2 byly spuštěny znovu.
- Fáze 4: **PASS**.

## Reschedule a admin policy

- Public booking: hard lunch constraint; manual override je false.
- Public reschedule: hard lunch constraint; `changedByClient` jej nikdy nesmí obejít.
- Admin slot mode: standardní lunch constraint (`allowManualOverride: false`).
- Explicitní admin manual mode: může lunch obejít pouze přes existující explicitní manual-override cestu. Zachovat audit flag `manualOverride` a existující warning; případné nové UI varování omezit na „tento manuální termín neponechává proveditelný automatický oběd“ a vyžadovat již existující vědomý manual mode.
- Selhání slot mode se nesmí tiše změnit na manual exception.

## Integrace planneru

Planner má zobrazovat display-only lunch event odvozený z aktuálního stavu vedle booking a cleanup eventů. Nesmí vytvářet availability slot ani booking. Pro doménový výsledek použít přesné minutové/ISO rozsahy; 30minutové buňky ponechat pro stávající editaci a kompatibilitu s FullCalendar. 45minutový oběd se musí vykreslit jako 45minutový event v přesném rozsahu bez zaokrouhlení vstupu. Availability, booking a cleanup musí zůstat oddělenými zdrojovými fakty, aby display oběda nebyl zaměněn za uložený blok.

### Fáze 5 — planner

- Planner načítá publikovanou dostupnost, aktuální booking bloky včetně cleanupu a jeden dávkový policy snapshot týdne; `findBestAutoLunch` výsledek ukládá pouze do odvozených `PlannerDay.autoLunch` dat.
- FullCalendar dostává samostatný read-only event `Oběd · automaticky` s přesnými ISO `start`/`end` hodnotami a délkou 45 minut; 30minutový grid se nemění.
- Ovladač vybraného dne používá existující `updateAutoLunchDayModeAction`: AUTO odstraní OFF override, OFF jej vytvoří, obě změny se auditují přes `AvailabilityAuditEvent` a po změně proběhne `router.refresh`.
- Global OFF deaktivuje denní ovladač a zobrazí informační stav. Aktivní policy bez kandidáta zobrazí admin warning bez falešného eventu. Lunch event nelze dragovat, resizeovat ani uložit do save queue.
- Ověření pokrývá adapter přesnost, AUTO/OFF/global OFF, krátkou směnu, nový booking context, nemožný candidate a regresní editaci planneru.

## Fáze 5B — oprava layoutu planneru

- Příčinou regrese byl počet explicitních CSS grid řádků `.planner`: po vložení `lunchControls` zůstaly definované pouze tři řádky pro čtyři sourozenecké bloky. Ovládání oběda proto skončilo v implicitním řádku za kalendářem a `.calendar` si ve třetím řádku ponechal celý výškový prostor.
- Oprava doplnila samostatný auto řádek pro `lunchControls` v desktopovém i užším layoutu. DOM pořadí zůstává `toolbar`, `legenda`, `lunchControls`, `FullCalendar`; ovládání nemá vlastní velkou výšku ani `flex: 1`.
- FullCalendar sizing, `height="100%"`, `expandRows`, 30minutový grid a 15minutové snapování zůstaly beze změny. Přesný 45minutový lunch event zůstává read-only, dynamický a používá přesné ISO rozsahy.
- Testy: doplněn DOM/CSS regresní test pořadí a gridových řádků; cílené planner/lunch testy prošly 61/61, `typecheck`, ESLint, changelog check i produkční build prošly a `.next/BUILD_ID` byl vytvořen. Vizuální smoke test desktopového Chromium ověřil viditelný grid a navigaci na následující týden; výsledek PASS.

## Model smart rankingu

Pro každý validní kandidát simulovat `existující bloky + hypotetický booking`, vybrat nejlepší proveditelný oběd a změřit výsledné volné intervaly. Řadit podle interpretovatelné lexikografické n-tice:

1. stejný/nejbližší datum v malém bezpečném horizontu (date-first);
2. proveditelný oběd, se stabilním fallbackem na původní pořadí;
3. méně výsledných fragmentů;
4. méně orphan/nevyužitelných minut;
5. větší největší souvislý volný blok;
6. více bloků využitelných aktivními délkami služeb;
7. silnější návaznost na existující rezervace nebo hranu availability, pokud tím fragment uzavřeme;
8. původní chronologické pořadí jako poslední tie-breaker.

V1 hodnotí již načtené kandidáty po jednotlivých dnech a teprve potom vezme prvních šest; mezi dny je proto efektivita nikdy nepřeskočí. Úplný chronologický a filtrovaný seznam zůstává dostupný pod doporučeními. Arbitrární váhy nejsou potřeba; pokud bude později nutný scalar, každá metrika se normalizuje a zdokumentuje při zachování date-first omezení.

## Fáze 6 — chytré doporučování termínů

- `rankSuggestedSlots` v `booking-schedule-optimization.ts` je čistý synchronní in-memory pohled nad již validními kandidáty. Pracuje s publikovanou dostupností, blokovanými intervaly včetně cleanupu a hypotetickým booking blockem; pro aktivní policy do výsledného rozvrhu vloží nejlepší dostupný automatický oběd přes `findBestAutoLunch`.
- Dny zůstávají chronologické podle `Europe/Prague`; pouze uvnitř stejného dne se kandidáti řadí lexikograficky podle menší fragmentace, menší orphan metriky (aktuálně neutrální), většího souvislého bloku, přímé návaznosti na existující blok, návaznosti/hran dostupnosti a nakonec dřívějšího startu. Prázdný nebo neutrální den zůstává chronologický.
- Pokud chybí bezpečný kontext dne nebo je capacity jiná než 1, ranking vrátí původní chronologické pořadí. Nemění `selectableTimeOptions`, nevytváří ani neodstraňuje žádný termín a neprovádí žádné dotazy, requesty ani vedlejší efekty.
- Veřejný nadpis je `Doporučené termíny`; analytika `slot_selected` nebyla rozšiřována, protože v aktuálním booking flow není dostupná.
- Deterministická simulace pokrývá prázdný den, ranní a odpolední rezervaci, rezervace z obou stran, krátkou mezeru, dlouhý blok, aktivní auto lunch a day `OFF`. Potvrdila zachování množiny kandidátů, determinismus, date-first pořadí a preferenci nehorší fragmentace, kde existuje lepší kandidát.

## Strategie capacity

Datový model capacity vystavuje, ale produkční create path dokumentuje a vynucuje jediný service resource (`allowedCapacity = 1`); to je relevantní doména první verze. Lunch feasibility a fragmentation scoring proto nejprve implementovat pro efektivní `capacity = 1`. Pro `capacity > 1` zachovat současnou availability i authoritative capacity logiku a použít chronologický fallback doporučení, dokud nebude specifikována samostatná capacity-aware policy. Capacity pole se nesmí slévat ani přepisovat a výpočet oběda pro jediný zdroj nesmí měnit obecnou capacity sémantiku bookingu.

## Testovací matice

- Generování kandidátů: přesné 15minutové začátky, délka 45 minut, hranice 11:00/13:00, Prague DST a lokální hranice dne.
- Aktivace: den končící v poledne inactive; den pokračující za 13:00 s validním 45minutovým kandidátem active; rozdělená dostupnost bez souvislého oběda inactive.
- Feasibility: booking před, uvnitř a po obědě; cleanup spotřebující poslední kandidát; cancellation obnovující kandidát; existující booking se nikdy neposouvá.
- Public UX: filtrované možnosti, refresh/stale selection, zachování všech validních termínů, doporučení již nejsou pouze chronologická.
- Authoritative create: race o poslední lunch pozici, Serializable retry/conflict, public manual override odmítnut.
- Public/admin reschedule: vyloučení přesouvané rezervace, client hard constraint, admin slot mode hard constraint, explicitní manual mode s warningem a audit flagem.
- Capacity: scoring pro capacity 1; capacity >1 fallback a nezměněné authoritative chování.
- Planner: přesné 45minutové zobrazení, oddělení cleanup, kompatibilita 30minutových buněk, žádný lunch DB slot.
- Integrační cíle: public catalog/create, manual booking, public reschedule, admin reschedule, cancellation a planner-week queries.

## Výkonnostní mantinely

- Relevantní publikovanou dostupnost a aktivní booking bloky načítat po omezených dávkách; nikdy nequeryovat jednou pro každý kandidát nebo službu.
- Pure engine držet v paměti a po seřazení intervalů v lineární nebo `O(n log n)` složitosti; na den generovat nejvýše 9 lunch kandidátů.
- Pokud možno znovu použít již načtený public catalog a provést jeden ranking pass na den.
- Nepřidávat DB entitu oběda, materializovaný blok, externí volání, solver, ML model ani dependency.
- Authoritative transakční query omezit na datum bookingu a zachovat stávající Serializable retries.

## Fázový checklist

### Fáze 1

- [x] Zafixovat activation rule, sémantiku intervalů, capacity rozhodnutí a error contract.
- [x] Přidat pure engine typy/funkce a unit testy bez integračního zapojení.

### Fáze 2

- [x] Přidat catalog/availability projection s publikovanými intervaly a blokovanými booking bloky bez N+1 dotazů.
- [x] Přidat UX feasibility filtering a zachovat chronologické pořadí filtrovaného seznamu termínů.
- [x] Přidat authoritative create check do `createBookingWithEngine` těsně před zápis a ověřit stale/race scénáře.

### Fáze 3

- [ ] Persistence konfigurace: přidat minimální persistenci a administrační ovládání globálního `enabled/disabled` a denního `AUTO/OFF` bez ukládání konkrétního času oběda.

### Fáze 4

- [x] Přidat ekvivalentní kontrolu v transakčním reschedule pro public i admin slot mode; explicitní admin manual mode ji může obejít.

### Fáze 5

- [x] Integrovat display-only lunch stav do `PlannerWeekData`/adapteru přesné minutové rozsahy; neměnit FullCalendar library ani edit-cell sémantiku.

### Fáze 6

- [x] Přidat date-first smart ranking za stávající hranici doporučení, dokončit testovací matici a performance checks a porovnat výstup s chronologickým fallbackem.

## Globální invarianty

- Žádná DB reprezentace konkrétního auto lunch času.
- Žádná změna FullCalendar library.
- Žádné ML, solver ani dependency.
- Authoritative booking validace zůstává na serveru.
- Cleanup používá blocked interval.
- Scoring je pure a in-memory.
- Žádné N+1 query.
- Public booking/business pravidla mimo tuto funkci zůstávají beze změny.

# Final audit

| Oblast | Výsledek | Ověření |
| --- | --- | --- |
| Lunch policy | PASS | Centrální policy: 45 minut, start 11:00–13:00 včetně, krok 15 minut, minimum 5 hodin skutečné publikované kapacity, `Europe/Prague`. Aktivaci neurčují bookingy ani cleanup. |
| Persistence | PASS | `SiteSettings.autoLunchEnabled`, absence `AutoLunchDayOverride` = AUTO, záznam = OFF, návrat na AUTO záznam maže. Konkrétní čas oběda se neukládá. |
| Public filtering | PASS | Lunch filtr následuje po `buildSlotTimeOptions`, pouze odebírá neproveditelné kandidáty a používá již dávkově načtené bloky s `blockedUntil`. |
| Public create | PASS | Authoritative kontrola probíhá nad čerstvými daty uvnitř `Serializable` transakce bezprostředně před `booking.create`; porušení vrací `SLOT_UNAVAILABLE`. |
| Create race | PASS | Izolovaná PostgreSQL DB: ze dvou samostatně validních souběžných zápisů commitne jeden, druhý po serializačním retry skončí `SLOT_UNAVAILABLE`. |
| Reschedule | PASS | Kontrola cílového pražského dne používá `excludeBookingId` a nový blok do `blockedUntil` před `booking.update`. Pokryty AUTO/OFF i krátká cílová směna. |
| Reschedule race | PASS | Izolovaná PostgreSQL DB zachovala lunch invariant; stale i souběžný přesun byly autoritativně odmítnuty bez změny původní rezervace a bez success logu. |
| Admin override | PASS | Slot mode používá povinné `allowManualOverride: false`; explicitní manual mode používá `true` a skutečné obejití lunch constraint ukládá do `Booking.manualOverride`. |
| Planner | PASS | Planner dávkově načítá raw publikovanou dostupnost, occupancy včetně cleanupu a policy; přesný read-only lunch event je pouze odvozený a nemožný oběd vyvolá warning bez zápisu. |
| Planner AUTO/OFF DB | PASS | Izolovaná PostgreSQL DB: AUTO → OFF → AUTO ověřilo override, sdílený policy snapshot, dvě auditní události a následný odvozený 45minutový planner event. |
| Planner layout | PASS | DOM/CSS test i Chromium smoke potvrdily pořadí toolbar → legenda → lunch controls → FullCalendar, viditelný grid, kompaktní mezeru a žádný horizontální overflow stránky. |
| Smart ranking | PASS | `rankSuggestedSlots` je pure, synchronní, deterministický a in-memory; hodnotí výsledný rozvrh včetně nejlepšího oběda a při neúplném kontextu stabilně fallbackuje. |
| Date-first | PASS | Ranking seskupuje podle lokálního dne `Europe/Prague`, dny řadí chronologicky a přesouvá kandidáty pouze uvnitř dne. |
| Selectable set parity | PASS | `selectableTimeOptions` zůstávají beze změny; ranking pracuje nad kopií a mění pouze nejvýše šest položek `suggestedSlots`. |
| Performance | PASS | Bez N+1, ranking a lunch evaluation jsou in-memory, policy se načítá dávkově, bez nové dependency a bez async `.sort()`. |
| Migrations | PASS | Na čisté izolované PostgreSQL DB prošlo všech 50 migrací, `prisma validate`, `migrate status` a `migrate diff` bez rozdílu; dočasné DB byly odstraněny. |
| Tests | PASS | Cílená unit/planner sada 86/86, relevantní DB sada po opravách 23/23, agregovaná booking DB sada 60/60 a Chromium smoke 1/1. |
| Build | PASS | `npm run build` dokončil a vytvořil `.next/BUILD_ID`. |

- Deterministická simulace osmi scénářů zachovala množinu kandidátů, determinismus i date-first pořadí. Proti chronologickému baseline se první termín změnil v 0/8 scénářů; smart varianta nikde nezhoršila fragmentaci a samostatný lunch-aware scénář potvrdil preferenci lepšího výsledného rozvrhu i při přesunu oběda.
- `orphanMinutes` zůstává ve V1 vědomě neutrální. Capacity větší než 1 a neúplný optimization context používají původní chronologické pořadí.
- Read-only simulace nad reálnými daty: SKIPPED, protože pro audit nebyl potvrzen bezpečný future/dev dataset oddělený od produkčních dat.
- Fáze 7: [x] produkčně bezpečný výsledek.
