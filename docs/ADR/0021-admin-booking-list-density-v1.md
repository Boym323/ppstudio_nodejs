# ADR 0021: Kompaktni pracovni seznam rezervaci v1

## Kontext

Sekce `Rezervace` vznikla puvodne nad generickym rendererem admin sekci. To bylo rychle na postaveni, ale pro kazdodenni provoz to zacalo vadit:

- rezervace byly zobrazeny jako vysoke vertikalni karty
- na obrazovce bylo malo radku a obsluha musela zbytecne scrollovat
- potvrzeni nebo storno vyzadovalo otevrit detail i v pripade jednoduche akce
- horni statistiky byly citelne, ale zbytecne vysoke vzhledem k provozni obrazovce

## Rozhodnuti

- Sekce `Rezervace` prestane pouzivat genericky `AdminKeyValueList` a dostane vlastni workflow komponentu `admin-bookings-page.tsx`.
- Hlavni seznam bude renderovany jako husty radkovy grid se sloupci:
  - rezervace
  - cas
  - status
  - zdroj
  - kontakt
  - akce
- Kazdy radek ma zustat maximalne na 1-2 textovych radcich v jednotlivych bunkach.
- Rychle akce `Potvrdit` a `Zrusit` pobezi primo ze seznamu pres server action bez nutnosti otevrit detail.
- Odkaz `Detail` zustane soucasti kazdeho radku jako bezpecna cesta pro slozitejsi praci.
- Horni statistiky budou zmenene z velkych karet na kompakti summary listu v jednom radku.
- Hlavicka seznamu zustane sticky, aby byly sloupce citelne i pri delsim scrollu.

## Alternativy

- Pouze upravit spacing generickeho seznamu: zamitnuto, protoze genericka struktura nepocitala se sloupci ani inline akcemi.
- Presunout vsechny akce do detailu: zamitnuto, protoze bezne potvrzeni nebo storno je casta a jednoducha operace.
- Plnohodnotna tabulka s rozsahlymi filtry a bulk akcemi: odlozeno, protoze by to rozsah teto iterace zbytecne zvetsilo.

## Dusledky

- Read model rezervaci musi dodat vic explicitnich poli pro kompaktni seznam, ne jen `title/meta/description`.
- Sekce `Rezervace` se odpojuje od generic section rendereru podobne jako drive `Služby`, `Kategorie služeb` nebo `Klienti`.
- Manualni QA ma pokryt desktopovou hustotu, sticky header a inline zmenu stavu bez otevreni detailu.

## Stav

schvaleno
