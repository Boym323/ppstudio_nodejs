# ADR 0080: Public contact parking section v1

## Kontext
- Stránka `/kontakt` ukazuje mapu, rychlé kontakty a provozní údaje, ale pro klientky přijíždějící autem nestačil jeden obecný odstavec k rychlému rozhodnutí, kde zaparkovat.
- Nechceme na veřejném webu slibovat vyhrazené parkovací místo, pokud není ověřené a provozně garantované.
- Parkovací informace má být praktická, viditelná hned pod mapou a kontakty a zároveň nemá vytvářet další samostatnou velkou sekci.
- Typická návštěva kosmetického salonu trvá zhruba 90-120 minut, proto sekce nemá opisovat kompletní sazebníky, ale ukázat doporučení právě pro tuto délku návštěvy.

## Rozhodnutí
- Parkování zobrazujeme jako kompaktní full-width blok `ContactParkingInfoCard` pod kontaktní mřížkou na stránce `/kontakt` a zachováváme anchor `id="parkovani"` pro `/kontakt#parkovani`.
- Blok používá stejný vizuální jazyk jako mapový náhled a kontaktní panel, ale místo jednoho odstavce renderuje 4 nízké tip cards:
  - `Hradská` jako nejlevnější volbu
  - `Gahurova` jako kompromis cena / vzdálenost
  - `Sadová` jako nejbližší variantu k salonu na adrese `Sadová 2, Zlín`
  - `Kongresové centrum Zlín` jako kryté komfortní parkování
- Každá karta ukazuje badge, orientační docházku, orientační cenu pro 90-120 minut, jednu krátkou poznámku, doplňující menší řádek a odkaz `Navigovat` do externí mapy v nové kartě.
- Pod kartami zůstává stručné upozornění, že ceny jsou orientační, plus decentní odkazy na oficiální sazebník Technických služeb Zlín a parkování Kongresového centra.
- Další centrální možnosti (`Městské divadlo`, `Nad Tržnicí`, `Zlaté Jablko`) se smějí objevit jen v jedné doplňkové větě, ne jako samostatné karty.
- Mapový preview card zůstává zaměřený na adresu a Google Maps odkaz; jeho výšku držíme kompaktní, aby spodní část kontaktu nepůsobila prázdně.
- Kliknutí na adresu/mapovou kartu vede na konkrétní firemní profil `Kosmetika | Pavlína Pomykalová` v Google Maps, ne na obecné vyhledání adresy.

## Důsledky
- Klientka uvidí parkovací informaci přes celou šířku pod mapou a rychlým kontaktem, tedy ve stejné části stránky jako adresu, trasu a kontakt, ale rozhodnutí zvládne rychleji než z plného ceníku.
- Orientační ceny a provozní časy jsou zapsané staticky v komponentě a opírají se o veřejné sazebníky, takže při změně městského ceníku nebo ceníku KCZ je potřeba ručně upravit obsah komponenty i dokumentaci.
- Nezavádíme novou databázovou položku, CMS pole, env proměnnou ani integraci s mapami pro parkovací místa.

## Stav
- schváleno
