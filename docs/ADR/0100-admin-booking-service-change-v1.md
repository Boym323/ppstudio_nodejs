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
- Mutace musí validovat pokrytí publikovanou dostupností, omezení slotu, kolize, automatický oběd a službové vouchery. Od 4. 11. 2026 může administrátor výslovně povolit prodloužení mimo publikované pokrytí jako interní výjimku při zachování začátku; původní vlastní rezervace a úklid se nahradí jedním zápisem.
- Audit ukládáme do `BookingStatusHistory` se stejným booking statusem a metadaty před/po změně; nepřidáváme novou databázovou tabulku.

## Alternativy
- Vynutit ruční zrušení a vytvoření nové rezervace.
- Přidat samostatný model `BookingServiceChangeLog`.
- Povolit změnu i u dokončených rezervací a spoléhat na ruční kontrolu plateb/voucherů.

## Důsledky
- Provoz získá bezpečnou UI cestu bez zásahu do DB a bez ztráty historie rezervace.
- Snapshot rezervace zůstane konzistentní s novou službou i při odlišné délce nebo cleanup blokaci.
- Individuální finální cena rezervace se při změně služby zachovává; pokud je potřeba jiná úhrada, navazuje samostatná akce `Upravit cenu`.
- Aktivní rezervace s archivovaným zdrojovým termínem smí bez nové výjimky změnit službu uvnitř již držené blokace včetně úklidu, při respektování omezení služby. Historický slot se tím nepřepisuje. Při chybějícím pokrytí je prodloužení možné pouze s výslovnou volbou interní výjimky. Kolizi s jinou rezervací, chráněnou dostupností, interním blokem, automatickým obědem ani konfliktním voucherem nelze touto volbou obejít.
- Náhled po výběru služby stejnými serverovými pravidly bez zápisu ověří, zda změna projde, vyžaduje potvrzení výjimky, nebo jí brání konkrétní překážka. Zobrazuje konec služby a úklidu v pražském čase; potvrzení se nabídne jen pro potřebnou výjimku a uložení pravidla znovu ověří. Audit dokládá původní zdroje dostupnosti, aby po zkrácení, přesunu či stornu nevznikla veřejná nabídka nově přidaného času.

## Oznámení klientce (5. 11. 2026)

- Formulář nabízí výchozí zaškrtnutou volbu **Informovat klientku e-mailem**; při chybějící adrese je neaktivní a zobrazí vysvětlení. Odškrtnutí oznámení potlačí.
- Změna rezervace, vytvoření odkazů a `EmailLog` vzniknou v jedné serializované transakci. Při selhání přípravy oznámení se změna vrátí zpět; po commitu řeší doručení existující worker a jeho retry/incidenty.
- Šablona `booking-service-changed-v1` používá stávající typ `GENERIC` s vazbou na rezervaci a generací komunikace. Zpráva obsahuje původní a novou službu, aktuální konec návštěvy, ceníkovou či zachovanou individuální cenu a stav rezervace. Při neznámé ceně se částka neslibuje.
- Kalendářová příloha zachovává UID rezervace a aktualizuje službu i konec návštěvy; nezahrnuje úklid. U čekající rezervace používá `TENTATIVE`, u potvrzené `CONFIRMED`. Import přílohy do osobního kalendáře závisí na klientčině aplikaci.
- Před odesláním se ověří aktuální služba, čas, stav, cena, příjemce a generace komunikace; starší oznámení po další změně se přeskočí. Náhled nic nezakládá. V režimu `log` se doručení pouze zaznamená a citlivé odkazy se redigují.

## Stav
- schváleno
