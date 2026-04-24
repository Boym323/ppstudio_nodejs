# ADR 0045: Audit změn cen služeb v admin katalogu

## Stav
Accepted

## Kontext
Katalog služeb už umí bezpečně ukládat aktuální cenu do `Service.priceFromCzk` a historické rezervace si nesou vlastní snapshot v `Booking.servicePriceFromCzk`. Chyběla ale auditní odpověď na provozní otázku:

- kdo změnil cenu služby
- kdy ke změně došlo
- z jaké hodnoty na jakou se cena změnila

Pouhé spoléhání na `Service.updatedAt` nebo obecné server logy by nedávalo dostatečný provozní kontext a špatně by se filtrovalo při řešení reklamací nebo interním dohledávání změn ceníku.

## Rozhodnutí
- Přidáváme samostatný model `ServicePriceChangeLog`.
- Audit se zapisuje pouze při skutečné změně `Service.priceFromCzk`, ne při každém uložení formuláře služby.
- Záznam obsahuje:
  - `serviceId`
  - `changedByUserId`
  - `oldPriceFromCzk`
  - `newPriceFromCzk`
  - čas vytvoření
- Aktér změny se mapuje ze stejné admin session e-mail identity na `AdminUser.id`, kterou už používají jiné admin mutace.
- Audit zůstává v databázi, ne v `console` ani v obecných runtime logách.

## Důsledky

### Pozitivní
- změny ceníku jsou dohledatelné bez čtení aplikačních logů
- provoz může bezpečně ověřit, kdo a kdy cenu upravil
- historické rezervace zůstávají oddělené od aktuálního katalogu a auditní vrstva je doplňuje, ne nahrazuje

### Negativní
- přibývá další auditní tabulka a migrace
- rychlé toggly a jiné editace služby dál nemají vlastní audit, pokud nemění cenu
- aktuální iterace nepřidává UI historii v adminu; audit je zatím připravený hlavně pro troubleshooting a budoucí read model

## Alternativy
- Zapisovat změny ceny do `console` nebo externího log streamu: zamítnuto, protože to není spolehlivý ani pohodlně filtrovatelný zdroj pravdy.
- Ukládat změny do `Service.updatedAt` nebo do jednoho JSON pole: zamítnuto, protože by chyběla historie více změn a relační filtrování podle služby nebo aktéra.
- Rozšířit `BookingStatusHistory`: zamítnuto, protože změna ceníku není stavová událost rezervace, ale samostatná katalogová akce.
