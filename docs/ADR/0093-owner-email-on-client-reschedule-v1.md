# 0093 Owner Email On Client Reschedule v1

## Kontext

Owner v PP Studiu dostával e-mail při nové čekající rezervaci a při klientském zrušení, ale při self-service přesunu termínu od klientky šla pouze Pushover notifikace. Pokud Pushover nebyl zapnutý, provozní tým se o změně dozvěděl až při ruční kontrole adminu.

## Rozhodnutí

- Při self-service přesunu rezervace (`changedByClient=true`) zakládáme navíc admin e-mail log s `templateKey = admin-booking-rescheduled-v1`.
- Příjemce je `SiteSettings.notificationAdminEmail`.
- E-mail obsahuje:
  - službu,
  - původní a nový termín,
  - klientku + e-mail,
  - přímý odkaz na owner detail rezervace v adminu.
- Notifikace se neposílá, pokud je `notificationAdminEmail` prázdný.
- Při přesunu vyvolaném z adminu (`changedByClient=false`) se tento nový e-mail nezakládá.

## Alternativy

- Posílat e-mail i při interním admin přesunu.
  - Zamítnuto pro v1, protože admin změnu právě provádí v UI a další e-mail by byl spíš duplicitní šum.
- Spolehnout se jen na Pushover.
  - Zamítnuto, protože Pushover je volitelný kanál a nemusí být vždy aktivní.

## Důsledky

- Owner má e-mailové pokrytí všech hlavních klientských změn rezervace (nová čekající, zrušená, přesunutá).
- Outbox (`EmailLog`) obsahuje další záznam typu `BOOKING_RESCHEDULED` s admin šablonou, takže monitoring a debugging zůstává v jednom workflow.

## Stav

schváleno
