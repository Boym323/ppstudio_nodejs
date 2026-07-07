# ADR 0104: Admin helper extraction and typed paths v1

## Kontext
- Admin detail rezervace, weekly planner a route factory pro nastavení držely větší objem nesouvisející logiky v jednom souboru.
- Čisté výpočty byly schované uvnitř velkých React komponent, takže se hůř testovaly bez renderu a každá úprava nesla vyšší riziko regresí.
- Skládání admin URL podle role `owner` / `salon` bylo opakované v ručních ternárech a nemělo jeden sdílený typed vstup.

## Rozhodnutí
- Zavedli jsme samostatné helper moduly pro:
  - detail rezervace: `admin-booking-detail-helpers.ts`
  - weekly planner: `admin-weekly-planner-helpers.ts`
  - sdílené admin cesty: `admin-paths.ts`
- Serverový read model pro stránku nastavení jsme vytáhli z `admin-route-factories.tsx` do `admin-settings-page-data.ts`.
- Nové helper moduly mají vlastní úzké unit testy bez závislosti na React renderu nebo databázi.

## Alternativy
- Ponechat logiku v původních komponentách a spoléhat jen na integrační/UI testy.
- Rozdělit velké komponenty rovnou do většího množství child komponent bez předchozí extrakce čistých helperů.

## Důsledky
- Pozitivní dopady:
  - menší a čitelnější soubory
  - lepší oddělení server/client odpovědností
  - jednodušší typová kontrola a levnější unit testy pro refaktoring
  - konzistentnější skládání admin URL podle role
- Rizika / trade-offy:
  - přibývá více malých souborů, takže je potřeba držet jasné pojmenování
  - helper vrstvy je potřeba udržovat synchronně s UI komponentami, jinak hrozí drift mezi testovanou logikou a prezentací

## Stav
- schváleno
