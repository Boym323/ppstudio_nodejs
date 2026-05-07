# ADR 0085: Admin booking needs-closure section v1

## Kontext
- Provozní seznam rezervací dříve řadil čekající rezervace nahoru, nadcházející aktivní rezervace doprostřed a historické nebo uzavřené rezervace dolů.
- Aktivní rezervace, které už reálně proběhly, ale ještě nebyly označené jako `Hotovo`, mohly vizuálně zapadnout mezi minulými položkami.
- Provoz potřebuje po návštěvě rychle najít rezervace k uzavření, doplnit úhradu a nastavit finální stav.

## Rozhodnutí
- Do read modelu admin seznamu rezervací přidáváme skupinu `needs_closure` se štítkem `K uzavření`.
- Skupina se zobrazuje nahoře před `pending`, `upcoming` a `past`.
- Do skupiny patří rezervace se `scheduledEndsAt < now` a stavem `PENDING` nebo `CONFIRMED`.
- Uzavřené stavy `COMPLETED`, `CANCELLED` a `NO_SHOW` zůstávají mimo tuto skupinu.
- Rychlý filtr `K uzavření` používá stejnou definici a zůstává URL-driven přes `stat=needs_closure`.

## Důsledky
- Proběhlá, ale neuzavřená návštěva se objeví jako provozní úkol hned nahoře.
- Budoucí čekající rezervace dál zůstávají v samostatné skupině `Čeká na potvrzení`.
- Historické uzavřené rezervace zůstávají v tlumené skupině `Minulé`.
- Nevyžaduje se migrace databáze; jde čistě o změnu serverového read modelu a UI seskupení.

## Stav
- schváleno
