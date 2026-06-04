# ADR 0100: Změna služby v detailu rezervace

## Kontext
- V provozu vzniká reálná potřeba ponechat existující rezervaci, ale po konzultaci na místě přepsat typ péče na jinou službu.
- Dosavadní admin detail rezervace uměl změnit stav, cenu, termín, voucher a poznámky, ale ne samotnou službu.
- Ruční zásah mimo aplikaci by rozbil auditní stopu a mohl by ponechat nekonzistentní snapshot délky, cleanup blokace nebo voucherových vazeb.

## Rozhodnutí
- Do admin detailu rezervace přidáváme samostatnou akci `Změnit službu`.
- Akce je povolená jen pro rezervace ve stavu `PENDING` a `CONFIRMED`.
- Při uložení server přepočítá snapshot služby:
  - `serviceId`
  - `serviceNameSnapshot`
  - `serviceDurationMinutes`
  - `cleanupMinutes`
  - `cleanupBlockMinutes`
  - `servicePriceFromCzk`
  - `scheduledEndsAt`
  - `blockedUntil`
- Mutace musí validovat, že se nová služba stále vejde do aktuálního termínu, respektuje omezení slotu a nekoliduje se službovým voucherem navázaným na jinou službu.
- Audit ukládáme do `BookingStatusHistory` se stejným booking statusem a metadaty před/po změně; nepřidáváme novou databázovou tabulku.

## Alternativy
- Vynutit ruční zrušení a vytvoření nové rezervace.
- Přidat samostatný model `BookingServiceChangeLog`.
- Povolit změnu i u dokončených rezervací a spoléhat na ruční kontrolu plateb/voucherů.

## Důsledky
- Provoz získá bezpečnou UI cestu bez zásahu do DB a bez ztráty historie rezervace.
- Snapshot rezervace zůstane konzistentní s novou službou i při odlišné délce nebo cleanup blokaci.
- Individuální finální cena rezervace se při změně služby zachovává; pokud je potřeba jiná úhrada, navazuje samostatná akce `Upravit cenu`.
- Trade-off: změna je záměrně konzervativní. Pokud se nová služba do původního času nevejde nebo nesedí ke službovému voucheru, operátorka musí nejdřív upravit termín nebo voucher.

## Stav
- schváleno
