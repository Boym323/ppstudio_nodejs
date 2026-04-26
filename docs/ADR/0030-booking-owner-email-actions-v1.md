# ADR 0030: Booking Owner Email Actions V1

## Kontext

Veřejná rezervace už existovala ve stavu `PENDING` a klientce i provozu chodily e-maily, ale provoz musel rezervaci vždy dokončit až po otevření adminu. To zbytečně prodlužovalo běžné schvalování termínů.

Současně jsme nechtěli:
- provést změnu pouhým `GET` requestem bez potvrzení
- vystavit akci přes veřejné ID rezervace
- zavádět těžkou novou infrastrukturu mimo existující Prisma + Next.js stack

## Rozhodnutí

Zavedli jsme bezpečný email action flow nad existujícím modelem `BookingActionToken`.

### Klíčové body

- Přidali jsme nové typy tokenů `APPROVE` a `REJECT`.
- Do e-mailu se posílá jen raw token; v databázi ukládáme pouze jeho hash.
- Token je:
  - svázaný s konkrétní rezervací
  - svázaný s konkrétním intentem
  - časově omezený
  - jednorázový
  - po provedení akce zneplatní i související tokeny stejné rezervace
- Uživatelský flow vede přes veřejnou noindex route `/rezervace/akce/[intent]/[token]`.
- `GET` route provádí pouze validaci a zobrazení confirmation screen.
- Finální změna proběhne až přes `POST` server action v serializable transakci.
- Akce zapisuje audit do `BookingStatusHistory` a zakládá návazný klientský `EmailLog`.

## Proč tato varianta

### Výhody

- Držíme jednotný bezpečnostní model pro storno i provozní email akce.
- Není potřeba nová tabulka ani nový externí signing mechanismus.
- Hashovaný token v DB snižuje dopad případného úniku databáze.
- Mezistránka s potvrzením minimalizuje omyl z e-mailového klienta nebo automatického prefetchingu.
- Veřejná route funguje i bez admin session, takže zkracuje reálný provozní workflow.

### Nezvolené alternativy

- Přímý `GET` approve/reject:
  - zamítnuto kvůli bezpečnosti a riziku nechtěného vykonání.
- Query string s veřejným `bookingId` bez tokenu:
  - zamítnuto kvůli snadné zneužitelnosti.
- Nová separátní tabulka jen pro owner email akce:
  - zatím zbytečně složité; současný `BookingActionToken` model už pokrývá potřebné atributy.

## Dopady

- Veřejná rezervace nově generuje tři tokeny:
  - klientský `CANCEL`
  - provozní `APPROVE`
  - provozní `REJECT`
- Admin notifikační e-mail obsahuje CTA:
  - `Potvrdit rezervaci`
  - `Přesunout termín`
  - `Zrušit rezervaci`
  - `Otevřít v administraci`
- Vizuální vrstva admin e-mailu je záměrně email-safe: krátká informační karta, plnošířková tabulková tlačítka, Arial/Helvetica na CTA a bez dlouhého vysvětlení bezpečnostního mezikroku. `Přesunout termín` otevírá existující admin detail rezervace, protože samostatný reschedule tokenový odkaz pro provozní e-mail není součástí tohoto flow.
- Po schválení jde klientce e-mail `booking-approved-v1`.
- Po zamítnutí jde klientce e-mail `booking-rejected-v1`.
- Při deployi je nutné aplikovat migraci rozšiřující enum `BookingActionTokenType`.
