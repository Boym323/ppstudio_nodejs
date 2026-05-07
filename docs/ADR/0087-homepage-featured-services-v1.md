# ADR 0087: Ruční výběr služeb na homepage

## Kontext
- Homepage má sekci `Doporučené služby`, která se dosud plnila prvními veřejnými službami podle katalogového řazení.
- Provoz potřebuje vybrat konkrétní služby podle obchodní priority, ne podle toho, jak jsou seřazené v kategoriích.
- Výběr musí zůstat navázaný na existující katalog, aby odkazy, ceny, délky a veřejná viditelnost držely stejný zdroj pravdy.

## Rozhodnutí
- Přidáváme pole `Service.isFeaturedOnHomepage` a `Service.homepageSortOrder`.
- Admin detail služby dostává sekci `Homepage`, kde lze službu zapnout pro doporučené služby a nastavit její pořadí.
- Public read model homepage zobrazí maximálně první tři aktivní veřejně rezervovatelné služby v aktivních kategoriích.
- Pokud není vybraná žádná služba, homepage zůstane funkční přes fallback na první tři veřejné služby podle katalogového pořadí.

## Alternativy
- Samostatná tabulka pro homepage výběr: silnější model pro budoucí editorial obsah, ale zbytečně složitý pro tři služby.
- Hardcoded seznam slugů v content souboru: rychlé, ale admin by neměl kontrolu a změny by vyžadovaly deploy.
- Výběr podle počtu rezervací: znělo by jako popularita, ale míchalo by historická data s aktuální obchodní prioritou.

## Důsledky
- Pozitivní dopad: provoz může vybrat služby na homepage bez zásahu vývojáře.
- Pozitivní dopad: výběr stále respektuje aktivitu služby, veřejnou rezervovatelnost a aktivitu kategorie.
- Trade-off: homepage pořadí je další provozní pole, které je potřeba udržovat v adminu.

## Stav
- schváleno
