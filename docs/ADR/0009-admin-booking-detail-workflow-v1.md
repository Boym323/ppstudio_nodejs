# ADR 0009: Admin detail rezervace a řízené změny stavu

## Stav
Accepted

## Kontext
Admin část měla pro rezervace zatím jen přehledové seznamy a dashboardy, ale chyběl první skutečný pracovní flow:

- nešlo otevřít detail jedné rezervace
- nešlo bezpečně změnit stav rezervace z adminu
- auditní model `BookingStatusHistory` už existoval, ale lite admin ho prakticky nevyužíval
- salon potřebuje jednoduché UI bez technických detailů, ale server pořád musí držet pravidla přechodů

## Rozhodnutí
- Zavádíme detail rezervace pro obě admin oblasti:
  - `/admin/rezervace/[bookingId]`
  - `/admin/provoz/rezervace/[bookingId]`
- Přístup respektuje stávající role-aware admin area guardy nad sekcí `rezervace`.
- Z detailu podporujeme jen řízené přechody:
  - `PENDING -> CONFIRMED`
  - `CONFIRMED -> COMPLETED`
  - `PENDING/CONFIRMED -> CANCELLED`
  - `CONFIRMED -> NO_SHOW`
- Server action jen validuje vstup, oprávnění a volá feature/lib vrstvu.
- Samotná booking logika žije v `src/features/admin/lib/admin-booking.ts`.
- Každá změna zapisuje nový řádek do `BookingStatusHistory` s aktérem `USER`, nepovinným `reason` a `note`.
- Lite admin používá stejné bezpečné workflow jako owner, ale s jednodušším copy a bez technického payloadu.

## Důsledky

### Pozitivní
- admin rezervace dostávají první produkční write flow bez přepisu celé sekce
- server drží finální autoritu nad povolenými přechody stavu
- audit změn konečně vzniká i pro ruční provozní zásahy z adminu
- detail rezervace je sdílený mezi owner a salon oblastí bez duplikace business logiky

### Negativní
- zatím řešíme jen změnu stavu, ne ruční vytvoření, přesun nebo editaci slotu
- `Booking` model nemá zvláštní timestamp pro `NO_SHOW`, takže tato informace zůstává jen ve stavu a historii

## Alternativy
- Povolit libovolnou změnu na jakýkoli stav: zamítnuto, protože by to otevřelo nekonzistentní provozní scénáře.
- Řešit změnu stavu přímo uvnitř detail komponenty: zamítnuto, protože by se business pravidla promíchala s UI.
- Udělat detail pouze pro owner: zamítnuto, protože každodenní provozní práce patří hlavně do lite adminu.
