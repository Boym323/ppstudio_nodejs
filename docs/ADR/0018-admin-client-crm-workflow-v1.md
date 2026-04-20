# ADR 0018: Lehký CRM workflow pro admin sekci Klienti

## Stav
Accepted

## Kontext
Projekt už měl v databázi model `Client`, ale admin sekce `Klienti` zatím fungovala jen jako read-only výpis několika posledních záznamů. To nestačilo pro reálný provoz:

- recepce neuměla rychle dohledat klientku podle telefonu nebo e-mailu
- chyběl detail klientky s kontakty, historií a rychlou cestou do rezervací
- pole `Client.internalNote` existovalo v modelu, ale nebylo dostupné v admin UI
- sekce `Klienti` běžela přes generický placeholder renderer, takže neměla prostor pro vlastní workflow

## Rozhodnutí
- Sekce `Klienti` získává vlastní serverový workflow na `/admin/klienti` a `/admin/provoz/klienti`.
- Seznam klientek podporuje:
  - fulltext přes jméno, e-mail, telefon a interní poznámku
  - filtr `aktivní / neaktivní / vše`
  - řazení podle poslední návštěvy, počtu rezervací, jména a vytvoření profilu
- Detail klientky je samostatná route:
  - `/admin/klienti/[clientId]`
  - `/admin/provoz/klienti/[clientId]`
- Detail ukazuje:
  - kontakty
  - souhrn aktivity a nejčastější službu
  - posledních 10 rezervací s rychlou navigací do detailu rezervace
  - editaci `Client.internalNote`
- Uložení poznámky probíhá přes samostatnou server action s opětovnou autorizací podle admin oblasti.

## Důsledky

### Pozitivní
- sekce `Klienti` je konečně provozně použitelná i bez zavádění těžkého CRM
- obsluha má rychlou cestu od hledání klientky k detailu rezervace nebo kontaktu
- interní poznámky se ukládají na správné doménové entitě `Client`, ne do snapshotů bookingů
- owner i salon sdílejí stejný datový model a rozdíl zůstává jen v oblasti a copy

### Negativní
- vzniká další vlastní admin workflow vedle `Služby`, `Kategorie služeb` a `Certifikáty`
- seznam klientek zatím nepodporuje stránkování ani audit historie úprav poznámky
- detail klientky zatím neupravuje další kontaktní pole ani aktivní stav profilu

## Alternativy
- Nechat sekci na generickém placeholder rendereru: zamítnuto, protože by dál chyběl detail, hledání i editace poznámky.
- Přidat klientský detail jen jako modal uvnitř seznamu: zamítnuto kvůli horší routovatelnosti, sdílení odkazu a menšímu prostoru pro další růst workflow.
- Postavit plnohodnotné CRM se samostatnou historií kontaktů a úkolů: zamítnuto pro aktuální scope jako zbytečně těžké řešení.
