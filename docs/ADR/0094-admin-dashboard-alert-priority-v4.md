# 0094 Admin Dashboard Alert Priority v4

## Kontext

Denní admin dashboard už byl postavený jako provozní cockpit, ale horní část na reálných datech stále působila těžce: několik alertů mělo stejnou vizuální váhu, KPI neukazovala krátký kontext metrik a pravý blok `Rychlé akce` duplikoval hlavní CTA `Vytvořit rezervaci` z horní lišty.

Současně nechceme měnit booking engine, databázový model, route guardy ani Matomo API kontrakt. Cíl je zklidnit informační hierarchii a snížit údržbový šum read modelu.

## Rozhodnutí

- `Vyžaduje pozornost` používá existující `alert.emphasis`.
- První `primary` alert je hlavní vizuální položka; pokud žádný `primary` alert neexistuje, dashboard povýší první actionable alert.
- Ostatní actionable alerty jsou sekundární kompaktní položky.
- CTA labely alertů zůstávají konkrétní a krátké (`Dostupnost`, `Rezervace`, `E-mail logy`) místo generických `Upravit` / `Otevřít`.
- KPI strip zobrazuje i krátký `detail`, který read model už počítal.
- Pravý blok rychlých akcí už neduplikuje `Vytvořit rezervaci`; hlavní CTA zůstává v horní provozní liště a rychlé akce drží podpůrné vstupy `Rezervace`, `Dostupnost`, `Klienti`, `Vouchery`.
- Nepoužívaná pole read modelu pro starší dashboard skladbu byla odstraněna z veřejného `AdminDashboardData` kontraktu.

## Alternativy

- Nechat všechny alerty jako stejné karty.
  - Zamítnuto, protože uživatelka pak nevidí první doporučenou akci.
- Vrátit samostatnou sekci `Dnešní úkoly`.
  - Zamítnuto, protože duplicitu už pokrývají alerty, KPI a dnešní plán.
- Ponechat `Vytvořit rezervaci` i v rychlých akcích.
  - Zamítnuto, protože primární akce už je nahoře a pravý panel má být podpůrný.

## Důsledky

- Horní část dashboardu působí klidněji a jasněji ukazuje první provozní problém.
- Rychlé akce mají menší soutěž s hlavní CTA.
- Read model je menší a méně nese historické komponenty, které už dashboard nepoužívá.
- Bezpečné fallbacky alertů zůstávají zachované a nulový stav dál skrývá sekci `Vyžaduje pozornost`.

## Stav

schváleno
