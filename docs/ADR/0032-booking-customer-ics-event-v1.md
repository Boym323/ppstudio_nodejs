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

Zavedli jsme samostatný `.ics` endpoint pro jednu rezervaci na route `/api/bookings/calendar/[token].ics`.

### Klíčové body

- Endpoint vrací právě jeden `VEVENT` pro jednu rezervaci.
- Event je dostupný jen pro rezervace ve stavu `CONFIRMED`.
- Rezervace v `PENDING`, `CANCELLED`, `COMPLETED` a `NO_SHOW` event nevracejí.
- Přístup je chráněný samostatným tokenem `BookingActionTokenType.CALENDAR`.
- Potvrzovací email `booking-approved-v1` obsahuje CTA `Přidat do kalendáře`.
- Veřejný pending confirmation screen už kalendářové CTA nenabízí.

## Bezpečnostní model

- Pro zákaznický `.ics` event nepoužíváme `Booking.id` ani storno token.
- Pro potvrzenou rezervaci se vytváří samostatný hashovaný `BookingActionToken` typu `CALENDAR`.
- Do DB ukládáme jen hash tokenu, ne raw hodnotu.
- URL se skládá serverově přes `NEXT_PUBLIC_APP_URL` a raw token se posílá jen do potvrzovacího e-mailu.
- Endpoint vrací `404` i pro neplatný token nebo nepovolený stav, aby zbytečně nepotvrzoval existenci rezervace.
- Při zrušení rezervace se calendar token revokuje.

## Proč tato varianta

### Výhody

- Zákaznice dostane přesně to, co potřebuje: jeden termín, ne další feed.
- Kalendářový odkaz neuděluje právo rezervaci měnit nebo rušit.
- Bezpečnost je oddělená od storno workflow.
- Apple Calendar dostává standardní iCalendar payload s `VTIMEZONE` blokem pro `Europe/Prague`.
- Nepřidáváme novou knihovnu ani externí kalendářovou službu.

### Nezvolené alternativy

- Reuse storno tokenu:
  - zamítnuto, protože read-only kalendářový link by zároveň nesl oprávnění rezervaci rušit
- Generování `.ics` už v pending confirmation screenu:
  - zamítnuto, protože by si klientka ukládala nepotvrzený termín
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

- Přibyla migrace `20260422194500_booking_calendar_event_v1`.
- `BookingActionToken` nově obsluhuje i typ `CALENDAR`.
- Přibyl route handler `src/app/api/bookings/calendar/[token].ics/route.ts`.
- Přibyla serverová služba `src/features/calendar/lib/booking-calendar-event.ts`.
- Potvrzovací e-mail `booking-approved-v1` nově nese CTA `Přidat do kalendáře`.
- Pending confirmation screen po odeslání rezervace už kalendářovou akci nenabízí.
