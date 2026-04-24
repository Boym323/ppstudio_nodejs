# ADR 0040: Stabilizační Refaktor Velkých Booking/Admin Modulů

## Status
Accepted

## Kontext

K 2026-04-24 narostly tři klíčové soubory nad hranici, kdy už se v nich míchaly různé odpovědnosti:

- `src/features/booking/lib/booking-public.ts`
- `src/features/booking/components/booking-flow.tsx`
- `src/features/admin/lib/admin-slots.ts`

To zvyšovalo riziko regresí při běžných změnách a zpomalovalo orientaci v kódu.

## Rozhodnutí

Provedeme čistě strukturální refaktor bez změny:

- veřejného API a exportů
- business logiky
- UI chování
- databázového modelu
- feature scope

Původní entrypointy zůstávají zachované a slouží jako kompatibilní façade nad menšími interními moduly.

## Nové hranice odpovědnosti

### Booking public

- `booking-public/shared.ts`: shared typy, chyby, normalizace, booking constants
- `booking-public/catalog.ts`: veřejný read model katalogu služeb a slotů
- `booking-public/notifications.ts`: email orchestrace a action tokeny
- `booking-public/engine.ts`: create engine a transakční booking workflow

### Booking flow UI

- `booking-flow/helpers.ts`: formátování, kalendářové helpery, validace kontaktu
- `booking-flow/types.ts`: lokální typy pro flow
- `booking-flow/progress-panel.tsx`: progres a top-level form error
- `booking-flow/service-step.tsx`: krok výběru služby
- `booking-flow/term-step.tsx`: krok výběru termínu
- `booking-flow/contact-step.tsx`: krok kontaktu
- `booking-flow/summary-sidebar.tsx`: pravý souhrnný panel

### Admin slots

- `admin-slots/time.ts`: date/week/cell helpery
- `admin-slots/helpers.ts`: intervalové helpery, collision utility, planner summary helpery
- `admin-slots/queries.ts`: weekly planner read model a slot week context
- `admin-slots/mutations.ts`: planner mutace a validační guardy
- `admin-slots/types.ts`: sdílené typy a mutation error

## Důsledky

### Pozitivní

- menší soubory s jasnější odpovědností
- nižší riziko vedlejších změn při úpravě booking a planner logiky
- jednodušší cílené testování a review
- zachovaná kompatibilita importů pro zbytek aplikace

### Negativní

- více interních souborů a importů
- nutnost držet disciplínu, aby se nová logika nezačala znovu hromadit ve façade souborech

## Ověření

Refaktor byl ověřen:

- úspěšným `next build`
- cíleným typecheck filtrem bez chyb v refaktorovaných modulech
- plným `npm test`, kde selhávají existující integrační testy `booking-management.integration.test.ts` na seedování volného slotu, nikoli import/export nebo runtime chyby refaktoru
