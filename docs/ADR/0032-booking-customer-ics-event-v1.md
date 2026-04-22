# ADR 0032: Customer Booking ICS Event V1

## Kontext

Po potvrzení rezervace potřebuje zákaznice jednoduchou možnost uložit si jeden konkrétní termín do osobního kalendáře na iPhonu, v Apple Kalendáři nebo v jiném klientu podporujícím `.ics`.

Nechceme:
- Google Calendar integraci
- plný subscription feed pro zákaznici
- veřejné URL postavené na odhadnutelném ID rezervace
- posílat kalendářovou událost už ve stavu `PENDING`

Současně potřebujeme zachovat:
- bezpečné doručení přes kliknutí z potvrzovacího emailu
- kompatibilitu s Apple Calendar
- jednoduchý provoz bez nové externí integrace

## Rozhodnutí

Zavedli jsme generování jedné `.ics` přílohy přímo do potvrzovacího e-mailu `booking-approved-v1`.

### Klíčové body

- Příloha obsahuje právě jeden `VEVENT` pro jednu rezervaci.
- Event se generuje jen pro rezervace ve stavu `CONFIRMED`.
- Rezervace v `PENDING`, `CANCELLED`, `COMPLETED` a `NO_SHOW` přílohu neposílají.
- Potvrzovací email `booking-approved-v1` obsahuje `.ics` attachment `pp-studio-rezervace.ics`.
- Veřejný pending confirmation screen už kalendářové CTA nenabízí.

## Bezpečnostní model

- Pro zákaznický kalendář už nepoužíváme veřejný link ani token.
- `.ics` obsah odchází jen jako příloha potvrzovacího e-mailu pro konkrétní rezervaci.
- Attachment vzniká serverově při renderu `booking-approved-v1` ze snapshotu rezervace.
- Nedochází k odhalení veřejné route ani dalšího read-only přístupu k rezervaci.

## Proč tato varianta

### Výhody

- Zákaznice dostane přesně to, co potřebuje: jeden termín, ne další feed.
- Odpadají problémy s routováním klikacího `.ics` odkazu v různých klientech.
- Není potřeba držet další veřejnou URL ani token lifecycle.
- Apple Calendar dostává standardní iCalendar payload s `VTIMEZONE` blokem pro `Europe/Prague`.
- Nepřidáváme novou knihovnu ani externí kalendářovou službu.

### Nezvolené alternativy

- Generování `.ics` už v pending confirmation screenu:
  - zamítnuto, protože by si klientka ukládala nepotvrzený termín
- Zákaznický klikací endpoint:
  - opuštěno ve prospěch přílohy, protože attachment je spolehlivější a jednodušší pro klientský use-case
- Zákaznický subscription feed:
  - zamítnuto, zbytečně složité a mimo scope

## Kompatibilita a data

- `VCALENDAR` používá:
  - `VERSION:2.0`
  - `PRODID`
  - `CALSCALE:GREGORIAN`
  - `METHOD:PUBLISH`
- `VEVENT` obsahuje:
  - `UID`
  - `DTSTAMP`
  - `DTSTART`
  - `DTEND`
  - `SUMMARY`
  - `DESCRIPTION`
  - `LOCATION`
  - `STATUS`
  - `LAST-MODIFIED`
  - `SEQUENCE`
- Časy se zapisují s `TZID=Europe/Prague` a sdíleným `VTIMEZONE` blokem.
- Text se escapuje podle RFC 5545 a dlouhé řádky se foldí po 75 bajtech.

## Dopady

- Přibyla serverová služba `src/features/calendar/lib/booking-calendar-event.ts`.
- Potvrzovací e-mail `booking-approved-v1` nově nese `.ics` přílohu.
- Pending confirmation screen po odeslání rezervace už kalendářovou akci nenabízí.
