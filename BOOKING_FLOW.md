# Booking Flow

Tento dokument popisuje veřejnou rezervaci, self-service správu rezervace a navázané side-effecty.

## Veřejný booking flow

Hlavní route:

- `/rezervace`

UI průchod:

1. výběr kategorie
2. výběr služby
3. výběr termínu
4. kontakt a odeslání

Implementace UI:

- [src/features/booking/components/booking-flow.tsx](src/features/booking/components/booking-flow.tsx#L1)

## Data pro booking

Katalog stojí na:

- `ServiceCategory`
- `Service`
- `AvailabilitySlot`
- `AvailabilitySlotService`
- `SiteSettings`

Booking se nabízí jen pokud:

- služba je `isActive=true`
- služba je `isPubliclyBookable=true`
- kategorie služby je aktivní
- slot je publikovaný a kapacitně dostupný
- termín se vejde do booking policy okna

`cleanupMinutes` neprodlužuje klientce viditelnou délku služby, ale interně blokuje navazující čas přes `blockedUntil`.

## UTM a zdroj rezervace

Při vstupu na web se může zapsat cookie `ppstudio-booking-acq`.

Ukládá:

- `utm_source` nebo `mtm_source`
- `utm_medium` nebo `mtm_medium`
- `utm_campaign` nebo `mtm_campaign`
- externí referrer host

Při vytvoření rezervace se propíše do `Booking`:

- `acquisitionSource`
- `acquisitionReferrerHost`
- `acquisitionUtmSource`
- `acquisitionUtmMedium`
- `acquisitionUtmCampaign`

## Odeslání veřejné rezervace

Server action:

- [src/features/booking/actions/create-public-booking.ts](src/features/booking/actions/create-public-booking.ts#L1)

Flow:

1. validace formuláře přes Zod
2. hash IP a e-mailu pro audit/rate limit
3. kontrola počtu pokusů v `BookingSubmissionLog`
4. načtení acquisition cookie
5. delegace do booking engine
6. zapsání auditního výsledku

Rate limiting:

- max 8 pokusů na IP za 10 minut
- max 3 neúspěšné pokusy na e-mail za 10 minut

## Booking engine

Implementace:

- [src/features/booking/lib/booking-public/engine.ts](src/features/booking/lib/booking-public/engine.ts#L1)

Engine uvnitř transakce řeší:

- načtení služby
- lock konkrétního slotu
- validaci skutečného časového pokrytí
- vytvoření nebo update `Client`
- vytvoření `Booking`
- nastavení snapshotů:
  - jméno
  - e-mail
  - telefon
  - název služby
  - cena
  - délka
  - cleanup
- vytvoření booking tokenů
- vytvoření email outbox záznamů

## E-mailové side-effecty

Implementace:

- [src/features/booking/lib/booking-public/notifications.ts](src/features/booking/lib/booking-public/notifications.ts#L1)

Po vytvoření rezervace se typicky založí:

- klientský potvrzovací nebo pending e-mail
- admin notifikace o nové rezervaci

Použité tokeny:

- `RESCHEDULE`
- `CANCEL`
- pro pending schvalování také `APPROVE` a `REJECT`

## Stavy rezervace

`BookingStatus`:

- `PENDING`
- `CONFIRMED`
- `CANCELLED`
- `COMPLETED`
- `NO_SHOW`

Typický veřejný flow:

- nová rezervace vznikne jako `PENDING` nebo `CONFIRMED` podle pravidel domény
- po potvrzení může klientka používat self-service odkazy
- po zrušení nebo uzavření se self-service omezuje podle typu akce

## Self-service správa rezervace

Route:

- `/rezervace/sprava/[token]`

Použití:

- klientka mění termín
- UI pracuje nad bezpečným tokenem, ne nad přihlášením

Token:

- je uložen jako `BookingActionToken` typu `RESCHEDULE`
- raw token je jen v URL/e-mailu

## Self-service storno

Route:

- `/rezervace/storno/[token]`

Token:

- `BookingActionToken` typu `CANCEL`

Doména kontroluje:

- platnost tokenu
- stav rezervace
- storno okno podle `SiteSettings.bookingCancellationHours`

## E-mail action flow

Route:

- `/rezervace/akce/[intent]/[token]`

Použití:

- approve/reject flow z provozního e-mailu

Používá tokeny:

- `APPROVE`
- `REJECT`

## ICS pro klientku

Potvrzovací e-mail po stavu `CONFIRMED` a e-mail po změně termínu přikládají jeden `.ics` soubor. Veřejný ICS endpoint ani token typu `CALENDAR` se nepoužívají.

## Audit a observability

Auditní modely:

- `BookingSubmissionLog`
- `BookingStatusHistory`
- `BookingRescheduleLog`
- `EmailLog`

Booking flow navíc posílá bezpečné analytics eventy:

- Matomo
- Meta Pixel
- volitelně Google Ads a Clarity page instrumentation

Do analytics se neposílá:

- jméno
- e-mail
- telefon
- poznámka
- raw token

## Související dokumenty

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [ENVIRONMENT.md](ENVIRONMENT.md)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- [docs/ADR/0025-public-booking-flow-v2.md](docs/ADR/0025-public-booking-flow-v2.md)
- [docs/ADR/0031-owner-bookings-ics-feed-v1.md](docs/ADR/0031-owner-bookings-ics-feed-v1.md)
