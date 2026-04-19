# ADR 0012: Sdílené factory funkce pro owner/salon admin routy

## Stav
Schváleno

## Kontext
Owner (`/admin/*`) a salon (`/admin/provoz/*`) routy používaly stejnou logiku, ale byly duplikované po souborech (`page.tsx`, `layout.tsx`). Rozdíl byl často jen v hodnotě `area` (`owner` vs `salon`), což zvyšovalo riziko rozjetí guardů nebo načítání dat mezi oběma větvemi.

## Rozhodnutí
- Zavést `src/features/admin/lib/admin-route-factories.tsx` pro sdílené route wrappery:
  - overview
  - section
  - booking detail
  - slot list/create/detail/edit
- Zavést `src/features/admin/components/admin-shell-layout.tsx` jako sdílený layout wrapper.
- Zachovat existující URL i permission model; route soubory zůstávají, ale delegují na sdílené factory funkce.

## Důsledky

### Pozitivní
- Menší copy-paste mezi owner a salon routami.
- Jednotné guardování oprávnění přes stejná vstupní místa.
- Jednodušší údržba při dalších změnách route logiky.

### Negativní
- Refaktor přidává jednu vrstvu indirection (factory funkce), kterou je potřeba znát při debugování.

## Alternativy
- Nechat duplikované route soubory: zamítnuto kvůli vyššímu maintenance overheadu.
- Přesunout vše do jediné dynamické route bez explicitních souborů: zamítnuto kvůli horší čitelnosti a vyššímu riziku nechtěné změny URL/permission chování.
