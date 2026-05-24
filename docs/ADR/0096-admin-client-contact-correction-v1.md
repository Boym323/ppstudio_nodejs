# ADR 0096: Admin oprava kontaktu klientky v1

## Kontext

V provozu se může stát, že klientka zadá překlep v e-mailu nebo telefonu. Dosavadní cesta přes přímou úpravu databáze byla zbytečně riziková a neodpovídala běžnému workflow salonu. Samotný profil klientky navíc nestačí, protože aktivní rezervace a navazující booking e-maily používají snapshot polí na `Booking`.

## Rozhodnutí

- Detail klientky v adminu dostává kompaktní formulář `Upravit kontakt` v kartě `Kontakt`.
- Server action `updateClientContactAction` validuje e-mail a telefon, vyžaduje admin oprávnění pro aktuální oblast a odmítne duplicitní `Client.email`.
- Úprava zapisuje `Client.email` a `Client.phone`.
- Stejná transakce propíše kontakt do aktivních rezervací klientky ve stavech `PENDING` a `CONFIRMED`.
- Dosud neodeslané e-mail logy k těmto aktivním rezervacím se přesměrují na nový `recipientEmail`, pokud ještě nejsou claimnuté workerem.
- Každý propis kontaktu do aktivní rezervace vytváří auditní záznam v `BookingStatusHistory` (`reason: Kontakt klientky upraven`) s metadaty původního a nového kontaktu.

## Alternativy

- Upravit jen `Client`: zamítnuto, protože potvrzení, remindery a self-service e-maily čtou booking snapshot.
- Přidat obecný editor rezervace: odloženo, protože aktuální potřeba je provozní oprava kontaktu a detail klientky je přirozené místo pro CRM data.
- Řešit pouze přes Prisma Studio: zamítnuto pro běžný provoz, protože je to příliš technické a náchylné k omylu.

## Důsledky

- Běžnou opravu překlepu lze udělat bez DB zásahu.
- Historické uzavřené rezervace zůstávají auditně beze změny.
- Aktivní rezervace mají dohledatelnou stopu kontaktové změny v auditní historii rezervace.
- Již odeslané e-mail logy se nemění; případné opakované odeslání potvrzení zůstává samostatné rozhodnutí.

## Stav

Schváleno.
