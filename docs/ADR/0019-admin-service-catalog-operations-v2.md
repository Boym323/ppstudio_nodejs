# ADR 0019: Provozně orientovaný admin katalog služeb a kategorií

## Stav
Accepted

## Kontext
První produkční verze sekcí `Služby` a `Kategorie služeb` už byla funkční, ale v reálném provozu kosmetického salonu narážela na několik slabin:

- seznam fungoval spíš jako navigace do detailu než jako pracovní plocha
- chyběly rychlé akce přímo v kartách seznamu
- založení nové služby nebo kategorie nebylo dostatečně viditelné
- mobilní flow vedlo na dlouhé scrollování seznamu a detailu pod sebou
- ruční práce se `sortOrder` byla příliš technická pro běžnou obsluhu
- v seznamech chyběl kontext, proč je položka problematická nebo fakticky skrytá

## Rozhodnutí
- Desktop zachovává split seznam + detail, ale seznam dostává roli hlavní pracovní plochy.
- Mobilní admin používá query-driven list/detail režim přes stejné route:
  - `mode=create`
  - `mobileDetail=1`
- Sekce `Služby` nově podporuje:
  - CTA `Nová služba`
  - filtr podle kategorie vedle fulltextu, stavu, veřejné rezervace a řazení
  - quick actions `aktivovat/deaktivovat`, `veřejná/interní`, `duplikovat`, `posunout`
  - provozní warningy a kontext v kartách seznamu
- Sekce `Kategorie služeb` nově podporuje:
  - CTA `Nová kategorie`
  - quick actions `aktivovat/deaktivovat`, `posunout`, `zobrazit služby`
  - warningy pro prázdné kategorie, aktivní kategorie bez veřejných služeb a neaktivní kategorie s aktivními službami
  - CTA `Vytvořit službu v této kategorii`
- Reorder zůstává minimálně invazivní:
  - bez nové drag-and-drop knihovny
  - přes jednoduché serverové akce `nahoru / dolů`
  - s následným přepočtem `sortOrder` do stabilních kroků

## Důsledky

### Pozitivní
- běžné provozní změny jsou rychlejší a nevyžadují otevření detailu
- admin je čitelnější pro netechnického uživatele
- mobilní použití je výrazně praktičtější bez nové routovací složitosti
- server-first přístup zůstává zachovaný i pro create a quick action workflow

### Negativní
- query-driven UI stav (`mode`, `mobileDetail`) zvyšuje počet podporovaných URL variant uvnitř stejné sekce
- quick actions zvyšují počet server actions, které je potřeba při dalších úpravách držet konzistentní
- `sortOrder` zůstává technicky v modelu dál, i když běžný uživatel už s ním pracuje méně přímo

## Alternativy
- Přidat samostatné route pro create a mobile detail: zamítnuto jako zbytečné rozšíření IA pro relativně malý admin modul.
- Nasadit drag-and-drop knihovnu pro pořadí: zamítnuto kvůli složitosti, bundle costu a slabší předvídatelnosti na mobilu.
- Zachovat jen detail formuláře a nezvyšovat počet rychlých akcí: zamítnuto, protože to neřeší hlavní provozní bolest každodenní práce.
