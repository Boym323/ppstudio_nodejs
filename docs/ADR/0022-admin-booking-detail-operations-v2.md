# ADR 0022: Operativní detail rezervace v2

## Stav
Accepted

## Kontext
První produkční detail rezervace splnil bezpečné změny stavu, ale v každodenním provozu byl stále zbytečně vysoký:

- hlavička, souhrn a kontext se opakovaly ve více blocích
- rychlé kontaktní akce byly oddělené od hlavního rozhodnutí
- interní poznámka byla svázaná hlavně se změnou stavu místo samostatné operativní práce
- historie byla čitelná, ale zbytečně roztažená

Salon potřebuje z detailu rychlý pracovní nástroj, ne dlouhou čtecí stránku.

## Rozhodnutí
- Detail rezervace přestavujeme do pěti jasných bloků:
  - sticky header
  - kompaktní souhrn
  - akční zóna
  - poznámky
  - historie změn
- Odstraňujeme překryvné sekce `Další krok`, `Kontext rezervace`, `Základní přehled` a `Operační souhrn`.
- Rychlé kontaktní akce (`tel:`, `mailto:`) přesouváme přímo do sticky headeru.
- Akční panel dál používá existující server-side pravidla přechodů stavu; v2 nemění booking business logiku.
- Interní poznámka dostává vlastní server action a vlastní malý formulář, aby šla upravit i bez změny stavu.
- Každá úprava interní poznámky zapisuje auditní záznam do `BookingStatusHistory` se zdrojem `admin-booking-note-v1`.
- Timeline nově ukazuje i stručný zdroj změny, pokud je dostupný z metadata payloadu.

## Důsledky

### Pozitivní
- detail je výrazně kratší a rychleji skenovatelný
- nejdůležitější akce jsou dostupné bez scrollu
- interní poznámka je použitelná jako samostatný provozní workflow
- auditní historie lépe vysvětluje, odkud změna přišla

### Negativní
- detail stále nepodporuje reschedule flow ani znovuotevření uzavřené rezervace
- poznámkové změny přidávají další záznamy do historie, takže timeline může růst rychleji

## Alternativy
- Pouze vizuálně zmenšit stávající bloky: zamítnuto, protože by zůstalo stejné opakování informací.
- Přidat nové stavové přechody `CANCELLED/COMPLETED -> PENDING`: odloženo, protože by to měnilo business logiku mimo scope tohoto redesignu.
- Nechat interní poznámku uvnitř formuláře změny stavu: zamítnuto, protože to zhoršovalo běžnou provozní práci bez statusové změny.
