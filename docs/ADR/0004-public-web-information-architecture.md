# ADR 0004: Informační architektura veřejného webu salonu

## Stav
Accepted

## Kontext
Veřejná část webu má plnit dvě role zároveň:

- budovat důvěru a prémiové vnímání značky
- vést klientku co nejpřirozeněji k rezervaci

Zároveň nechceme generovat falešný demo obsah ani tvrdě zadrátovat texty přímo do jednotlivých komponent.

## Rozhodnutí
Veřejný web stavíme jako sadu statických prezentačních rout nad centrálním obsahem v `src/content/public-site.ts`.

Použité principy:

- route-first IA pro stránky `domů`, `služby`, `detail služby`, `ceník`, `o salonu`, `kontakt`, `FAQ` a právní stránky
- tenké route soubory v `src/app/(public)`
- reusable sekce a page šablony ve `src/features/public/components`
- realistické placeholder texty jasně oddělené od layout logiky
- detail služby jako samostatná staticky generovaná route pro lepší SEO a budoucí škálování katalogu

## Důsledky

### Pozitivní
- obsah lze měnit bez zásahu do rout nebo komponent
- přidání nové služby znamená hlavně úpravu centrálního obsahu, ne další architektonický dluh
- veřejná část zůstává mobilně čitelná a konzistentní napříč stránkami
- právní a provozní informace jsou od začátku součástí IA, ne až dodatek před spuštěním

### Negativní
- placeholder obsah je nutné před produkčním spuštěním pečlivě nahradit reálnými texty, cenami a fotografiemi
- bez navazující CMS nebo admin správy obsahu zůstává editace zatím v kódu

## Alternativy
- Všechen obsah přímo uvnitř route komponent: zamítnuto kvůli horší udržovatelnosti.
- Jedna dlouhá homepage bez podpůrných podstránek: zamítnuto kvůli slabšímu SEO i důvěryhodnosti.
- Fake promo sekce s generickými tvrzeními: zamítnuto, protože cílem je produkčně použitelný základ, ne demo.
