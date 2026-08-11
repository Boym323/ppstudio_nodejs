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
- Serializable transakce znovu načte stav při submitu; zamítnutý přesun nevytvoří `BookingRescheduleLog` ani notifikaci. Cílené unit testy pokrývají odečtení původní rezervace, cleanup/`blockedUntil` a policy OFF; DB integrační ověření vyžaduje izolovanou PostgreSQL DB.

## Reschedule a admin policy

- Public booking: hard lunch constraint; manual override je false.
- Public reschedule: hard lunch constraint; `changedByClient` jej nikdy nesmí obejít.
- Admin slot mode: standardní lunch constraint (`allowManualOverride: false`).
- Explicitní admin manual mode: může lunch obejít pouze přes existující explicitní manual-override cestu. Zachovat audit flag `manualOverride` a existující warning; případné nové UI varování omezit na „tento manuální termín neponechává proveditelný automatický oběd“ a vyžadovat již existující vědomý manual mode.
- Selhání slot mode se nesmí tiše změnit na manual exception.

## Integrace planneru

Planner má zobrazovat display-only lunch event odvozený z aktuálního stavu vedle booking a cleanup eventů. Nesmí vytvářet availability slot ani booking. Pro doménový výsledek použít přesné minutové/ISO rozsahy; 30minutové buňky ponechat pro stávající editaci a kompatibilitu s FullCalendar. 45minutový oběd se musí vykreslit jako 45minutový event v přesném rozsahu bez zaokrouhlení vstupu. Availability, booking a cleanup musí zůstat oddělenými zdrojovými fakty, aby display oběda nebyl zaměněn za uložený blok.

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

Počáteční bezpečný horizont má být několik prvních již dostupných dnů zobrazených existujícím flow, nikoli neomezené hledání v kalendáři. Úplný chronologický a filtrovaný seznam zůstává dostupný pod doporučeními. Arbitrární váhy nejsou potřeba; pokud bude později nutný scalar, každá metrika se normalizuje a zdokumentuje při zachování date-first omezení.

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

- Integrovat display-only lunch stav do `PlannerWeekData`/adapteru přesné minutové rozsahy; neměnit FullCalendar library ani edit-cell sémantiku.

### Fáze 6

- Přidat date-first smart ranking za stávající hranici doporučení, dokončit testovací matici a performance checks a porovnat výstup s chronologickým fallbackem.

## Globální invarianty

- Žádná DB reprezentace konkrétního auto lunch času.
- Žádná změna FullCalendar library.
- Žádné ML, solver ani dependency.
- Authoritative booking validace zůstává na serveru.
- Cleanup používá blocked interval.
- Scoring je pure a in-memory.
- Žádné N+1 query.
- Public booking/business pravidla mimo tuto funkci zůstávají beze změny.
