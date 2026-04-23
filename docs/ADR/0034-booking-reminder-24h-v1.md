# ADR 0034: Booking reminder 24h v1

## Stav
Accepted

## Kontext
Rezervační systém už používá `EmailLog` outbox a samostatný `email:worker`, ale dosud neuměl automaticky připomenout potvrzený termín klientce před návštěvou. Potřebujeme jediný reminder 24 hodin předem bez dalšího scheduler procesu, bez nové queue a bez vícestupňového workflow.

## Rozhodnutí
- Přidáváme do `Booking` jediné pole `reminder24hSentAt`, které slouží jako trvalá informace, že reminder byl opravdu doručený nebo v log módu uzavřený.
- Reminder vybírá jen `CONFIRMED` rezervace s vyplněným `clientEmailSnapshot`, `reminder24hSentAt = null` a začátkem v okně `now + 23h` až `now + 25h`.
- Reminder scheduler běží uvnitř existujícího `email:worker` procesu každých 5 minut; nevzniká nový mail sender ani samostatná queue.
- Scheduler nikdy neposílá e-mail přímo. V transakci pouze vytvoří reminder `EmailLog` typu `BOOKING_REMINDER` a navázaný `BookingActionToken` pro storno link.
- Před skutečným doručením worker reminder znovu preflightově ověří, že rezervace je stále `CONFIRMED`, ještě nezačala a nebyla už označená jako připomenutá.
- `reminder24hSentAt` se v `background` režimu nastavuje až po úspěšném `SENT`; v `log` režimu se nastaví při uzavření reminder `EmailLog`, protože k reálnému SMTP odeslání nedochází.
- Reminder šablona `booking-reminder-24h-v1` je krátká, bez `.ics` přílohy, s lidským headline a hierarchií `služba -> datum a čas -> kde nás najdete`; v CTA sekci vede nejdřív kontakt na studio a storno zůstává jen jako sekundární akce.

## Důsledky
- Idempotence stojí na kombinaci `Booking.reminder24hSentAt`, transakčního claimu kandidátky a existence reminder `EmailLog`.
- Pokud SMTP doručení selže, `EmailLog` přejde do retry/failed stavu a systém nevytvoří nový reminder job; provoz pracuje s jedním auditním záznamem a případným ručním retry.
- Pokud se rezervace po enqueue změní nebo zruší, worker reminder uzavře jako `system-skip` bez odeslání.
- Změna nevyžaduje žádnou novou env proměnnou ani externí službu.
