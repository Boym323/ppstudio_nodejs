# ADR 0015: Admin správa kategorií služeb a bezpečné vazby na služby

## Stav
Accepted

## Kontext
Projekt už měl v databázi migrované kategorie služeb a veřejný web i booking flow je používaly jako součást katalogu. Admin ale pro kategorie nabízel jen read-only přehled, takže běžný provoz neuměl jednoduše:

- upravit název nebo pořadí kategorie
- kategorii dočasně skrýt bez zásahu do navázaných služeb
- bezpečně rozlišit, kdy je vhodné kategorii vypnout a kdy ji lze opravdu smazat

Audit migrovaných dat ukázal, že názvy, pořadí i aktivita jsou konzistentní; jediná slabina jsou prázdné popisy kategorií, což není blokující problém.

## Rozhodnutí
- Sekce `Kategorie služeb` dostává vlastní admin workflow na `/admin/kategorie-sluzeb` a `/admin/provoz/kategorie-sluzeb`.
- UI kopíruje pattern sekce `Služby`: vlevo seznam, vpravo krátký editor vybrané položky.
- Pořadí kategorií zůstává jednoduché číselné přes `ServiceCategory.sortOrder`; nepřidáváme drag and drop.
- Deaktivace kategorie je podporovaná i pro kategorie s navázanými službami.
- Tvrdé mazání je povolené jen pro prázdnou kategorii bez navázaných služeb.
- `slug` kategorie v této iteraci neupravujeme, aby se zbytečně nerozjížděla identita záznamu vůči import skriptům a historickým referencím.

## Důsledky

### Pozitivní
- běžná obsluha rychle chápe, co je aktivní a v jakém pořadí se kategorie zobrazují
- změna pořadí se propíše do adminu, veřejného katalogu i booking flow bez nové migrace
- vazba kategorie -> služby zůstává bezpečná, protože mazání neprázdných kategorií je blokované
- role `OWNER` i `SALON` používají stejné workflow a stejná pravidla

### Negativní
- při přejmenování kategorie zůstává historický `slug`, což může být lehce matoucí při interním auditu dat
- popis kategorie zůstává jen volitelným textem, takže bez další disciplíny nemusí být vyplněný

## Alternativy
- Povolit mazání i kategorií se službami a služby převěšovat jinam: zamítnuto kvůli vysokému riziku pro public výpis i booking pravidla.
- Přidat drag and drop pořadí: zamítnuto, protože by šlo o zbytečně složitý UI pattern pro malý počet kategorií.
- Editovat kategorie dál jen přes read-only sekci a ruční DB zásahy: zamítnuto kvůli provozní nepraktičnosti a vyššímu riziku chyb.
