# ADR 0027: Veřejná pricing metadata patří přímo do katalogu služeb a kategorií

## Kontext

Po redesignu `/cenik` jsme měli přesnější layout, ale pořád jsme drželi badge, krátké pricing popisy, layout kategorií a public názvy v lokálních mapách podle `slug`.

To mělo tři nevýhody:

- provoz nemohl veřejný ceník upravit bez zásahu do kódu
- admin katalog a veřejný pricing layout nebyly jeden zdroj pravdy
- import katalogu neuměl přenést veřejnou copy vrstvu společně se službami

## Rozhodnutí

Rozšiřujeme stávající katalog `Service` a `ServiceCategory` o veřejná pricing metadata.

Do `Service` přidáváme:

- `publicName`
- `publicIntro`
- `seoDescription`
- `pricingShortDescription`
- `pricingBadge`

Do `ServiceCategory` přidáváme:

- `publicName`
- `pricingDescription`
- `pricingLayout`
- `pricingIconKey`
- `pricingSortOrder`

Admin formuláře `Služby` a `Kategorie služeb` tato pole přímo upravují.

Public read model:

- `getPublicServices()` používá public pole jako primární zdroj copy
- `getPublicPricingCatalog()` vrací hotové pricing sekce přímo z DB

## Důsledky

Pozitivní:

- `/cenik`, `/sluzby` i detail služby mají veřejnou copy vrstvu spravovatelnou z adminu
- import katalogu umí přenést i pricing metadata
- lokální fallback logika v read modelu zůstává malá a není hlavní workflow

Negativní:

- katalog nese víc prezentačních polí a admin formuláře jsou rozsáhlejší
- deploy vyžaduje novou databázovou migraci před buildem nebo během rollout kroku

## Zamítnuté alternativy

1. Nechat pricing metadata v lokálních mapách.
   To bylo rychlé, ale provozně neudržitelné.

2. Zavést samostatné tabulky `PublicServiceContent` a `PublicCategoryContent`.
   To by bylo čistší oddělení, ale pro aktuální scope zbytečně těžké řešení s více joiny a větším admin workflow.
