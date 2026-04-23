# ADR 0037: Admin přesun termínu rezervace v1

## Stav
Accepted

## Kontext
Admin dosud uměl rezervaci potvrdit, zrušit nebo doplnit interní poznámku, ale změna termínu nebyla samostatná doménová akce. Technicky existovala historická příprava na reschedule chain mezi bookingy, ta ale neodpovídá provoznímu požadavku, aby rezervace při přesunu zůstala stejným `Booking` záznamem.

Salon i owner potřebují přesun termínu řešit jako řízený workflow:
- se stejnou validací jako veřejný booking a ruční admin booking
- s auditní historií původního a nového času
- s korektním přepočtem reminderů a kalendářových výstupů
- s vlastním klientským e-mailem `BOOKING_RESCHEDULED`

## Rozhodnutí
- Přesun termínu zavádíme jako samostatnou backend službu `rescheduleBooking(...)`.
- Booking při přesunu zůstává stejný záznam; `scheduledStartsAt`, `scheduledEndsAt`, `slotId` a navázaná metadata se mění in-place.
- Auditní stopa se neukládá do `BookingStatusHistory`, ale do nové tabulky `BookingRescheduleLog` s původním i novým intervalem.
- `Booking` dostává metadata `rescheduleCount` a `reminder24hQueuedAt`; dosavadní `rescheduledAt` zůstává jako poslední timestamp přesunu.
- Admin detail rezervace dostává samostatnou akci `Přesunout termín`, která otevírá pravý drawer s vlastním formulářem, validací, důvodem změny a volbami notifikace klientce.
- UI OWNER i SALON používá stejnou server action a stejnou doménovou službu; rozdíl je jen v routě a copy vrstvě.
- Reminder architektura nově neblokuje další reminder jen podle existence starého `EmailLog`, ale podle `Booking.reminder24hQueuedAt`; při přesunu se queue marker resetuje.

## Důsledky

### Pozitivní
- přesun termínu už není tichá editace času bez historie
- validace slotů, kolizí, délky služby a interních výjimek zůstává centralizovaná na backendu
- klientka dostává vlastní e-mail o změně termínu, ne znovu původní potvrzení
- sjednocená timeline v detailu rezervace ukazuje jak stavové změny, tak reschedule události
- reminder worker po přesunu znovu pracuje s novým termínem a staré queue markery neblokují nový reminder

### Negativní
- schéma přidává nový auditní model a další booking metadata
- doménová služba reschedule musí navíc uvolňovat původní interní override slot, aby po přesunu neblokoval původní čas
- historický self-relation chain v `Booking` zůstává ve schématu jako legacy pole, ale nová logika ho už nepoužívá

## Alternativy
- Prostá editace `scheduledStartsAt` / `scheduledEndsAt`: zamítnuto, protože by chyběla samostatná auditní akce, dedikované UI i návazná workflow.
- Vytvářet při přesunu nový booking a původní rušit: zamítnuto, protože by se rozpadla identita rezervace, reminder návaznost i klientské odkazy.
- Uložit reschedule jen do `BookingStatusHistory`: zamítnuto, protože status a přesun termínu jsou dvě různé doménové události s jinou strukturou dat.
