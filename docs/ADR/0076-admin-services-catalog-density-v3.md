# 0076 Admin Services Catalog Density V3

## Kontext
- Sekce `Služby` už po předchozích úpravách fungovala jako group-first katalog běžného salonního portfolia.
- Po skrytí systémových/testovacích položek z běžného pohledu ale horní KPI i část seznamové hlavičky stále působily jako starší technický přehled, ne jako finální provozní katalog.
- Největší slabiny byly:
  - KPI `Aktivní / Neaktivní / Veřejné / Interní / problémy` počítané mimo aktuální běžný pohled a s příliš technickým jazykem
  - zbytečně vysoký metric strip a dlouhé vysvětlovací texty
  - kategorie bez stručného provozního souhrnu veřejných a interních položek
  - řádky služeb, které na desktopu pořád nesly moc vertikální výšky kvůli vícevrstvému layoutu

## Rozhodnutí
- KPI strip sjednocujeme na katalogové metriky počítané jen z aktuálně zobrazeného běžného pohledu:
  - `Veřejné služby`
  - `Kategorie`
  - `Interní / skryté`
  - `Vyžaduje kontrolu`
- KPI strip zůstává nízký a používá jen krátké sekundární popisky.
- Seznamová hlavička `Přehled služeb` ponechává CTA `Nová služba`, ale dlouhé vysvětlení nahrazuje krátké copy `Kompaktní seznam pro běžné provozní změny.`
- Jediné CTA `Nová služba` je v horní hlavičce stránky; toolbar už neduplikuje akci ani mezititulek.
- Stavová legenda se přesouvá do malého rozbalovacího prvku `Legenda stavů` namísto samostatné vysvětlující vrstvy nad filtry.
- Souhrn seznamu ukazuje jen `V seznamu / Skupin / Viditelné / Upozornění` a explicitně připomíná, že systémové/testovací položky jsou v běžném katalogu skryté.
- Hlavička každé kategorie zobrazuje počet služeb, veřejných, interních/skrytých a případně upozornění s přirozenějším textem typu `žádná interní/skrytá`, `1 interní/skrytá`, `X interní/skryté`; samotné řádky služeb jsou na desktopu jednovrstvé a sekundární provozní kontext se otevírá až v rozbalení.

## Alternativy
- Zachovat původní KPI `Aktivní / Neaktivní / Veřejné / Interní / problémy`: zamítnuto, protože metriky působily spíš jako technická evidence než jako provozní souhrn katalogu.
- Použít `Bez ceny` místo `Kategorie`: odloženo. Hodnota může být provozně zajímavá, ale v aktuálním běžném katalogu dává větší orientační smysl počet skupin.
- Nechat inline toggly přímo v základním desktop řádku: zamítnuto, protože zvyšovaly vizuální šum a zhoršovaly jednorázovou čitelnost seznamu.

## Důsledky
- KPI i summary jsou nyní pravdivé vůči aktuálnímu filtrovanému běžnému katalogu.
- Systémové/testovací položky zůstávají uložené a skryté; změna je čistě v prezentační vrstvě a read-model souhrnu.
- Seznam služeb je hustší a vhodnější pro každodenní provozní zásahy bez otevření detailu.

## Stav
- schváleno
