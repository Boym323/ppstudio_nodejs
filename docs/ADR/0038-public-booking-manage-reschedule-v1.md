# ADR 0038: Public Booking Manage Reschedule V1

## Kontext

Admin detail rezervace už má centrální doménovou akci `rescheduleBooking(...)`, ale veřejný klientský flow dosud končil jen placeholderem `Požádat o změnu` přes `mailto:`. Potřebujeme umožnit klientce bezpečně změnit termín bez přihlášení, bez veřejného `bookingId` a bez rozštěpení backend logiky.

## Rozhodnutí

- Přidáváme veřejnou route `/rezervace/sprava/[token]` nad hashovaným `BookingActionToken` typu `RESCHEDULE`.
- Manage screen ukazuje kontext změny, kompaktní aktuální rezervaci, hybridní výběr nového termínu a samostatné potvrzení. `Zrušit rezervaci` je až na konci jako sekundární textová akce.
- Výběr termínu má model `nejbližší dostupné termíny -> kalendář -> sloty pro vybraný den`: rychlé chips jsou primární cesta, kalendář je fallback pro konkrétní den a po výběru času se bez redirectu scrolluje na potvrzení.
- Online změna je povolená jen pro `PENDING` a `CONFIRMED` rezervace a jen do stejného limitu jako self-service storno (`SiteSettings.bookingCancellationHours`).
- Klientský submit volá stejné `rescheduleBooking(...)` jako admin. Veřejná vrstva jen řeší token validaci, UI copy a mapování user-facing chyb.
- Audit zůstává v `BookingRescheduleLog`, ale veřejný flow zapisuje `changedByClient = true` a `changedByUserId = null`.
- Reminder, confirmation a reschedule e-maily nově generují bezpečný manage link `Změnit termín`; do DB se ukládá jen hash tokenu.
- Matomo na tokenové manage route neposílá pageview s tokenem, ale klientské handlery mohou poslat neosobní eventy `Booking / Date selected` a `Booking / Time selected`.

## Alternativy

- Nechat `mailto:` placeholder: zamítnuto, provozně zatěžuje salon a negarantuje validaci ani audit.
- Zavést samostatnou veřejnou reschedule implementaci mimo `rescheduleBooking(...)`: zamítnuto, vysoké riziko driftu validací, reminderů a historie.
- Otevřít manage flow přes veřejné `bookingId`: zamítnuto, nevyhovuje bezpečnostním požadavkům.

## Důsledky

- Klientka může bezpečně a sama změnit termín bez přihlášení.
- Veřejný flow je dál striktně řízený: žádná změna služby, žádné ruční datum/čas, žádný zápis bez potvrzení. UX ale zrychluje nejčastější cestu přes nejbližší dostupné časy a drží kalendář jako sekundární navigaci.
- V systému vzniká více krátkodobých `RESCHEDULE` a `CANCEL` tokenů navázaných na klientské e-maily a manage obrazovky; audit a expirace ale zůstávají v jednom modelu.
- Provoz má po deployi ručně ověřovat nejen admin reschedule, ale i veřejný manage link a zapisování `changedByClient`.

## Stav

schváleno
