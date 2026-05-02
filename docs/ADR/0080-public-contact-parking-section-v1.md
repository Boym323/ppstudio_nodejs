# ADR 0080: Public contact parking section v1

## Kontext
- Stránka `/kontakt` ukazuje mapu, rychlé kontakty a provozní údaje, ale pro klientky přijíždějící autem chyběla krátká informace k parkování.
- Nechceme na veřejném webu slibovat vyhrazené parkovací místo, pokud není ověřené a provozně garantované.
- Parkovací informace má být praktická, viditelná hned pod mapou a kontakty a zároveň nemá vytvářet další samostatnou velkou sekci.

## Rozhodnutí
- Parkování zobrazujeme jako kompaktní full-width informační blok `ContactParkingInfoCard` pod kontaktní mřížkou na stránce `/kontakt`.
- Text je statický v `ContactPage` a říká, že parkování je možné v okolí Sadové ulice a že při cestě autem je vhodné nechat si pár minut rezervu.
- Blok používá stejný vizuální jazyk jako mapový náhled a kontaktní panel, včetně malé ikonky a uppercase labelu `Parkování`.
- Mapový preview card zůstává zaměřený na adresu a Google Maps odkaz; jeho výšku držíme kompaktní, aby spodní část kontaktu nepůsobila prázdně.
- Kliknutí na adresu/mapovou kartu vede na konkrétní firemní profil `Kosmetika | Pavlína Pomykalová` v Google Maps, ne na obecné vyhledání adresy.

## Důsledky
- Klientka uvidí parkovací informaci přes celou šířku pod mapou a rychlým kontaktem, tedy ve stejné části stránky jako adresu, trasu a kontakt.
- Pokud studio později získá ověřené přesnější parkovací instrukce, stačí upravit text v `ContactPage`, případně ho přesunout do settings/content vrstvy.
- Nezavádíme novou databázovou položku, CMS pole, env proměnnou ani integraci s mapami pro parkovací místa.

## Stav
- schváleno
