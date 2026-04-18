# ADR 0003: Prisma schema v1 pro booking a provoz salonu

## Stav
Accepted

## Kontext
Projekt potřebuje produkčně použitelnou databázovou vrstvu pro:

- luxusní prezentační web s reálnou rezervací
- ručně vypisované volné termíny místo pevné otevírací doby
- owner admin i lite admin pro provoz salonu
- auditovatelný booking workflow bez slepých uliček

Bootstrap schema stačilo pro první scaffold, ale bylo příliš úzké:

- slot byl navázaný maximálně na jednu službu
- rezervace neukládala snapshot služby ani času
- chyběla historie stavů, klientská entita, e-mailový audit a bezpečné tokeny

## Rozhodnutí
Zavádíme Prisma schema v1 s těmito principy:

- `AvailabilitySlot` je hlavní entita dostupnosti a vzniká ručně v adminu
- omezení slotu na služby řeší M:N vazba `AvailabilitySlotService`
- `Booking` drží snapshot klienta, služby a naplánovaného času
- `Client` je samostatná entita pro opakované rezervace a historii komunikace
- `BookingStatusHistory` slouží jako auditní log stavových změn
- `BookingActionToken` ukládá hash tokenu pro storno a přesun termínu
- `EmailLog` drží doručovací audit a vazbu na booking/token workflow
- `Setting` je generické úložiště serverových nastavení
- admin role jsou `OWNER` a `SALON`

## Důsledky

### Pozitivní
- booking flow jde stavět server-first bez přestavby schématu
- ručně spravované sloty zůstávají flexibilní i pro různé délky služeb
- historická data zůstávají konzistentní po změnách katalogu služeb
- storno a přesun termínu lze postavit bezpečně bez ukládání raw tokenů
- owner a salon admin mají společný základ s jasně oddělenou rolí

### Negativní
- write model je bohatší a vyžaduje disciplinovanou server-side orchestrace
- některé invarianty (např. zda restricted slot opravdu obsahuje allowed služby) musí hlídat aplikační vrstva
- starší bootstrap data je potřeba při migraci převést a zvalidovat

## Alternativy
- Jeden slot = jedna služba: zamítnuto, protože by to brzy blokovalo kombinace služeb a provozní flexibilitu.
- Ukládat tokeny v plaintextu: zamítnuto kvůli zbytečnému bezpečnostnímu riziku.
- Držet historii jen v `Booking.updatedAt`: zamítnuto, protože to neposkytuje audit ani kontext změn.
- Bez entity `Client`, pouze snapshot v rezervaci: zamítnuto, protože by se špatně stavěl provozní přehled, historie a komunikace.
