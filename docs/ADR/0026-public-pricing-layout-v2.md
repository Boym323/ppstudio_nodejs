# ADR 0026: Veřejný ceník jako samostatný layout modul s prezentační vrstvou

## Kontext

Stránka `/cenik` už četla reálné služby z databáze, ale její layout byl stále součástí obecného souboru `public-site.tsx` a vizuálně byl jednodušší než cílový design. Potřebovali jsme výrazně přesnější kompozici:

- hero s pravou informační kartou
- navigační chips kategorií
- kombinaci velké list sekce a menších grid sekcí
- badge na vybraných službách
- silnější finální CTA blok

Současně jsme nechtěli duplikovat ceny, délky nebo názvy služeb mimo stávající DB read model.

## Rozhodnutí

Stránka `/cenik` má vlastní modul `src/features/public/components/pricing-page.tsx`.

Modul je rozdělený na menší pricing-specific komponenty:

- `PricingHero`
- `CategoryChips`
- `PricingSection`
- `PricingItem`
- `PricingGridSection`
- `PricingCTA`

Nad DB službami používáme lehkou prezentační vrstvu:

- `pricingCategoryConfigs` určuje pořadí kategorií, anchor id, ikonu, krátký souhrn a layout `list` nebo `grid`
- `servicePricingMetaBySlug` drží krátké popisy a badge pro konkrétní služby

Zdroj truth pro základní katalogová data zůstává v `src/features/public/lib/public-services.ts`.

## Důsledky

Pozitivní:

- `/cenik` lze ladit výrazně přesněji podle reference bez zásahů do ostatních veřejných stránek
- layout a page-specific metadata jsou oddělené od DB read modelu
- budoucí napojení na CMS nebo public katalog metadata půjde řešit rozšířením prezentační vrstvy místo přepisu celé stránky

Negativní:

- část public prezentačních pravidel je teď rozdělená mezi `public-services.ts` a `pricing-page.tsx`
- badge a zkrácené popisy jsou zatím udržované v kódu podle `slug`, dokud nevznikne dedikovaný obsahový zdroj

## Zamítnuté alternativy

1. Nechat ceník v `public-site.tsx`.
   To by dál míchalo specifický pricing layout s ostatními veřejnými stránkami a zhoršovalo další polish.

2. Přesunout veškerá pricing metadata přímo do databáze hned v této iteraci.
   To by bylo příliš velké rozšíření scope na změnu, která je primárně prezentační.
