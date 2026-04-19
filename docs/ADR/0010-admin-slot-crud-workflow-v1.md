# ADR 0010: Admin CRUD workflow pro sloty

## Stav
Accepted

## Kontext
Projekt už měl v databázi produkční model `AvailabilitySlot`, ale admin vrstva pro něj byla jen read-only přehled:

- nešlo slot bezpečně vytvořit ani upravit
- nešlo otevřít detail jednoho slotu
- nešlo přímo z adminu blokovat nebo archivovat slot
- role `SALON` potřebovala jednoduchý provozní flow bez generického CMS rozhraní
- databáze už sice chránila překryv aktivních slotů, ale UI nad tím nemělo použitelné server-side workflow

## Rozhodnutí
- Zavádíme explicitní slot workflow pro obě admin oblasti:
  - `/admin/volne-terminy/*`
  - `/admin/provoz/volne-terminy/*`
- Architektura je rozdělená na:
  - repository vrstvu pro Prisma dotazy
  - service/lib vrstvu pro byznys pravidla a read modely
  - server actions jako tenký vstupní adaptér
  - samostatné UI komponenty pro seznam, detail a formulář
- Slot zůstává hlavní provozní entitou dostupnosti; negenerujeme sloty z pevné otevírací doby.
- Obě role `OWNER` i `SALON` mohou sloty spravovat, ale přístup je dál chráněný existujícími server-side area guardy.
- Server-side validace slotu musí hlídat:
  - `endsAt > startsAt`
  - kapacitu minimálně `1`
  - kolizi s jiným aktivním slotem
  - konzistenci omezení služeb
  - zákaz snížení kapacity pod počet aktivních rezervací
- Fyzické smazání povolujeme jen tehdy, když slot nemá žádnou navázanou rezervaci; jinak používáme blokaci nebo archivaci.

## Důsledky

### Pozitivní
- admin konečně dostává skutečný provozní workflow pro plánování termínů
- `SALON` má jednoduché UI bez technického přetížení, ale se stejnými bezpečnostními pravidly jako owner
- byznys pravidla zůstávají server-side a neopírají se o klientské formuláře
- UI umí vysvětlit běžné provozní konflikty dřív, než uživatel narazí na nízkoúrovňový DB constraint

### Negativní
- slot delete zůstává záměrně přísnější kvůli historii rezervací a `Booking.slotId` referenční integritě
- CRUD zatím neřeší hromadné vytváření slotů nebo drag-and-drop kalendář

## Alternativy
- Generický admin/CMS builder: zamítnuto, protože by zhoršil ergonomii provozního použití a promíchal doménová pravidla.
- Pouze owner workflow bez `SALON`: zamítnuto, protože ruční plánování termínů je každodenní provozní úkol.
- Spoléhat jen na databázový exclusion constraint bez předběžné validační vrstvy: zamítnuto, protože by UX končilo nečitelnými chybami.
