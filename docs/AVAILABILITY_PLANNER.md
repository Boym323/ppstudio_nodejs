# Volné termíny – admin planner a propojení s rezervacemi

> Technický popis aktualizovaný k PP Studio **3.36.1 dne 24. 10. 2026**. Při rozporu platí kód a [Prisma schéma](../prisma/schema.prisma). Výběr a odeslání termínu klientkou popisuje [BOOKING_FORM.md](BOOKING_FORM.md); stavové přechody a e-maily [BOOKING_FLOW.md](../BOOKING_FLOW.md).

## Co tato sekce dělá

„Volné termíny“ **publikují časová okna dostupnosti**, nikoli přímo `Booking` klientek. Uložený `AvailabilitySlot` je podklad pro veřejnou nabídku; skutečná rezervovatelnost se teprve odvozuje z délky služby, obsazenosti, úklidu, případného omezení služeb, rezervačního okna a oběda. **Planner a /rezervace čtou jednu databázi; nejde o synchronizaci dvou kalendářů.**

| Role | Route a přístup |
| --- | --- |
| `OWNER` | `/admin/volne-terminy`; `requireAdminSectionAccess("owner","volne-terminy")` |
| `SALON` | `/admin/provoz/volne-terminy`; `requireAdminSectionAccess("salon","volne-terminy")` |

Obě routy (`src/app/(admin)/admin/volne-terminy/page.tsx` a `src/app/(admin)/admin/provoz/volne-terminy/page.tsx`) používají jeden [`AdminWeeklyPlannerPage`](../src/features/admin/components/admin-weekly-planner-lab-page.tsx) a společný [`AdminWeeklyPlannerClient`](../src/features/admin/components/admin-weekly-planner-lab-client.tsx). Parametry `week` a `day` drží URL kontext konkrétního týdne/dne.

## Současné UI (FullCalendar)

- Jeden **FullCalendar planner**, nikoliv historický draft-first workflow. Módy: **Prohlížení**, **Přidat termín**, **Odebrat termín**. Změna se ukládá **automaticky po jednotlivých interakcích** – není tlačítko pro hromadné publikování rozpracovaného týdne.
- Mřížka `06:00–20:00`, obvykle po **30 minutách** v `Europe/Prague` (konstanty v [`admin-slots/time.ts`](../src/features/admin/lib/admin-slots/time.ts)). Speciální 15minutová hranice je přípustná například bezprostředně po rezervaci či úklidu; read-only zobrazení umí přesnější bloky než základní grid.
- UI zobrazuje volnou dostupnost, rezervace `PENDING` a `CONFIRMED`, dokončené návštěvy `COMPLETED`, navazující úklid, omezené či neaktivní intervaly a vypočtený oběd. Kliknutí na událost rezervace může otevřít admin detail. Prezentaci událostí vytváří [`planner-lab-adapter.ts`](../src/features/admin/components/planner-lab-adapter.ts).
- Na menším displeji se mění pohled mezi dnem, pracovními dny a víkendem; kalendář udržuje kontext při navigaci `week/day`. Serverový read model řídí fakta, vizuální buňky nejsou samostatná datová entita.
- Historický koncept `ADR 0023` je nahrazen [ADR 0118 – FullCalendar a autosave](ADR/0118-fullcalendar-planner-autosave-v1.md). Nesmí se automaticky obnovit předchozí „Zahodit / Publikovat změny týdne“ z historických MD.

## Datový model a read

[`getAdminPlannerWeek`](../src/features/admin/lib/admin-slots/queries.ts) načte jeden týden (`PlannerWeekData.days`) přes `AvailabilitySlot`, `Booking` a `AutoLunchDayOverride`. Skládá přesné intervaly a blokace, teprve poté jejich projekci do gridu.

| Datová entita | Význam |
| --- | --- |
| `AvailabilitySlot` | `startsAt`, `endsAt`, `status`, `capacity`, `serviceRestrictionMode`, poznámky, `allowedServices`; časová nabídka |
| `AvailabilitySlotService` | Povoluje vyjmenované služby u režimu `SELECTED`; `ANY` nemá whitelist |
| `Booking` | `slotId`, `scheduledStartsAt`, `scheduledEndsAt`, `blockedUntil`, `status`; blokace služby včetně úklidu |
| `AvailabilityOperation` | `operationId`, fingerprint a uložený výsledek autosave; chrání před duplicitním provedením |
| `AvailabilityAuditEvent` | Neměnná auditní stopa přidání, odebrání či vrácení změny, staré/nové intervaly a identita aktéra |
| `SiteSettings` + `AutoLunchDayOverride` | Globální a denní pravidlo automatického oběda |

`PUBLISHED` slot vstupuje do veřejného katalogu. `DRAFT` může reprezentovat interní blok (např. ruční výjimku), ale není veřejně nabízen. `ARCHIVED` nebo `CANCELLED` nejsou nová publikovaná dostupnost; ponechávají historické vazby. Pro kolize má přednost aktuální stav bookingů, ne jen barevný stav slotu.

## Uložení jedné změny: cesta UI → DB

```text
FullCalendar: klik nebo výběr rozsahu
    -> lokální patch zobrazovaných dní
    -> PlannerLabSaveQueue (FIFO)
    -> applyPlannerSelectionAction (role, Zod, operationId)
    -> applyAvailabilitySelection (Serializable DB transakce)
    -> ochrana rezervací, úklidu a zamčených intervalů
    -> spojení/odečtení intervalů + diff slotů
    -> PUBLISHED sloty + AvailabilityOperation + AvailabilityAuditEvent
    -> revalidatePath(admin) + router.refresh()
    -> nové načtení /rezervace -> aktualizovaný veřejný katalog
```

- [`slot-planner-actions.ts`](../src/features/admin/actions/slot-planner-actions.ts) přijímá `area`, `weekKey`, `dateKey`, `startCell`, `endCell`, `mode=add|remove`, UUID `operationId` a případně `revertedOperationId`. Kontroluje oprávnění, validaci a identitu administrátora.
- [`admin-slots/mutations.ts`](../src/features/admin/lib/admin-slots/mutations.ts) připraví intervaly a **transakčně** provede merge/subtract; chráněné úseky se nesmějí přepsat. Standardní nové sloty jsou `capacity=1`, `status=PUBLISHED`, `serviceRestrictionMode=ANY`.
- [`PlannerLabSaveQueue`](../src/features/admin/components/planner-lab-save-queue.ts) ukládá jednotlivé operace **postupně (FIFO)**. Chyba ponechá neodeslané změny pro retry nebo **Obnovit uložený stav**. Optimisticky vykreslený úsek není jistotou, že už byl uložen.
- Jediné DOM gesto sdílené callbacky `dateClick`/`select` přijímáme jen jednou podle identity události, bez časového debounce. No-op uchová idempotentní výsledek, ale nevytváří audit a nenabízí undo. DST a UTC konvenci popisuje [DST audit](DST_AUDIT.md).
- `operationId` + fingerprint zajišťuje idempotenci; jiný obsah se stejným klíčem je odmítnut. Krátce dostupné **Zpět** zapisuje novou akci s `revertedOperationId`, nikoliv smazání auditu. Server vrací pouze skutečný rozdíl mezi původním stavem před a po změně, ne celý označený rozsah. Pokud dotčené úseky mezitím změnily dostupnost nebo je chrání rezervace či omezení, vrácení odmítne; stejnou operaci nelze vrátit podruhé. UI během vracení čeká na serverový stav.
- Nově seskládané sloty mohou mít **jiná ID**. Formulář klientky posílá `slotId` i `startsAt`, ale zapisovací engine musí zkontrolovat **čerstvé publikované souvislé pokrytí** a případně odmítnout zastaralý výběr.

## Chráněné bloky a archivace

- V běžném gridu lze přímo měnit jen „prosté“ editovatelné sloty: `capacity=1`, `ANY`, žádné `publicNote` / `internalNote`, žádné `allowedServices`. Ostatní strukturálně omezené sloty se nevynucují přes jednoduchý drag.
- Planner chrání intervaly rezervací a úklid až do `blockedUntil ?? scheduledEndsAt`; do své provozní projekce zahrnuje také `COMPLETED`. Sousední chráněný úsek se nesmí smazat ani přepsat. Existence rezervace může blokovat čas i při archivaci jejího původního slotu.
- Při přestavbě lze slot **bez navázané rezervace smazat**. Slot s rezervací se **archivuje**, takže `Booking.slotId` a audit zůstávají konzistentní. Archivovaný historický slot nesmí „znovu“ nabízet čas ani vytvářet falešnou blokaci volné dostupnosti.
- Změna dostupnosti **není** vytvoření ani storno `Booking`. Sama neposílá potvrzovací e-maily, nemanipuluje platbami a nemění stav návštěvy.
- Storno po archivaci zdrojového slotu obnoví čas služby a část navazujícího úklidu nejvýše do `min(blockedUntil, originalAvailabilityEndsAt)`. Bez snapshotu původního konce dostupnosti úklid navíc nepublikuje. Neobnovuje celé historické okno ani odebrané úseky za úklidem. Přesah služby mimo zdrojový slot omezuje na zrušenou službu; navazující obnovený úklid přebírá pravidla zdrojového slotu, aby z něj nevznikl nevyužitelný termín vyhrazený zrušené službě.

## Vazba na veřejné /rezervace

```text
OWNER/SALON: /admin[/provoz]/volne-terminy
       │ PUBLISHED AvailabilitySlot v PostgreSQL (autosave)
       ▼
PUBLIC: /rezervace -> getPublicBookingCatalog()
       │ aktivní + veřejně rezervovatelná Service/ServiceCategory
       │ PUBLISHED, omezení ANY/SELECTED, booking min/max advance
       │ obsazené PENDING/CONFIRMED Booking, úklid, kapacita 1
       │ automatický oběd a kontrola proveditelnosti
       ▼
KLIENT: doporučené termíny + plný kalendář vhodných časů
       │ výběr (serviceId, slotId, startsAt) + kontaktní údaje
       ▼
SERVER: createPublicBookingAction -> createPublicBooking
       ▼
Serializable createBookingWithEngine (aktuální DB + zámky)
       ├─ úspěch: PENDING Booking + tokeny + EmailLog
       └─ kolize: bezpečná chyba -> refresh veřejného katalogu
```

Zde je hlavní rozdíl mezi **publikovaným oknem** a **skutečně nabízeným časem**:

1. Publikování např. `09:00–13:00` neznamená čtyři pevné hodinové rezervace. Public flow odvodí starty z délky vybrané služby, obsazených bloků a dalších omezení.
2. Pro ilustraci služba **60 minut + 15 minut úklidu** obsadí pro kolize **75 minut**. `PENDING` od `09:00` blokuje `09:00–10:15`, i když klientka vidí konec služby v 10:00. Následný start může být `10:15`, pokud jej dovolují zbývající intervaly a aktivní policy.
3. `PENDING` již spotřebuje kapacitu, stejně jako `CONFIRMED`. Dvě souběžná odeslání na stejné časové okno musí server vyřešit bez dvojí aktivní rezervace.
4. Změna slotu v adminu **nevyvolá živý push** do otevřené veřejné stránky. Nový přístup ke katalogu zobrazí aktuální stav; pokud v otevřeném formuláři nastane konflikt, [`availability-refresh.ts`](../src/features/booking/components/booking-flow/availability-refresh.ts) vyvolá obnovu nabídky a vrátí klientku k termínu.
5. Změna `Service.durationMinutes`, `Service.cleanupMinutes` či booking window může změnit nabídnuté starty **bez zásahu do planneru**.

Hlavní sdílené soubory: [`booking-availability-policy.ts`](../src/features/booking/lib/booking-availability-policy.ts), [`booking-availability-core.ts`](../src/features/booking/lib/booking-availability-core.ts), [`booking-slot-availability.ts`](../src/features/booking/lib/booking-slot-availability.ts), [`booking-time-slots.ts`](../src/features/booking/lib/booking-time-slots.ts), [`booking-public/engine.ts`](../src/features/booking/lib/booking-public/engine.ts).

## Automatický oběd (vazba na dostupnost)

- [`booking-schedule-optimization.ts`](../src/features/booking/lib/booking-schedule-optimization.ts) odvozuje **45minutový oběd**, starty **11:00–13:00 po 15 minutách**, při nejméně **5 hodinách pracovního dne** z publikované dostupnosti a již obsazených bloků, v `Europe/Prague`. Kandidát oběda musí být pokryt publikovanou dostupností.
- Globální vypínač je `SiteSettings.autoLunchEnabled`; denní `AUTO/OFF` zapisuje [`updateAutoLunchDayModeAction`](../src/features/admin/actions/settings-actions.ts) přes [`admin-auto-lunch.ts`](../src/features/admin/lib/admin-auto-lunch.ts). Neexistující řádek `AutoLunchDayOverride` znamená `AUTO`.
- Oběd je **vypočítaný read-only event**, nikoliv `AvailabilitySlot` či `Booking`. Přidání rezervace může přesunout jeho nejlepší polohu. Veřejný výběr nesmí zrušit poslední proveditelný oběd v den s aktivní policy; stejná ochrana je i v doménovém zápisu.
- Detaily [`SCHEDULE_OPTIMIZATION_MIGRATION.md`](SCHEDULE_OPTIMIZATION_MIGRATION.md). Tuto dokumentaci ber jako doplnění aktuální implementace, historické fáze migrace nejsou aktuální návod k editaci.

## Ruční rezervace, přesun a časová pravidla

**Ruční rezervace** je separátní workflow: standardně se má vejít do publikované dostupnosti; explicitní `allowManualOverride=true` může založit interní `DRAFT` výjimku a auditovat `Booking.manualOverride`. **Veřejný formulář používá vždy `allowManualOverride=false`.** Public/admin reschedule musí stejně jako vytvoření rezervace ověřit kolize z aktuální DB; při přesunu se může původní `Booking` v nabídce vyloučit přes `excludeBookingId`. Pražské lokální časové údaje a DST je nutné vyhodnocovat přes sdílené pomocné funkce, ne ruční přepočet UTC.

## Testy a scénáře pro změny

| Změna/scénář | Povinný efekt |
| --- | --- |
| Přidat dostupnost | Uložený `PUBLISHED` slot; nově načtený public katalog nabídne jen kompatibilní časy |
| Odebrat dostupnost | Volné části mohou zmizet, ale rezervaci/úklid nelze přepsat a slot s vazbou se archivuje |
| Dva admin tably | Zápis je serializovaný a idempotentní, konflikt vrátí řízenou chybu |
| Dvě klientky souběžně | Jen jedna smí získat kolidující aktivní rezervaci |
| Úklid a 15min. start | Obsazení končí `blockedUntil` a přechod po bloku respektuje quarter-hour hranice |
| Oběd `AUTO/OFF` | Dostupnost a booking dodrží feasibility; oběd není uložený jako samostatný slot |
| Role a čas | Guard `OWNER/SALON`, časová zóna `Europe/Prague`, přechod na letní/zimní čas |

Testovací umístění: [`tests/e2e/planner-lab.spec.ts`](../tests/e2e/planner-lab.spec.ts), [`tests/e2e/booking-flows.spec.ts`](../tests/e2e/booking-flows.spec.ts), `src/features/admin/lib/admin-slots/*.test.ts`, `src/features/booking/lib/*.test.ts` a DB integrační testy. **Nespouštěj plný E2E při čistě dokumentační úpravě.**

## Mapa odpovědnosti pro další vývoj

- UI a autosave: `src/features/admin/components/admin-weekly-planner-lab-client.tsx`, `planner-lab-save-queue.ts`.
- Read model týdne: `src/features/admin/lib/admin-slots/queries.ts` a `planner-lab-adapter.ts`.
- Write path, role a audit: `src/features/admin/actions/slot-planner-actions.ts`, `src/features/admin/lib/admin-slots/mutations.ts`.
- Zobrazení dostupnosti klientce: `booking-availability-policy.ts`, `booking-availability-core.ts`, `booking-time-slots.ts`, `booking-flow.tsx`.
- Autoritativní kolize a tvorba rezervací: `booking-public/engine.ts`.
