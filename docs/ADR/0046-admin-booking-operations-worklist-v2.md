# ADR 0046: Admin Booking Operations Worklist V2

## Stav
schváleno

## Kontext
Kompaktní řádkový seznam rezervací z ADR 0021 už odstranil vysoké karty a zrychlil základní práci. V každodenním provozu ale stále chyběly některé jemné UX vrstvy:

- horní statistiky byly jen informativní a nešlo je použít jako rychlý filtr
- seznam neměl vlastní kompaktní toolbar pro kombinaci hledání, stavu, zdroje a data
- dlouhá sekvence rezervací se hůř skenovala podle časové priority dneška a dalších dnů
- uzavřené stavy `Hotovo` a `Zrušená` měly podobnou vizuální váhu jako aktivní provozní rezervace
- rychlé akce v řádku neodlišovaly dostatečně pending, confirmed a uzavřené rezervace

Potřebujeme dál zachovat stejnou booking business logiku, detail rezervace, ruční vytvoření rezervace i stavový model. Změna má zůstat čistě v read modelu a prezentační vrstvě administrace.

## Rozhodnutí
- Sekce `Rezervace` používá URL-driven filtry přes query params `query`, `status`, `source`, `stat`, `dateFrom`, `dateTo`.
- Horní statistiky `Dnes a dál`, `Čeká`, `Potvrzené`, `Hotovo`, `Zrušené` jsou klikací a přepínají rychlý filtr seznamu; aktivní statistika je vizuálně zvýrazněná a druhý klik filtr zruší.
- Nad seznamem je kompaktní toolbar s hledáním, stavem, zdrojem, datovým rozsahem, resetem filtrů a počtem výsledků.
- Seznam se serverově seskupuje do bloků `Dnes`, `Zítra`, `Později`, `Dříve`, aby byla časová priorita zřetelná bez změny datového modelu a bez další kognitivní vrstvy navíc.
- Ve sloupci času má hlavní váhu časový rozsah; datum je jen sekundární text.
- Řádky ve stavech `COMPLETED` a `CANCELLED` jsou záměrně tlumené přes nižší opacity a jemnější badge.
- Inline akce jsou zredukované podle provozní priority:
  - `PENDING`: `Potvrdit`, `Zrušit`, `Otevřít`
  - `CONFIRMED`: `Zrušit`, `Otevřít`
  - uzavřené stavy: jen `Otevřít`
- Samotný řádek rezervace funguje jako navigační target pro detail; checkbox, kontakt a row akce jsou explicitně oddělené interaktivní zóny.
- Selection shell pro budoucí bulk akce (`Potvrdit vybrané`, `Zrušit vybrané`) je připravený v klientské vrstvě, ale zatím bez napojení na backend mutace.
- Mobilní zobrazení používá compact card per reservation, ale stále nad stejným serverovým filtrem a stejnými row akcemi.

## Důsledky

### Pozitivní
- Rezervační seznam funguje víc jako pracovní inbox a méně jako statický report.
- Filtry se dají sdílet nebo obnovit přes URL bez nové klientské state vrstvy.
- Obsluha se rychleji orientuje v dnešních a nejbližších termínech.

### Negativní
- Read model rezervací je bohatší a vrací víc explicitních prezentačních polí než původní kompaktní verze.
- Defaultní seznam bez filtrů může stále obsahovat i starší rezervace; provozní prioritu proto musí nést skupiny a klikací statistiky.

## Alternativy
- Přepsat seznam na plnou datovou tabulku s bulk akcemi: zamítnuto, zbytečně by zvětšila scope a zhoršila mobilní použití.
- Vyřešit filtraci čistě klientsky nad jedním velkým payloadem: zamítnuto, protože URL-driven server render lépe sedí na App Router a zachovává sdílitelný stav.
- Vrátit se k vyšším kartám se silnější vizuální hierarchií: zamítnuto, odporuje provoznímu cíli hustého pracovního seznamu.
