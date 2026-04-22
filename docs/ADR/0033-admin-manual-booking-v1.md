# ADR 0033: Admin Manual Booking V1

## Kontext

Salon v praxi nevytváří rezervace jen přes veřejný web. Část termínů vzniká telefonicky, přes Instagram, osobně nebo při opakované domluvě s klientkou na konci předchozí návštěvy.

Admin proto potřebuje:
- rychle zapsat ruční rezervaci v owner i salon oblasti
- nepoužívat paralelní "jiný typ" rezervace
- zachovat stejnou logiku služby, slotu, kolizí, klientky, emailů a kalendáře jako u veřejného booking flow
- mít auditní stopu, pokud termín vznikne jako interní výjimka mimo veřejnou dostupnost

## Rozhodnutí

Ruční rezervaci implementujeme jako běžný `Booking` nad jedním sdíleným create enginem v booking doméně.

### Klíčové body

- Nevzniká nový model ani nový typ rezervace.
- Veřejný booking i ruční admin booking používají stejnou serverovou create logiku.
- Rozdíl mezi public a admin vstupem je jen v:
  - dostupném UI
  - povolení interní výjimky mimo veřejnou dostupnost
  - volitelných notifikacích
  - audit metadatech
- `BookingSource` nově popisuje skutečný původ rezervace:
  - `WEB`
  - `PHONE`
  - `INSTAGRAM`
  - `IN_PERSON`
  - `OTHER`
- `Booking` se rozšiřuje o:
  - `isManual`
  - `manualOverride`

## Provozní model

- Admin sekce `Rezervace` dostává CTA `Přidat rezervaci`.
- CTA otevírá pravý drawer s formulářem rozděleným do sekcí:
  - klientka
  - služba
  - termín
  - původ rezervace
  - stav rezervace
  - oznámení
  - interní poznámka
- Termín jde zadat dvěma způsoby:
  - výběr ze slotů respektujících veřejnou dostupnost
  - ruční datum a čas
- Pokud ručně zadaný termín neleží ve veřejné dostupnosti, systém upozorní na interní výjimku a nastaví `manualOverride = true`.

## Validace a audit

- Backend vždy validuje:
  - existenci a aktivitu služby
  - délku služby
  - kolizi s jinou aktivní rezervací
  - kolizi s interně blokovaným časem
  - vazbu na dostupný slot nebo vytvoření interního draft slotu pro výjimku
- Klientka se řeší deduplikačně přes:
  - explicitně vybraný profil
  - přesnou shodu e-mailu
  - přesnou shodu telefonu
- Do auditní stopy se ukládá:
  - `source`
  - `isManual`
  - `manualOverride`
  - `createdByUserId`
  - záznam do `BookingStatusHistory`

## Napojení na další flow

- Volitelný klientský e-mail používá stávající `EmailLog` flow.
- Potvrzená ruční rezervace může stejně jako běžná rezervace poslat `booking-approved-v1`.
- `.ics` příloha zůstává volitelná, ale používá stejnou existující kalendářovou utilitu.
- `CONFIRMED` rezervace se dál standardně propše do owner ICS feedu.

## Nezvolené alternativy

- Samostatný model `ManualBooking`:
  - zamítnuto, vedl by k driftu doménové logiky a dvojím pravidlům
- Bokem vedená admin-only mutace bez reuse veřejného create flow:
  - zamítnuto, vysoké riziko odlišných validací a rozbití email/calendar návazností
- Tvrdý zákaz rezervace mimo veřejnou dostupnost:
  - zamítnuto, neodpovídá reálnému provozu salonu

## Dopady

- Přibyla migrace `20260422230500_manual_booking_admin_v1`.
- Admin list rezervací se rozšířil o ruční create drawer.
- Booking doména nově centralizuje create logiku pro public i admin vstup.
- Role `OWNER` a `SALON` mají v ruční rezervaci stejné možnosti i chování.
