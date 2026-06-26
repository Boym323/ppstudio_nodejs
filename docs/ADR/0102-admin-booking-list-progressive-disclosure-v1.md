# ADR 0102: Admin Booking List Progressive Disclosure V1

## Stav
schváleno

## Kontext
Pracovní seznam rezervací už po předešlých refaktorech funguje jako provozní inbox, ale s rostoucím počtem historických a budoucích záznamů začal znovu ztrácet přehlednost:

- historické rezervace tlačily důležité aktivní položky níž
- jeden dlouhý seznam nutil obsluhu hodně scrollovat i při běžné denní práci
- interní limit načtených rezervací deformoval souhrnný počet výsledků
- klasické stránkování by rozbilo kontext mezi akčními skupinami `K uzavření`, `Čeká na potvrzení` a zbytkem seznamu

Potřebujeme zlepšit čitelnost bez změny booking domény, bez nové perzistence a bez odpojení seznamu od URL-driven filtrů.

## Rozhodnutí
- Seznam rezervací zůstává serverově seskupený do bloků `K uzavření`, `Čeká na potvrzení`, `Nadcházející` a `Minulé`.
- Místo klasického stránkování používáme progresivní odkrývání po skupinách:
  - `Minulé` jsou výchozně sbalené
  - každá skupina má vlastní limit viditelných položek
  - dlouhé skupiny se rozšiřují přes akci `Zobrazit další`
- Stav rozbalení a limity jsou URL-driven přes query parametry `showPast`, `needsClosureLimit`, `pendingLimit`, `upcomingLimit`, `pastLimit`.
- Filtrační toolbar musí tyto parametry zachovat i při další změně `query/status/source/dateFrom/dateTo`, aby se pracovní kontext nerozpadl.
- Souhrnný počet výsledků (`summary.totalCount`) se počítá samostatně přes `count(where)` a nesmí být odvozený od interního výřezu renderovaných položek.

## Důsledky

### Pozitivní
- Aktivní provozní rezervace zůstávají nahoře bez šumu z historie.
- Obsluha může dlouhý seznam rozšiřovat jen tam, kde to právě potřebuje.
- URL dál reprezentuje kompletní stav pracovního seznamu včetně rozbalených sekcí.

### Negativní
- Read model rezervací je bohatší o prezentační metadata skupin a URL helpery.
- Toolbar i sekční odkazy musí důsledně přenášet víc query parametrů, jinak se stav seznamu snadno rozpadne.

## Alternativy
- Klasické stránkování celého seznamu: zamítnuto, protože by roztrhlo prioritní skupiny a zhoršilo provozní skenování.
- Nekonečný scroll čistě na klientu: zamítnuto, protože by oslabil sdílitelný URL stav a přidal zbytečnou klientskou orchestraci.
- Ponechat plný dlouhý seznam bez omezení: zamítnuto, protože v praxi zhoršuje orientaci při vyšším objemu historických rezervací.
