# ADR 0043: Admin Service and Category Drawers v1

## Kontext
Sekce `Služby` a `Kategorie služeb` používaly odlišné desktop detail patterny (`fixní pravý panel` vs `sticky detail`) a jiný mobilní režim. V provozu to vedlo k nejednotnému očekávání obsluhy při přepínání mezi sekcemi.

Potřebujeme sjednotit list/detail práci tak, aby:
- seznam zůstal hlavním pracovním kontextem
- detail šel otevřít i zavřít bez ztráty filtru a orientace
- desktop i mobil měly stejné mentální mapování "vyber položku -> otevře se pravý detail"

## Rozhodnutí
Detail v sekcích `Služby` i `Kategorie služeb` sjednocujeme na pravý overlay drawer.

- `Služby`: query-driven detail (`serviceId` nebo `mode=create`) otevírá pravý drawer nad seznamem.
- `Kategorie služeb`: workspace už nepoužívá desktop sticky panel; `CategoryDetailDrawer` se používá na desktopu i mobilu.
- Zavření detailu vždy vrací obsluhu na stejný pracovní kontext (filtry/list), bez přepnutí na jinou stránku.

## Alternativy
### Ponechat stávající desktop panely
- menší zásah do UI
- ale zůstalo by nejednotné chování mezi sekcemi a breakpointy

### Přesunout detail na samostatné route stránky
- jednodušší render logika
- ale horší provozní tok, více přepínání a vyšší riziko ztráty kontextu filtru

## Důsledky
- UX je konzistentní napříč `Služby` a `Kategorie služeb`.
- Seznam zůstává dominantní pracovní plocha, detail je sekundární overlay vrstva.
- Změna je čistě UI/komponentová, bez DB migrace a bez nové závislosti.

## Stav
schváleno
