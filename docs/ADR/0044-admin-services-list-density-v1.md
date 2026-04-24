# ADR 0044: Admin Services List Density v1

## Stav
schváleno

## Kontext
Sekce `Služby` už měla funkční quick actions i pravý detail drawer, ale samotný seznam byl stále složený z vysokých informačních karet. V provozu to zpomalovalo každodenní práci:

- na jednu obrazovku se vešlo málo služeb
- kategorie se opakovala u každé položky
- sekundární vysvětlující texty přehlušovaly hlavní metadata
- rychlé akce zabíraly zbytečně moc vertikálního prostoru

Potřebujeme zachovat stejnou business logiku, server actions i booking napojení, ale změnit seznam na hustší pracovní nástroj.

## Rozhodnutí
- Sekce `Služby` používá group-first layout podle kategorií místo jedné dlouhé sekvence samostatných karet.
- Každá kategorie se renderuje jako samostatná rozbalovací skupina s počtem služeb.
- Základní stav služby je kompaktní řádek s metadaty `název + délka + cena + stav + veřejná/interní + rezervace`.
- Sekundární kontext (`operationalContext`, warning detail, slotová omezení, pořadí) se přesouvá do rozbalené části řádku.
- Rychlé akce se přesouvají do menu `⋯`; nejběžnější přepínače `Aktivní/Neaktivní` a `Veřejná/Interní` zůstávají jako malé inline toggly na širších obrazovkách.
- Detail služby zůstává query-driven pravý drawer; seznam tedy nemění navigační model zavedený v ADR 0043.
- Filtry a souhrnný řádek nad seznamem jsou kompaktnější a filtr bar je sticky na desktopu.

## Důsledky

### Pozitivní
- Na obrazovku se vejde výrazně více služeb bez ztráty důležitých informací.
- Kategorie tvoří jasné provozní bloky a nezahlcují každý řádek opakovanou informací.
- Běžné provozní změny jsou rychlejší díky menším row actions a zachovanému drawer detailu.

### Negativní
- Část doplňujících informací už není vidět bez rozbalení řádku.
- Native `details/summary` interakce znamená jednodušší, ale méně řízený open/close model než plně klientský custom accordion.

## Alternativy
- Zachovat velké karty a jen zmenšit padding: zamítnuto, protože by zůstala stejná informační redundance.
- Přepnout seznam do klasické tabulky: odloženo, protože by hůře nesla mobilní zobrazení a inline expand kontext.
