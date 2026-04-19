# ADR 0013: Týdenní planner dostupností nad 30min gridem a souvislými intervaly

## Stav
Accepted

## Kontext
Původní planner slotů byl odstraněný, protože byl pro každodenní provoz příliš těžkopádný. Zároveň už ale projekt měl důležitá omezení, která nešlo zahodit:

- veřejný booking flow pracuje nad entitou `AvailabilitySlot`
- rezervace se váže na celý slot a kontroluje, že délka slotu pokryje délku služby
- sloty se nesmí překrývat a rezervace nesmí být plannerem poškozené
- model podporuje i složitější sloty s omezením služeb, poznámkou nebo jinou kapacitou než `1`

UX cíl byl opačný než u starého řešení: běžná obsluha musí být schopná otevřít týden a během pár sekund klikáním nebo tažením upravit dostupnost bez formulářového workflow.

## Rozhodnutí
- Hlavní admin workflow pro sekci `volne-terminy` je nově týdenní kalendář po dnech a 30min buňkách.
- Planner je záměrně omezený na pracovní okno `06:00-20:00` (28 buněk za den), aby UI odpovídalo reálnému provozu salonu.
- 30min grid je pouze editační vrstva v admin UI. Databázový zápis zůstává založený na souvislých intervalech `startsAt`-`endsAt` v tabulce `AvailabilitySlot`.
- Server při každé změně dělá merge/split nad celým dnem:
  - načte existující jednoduché publikované sloty bez rezervací
  - přepočítá cílový stav dne podle vybraných buněk
  - sousední půlhodiny automaticky sloučí do minimální sady souvislých intervalů
  - zablokuje zásah do rezervací, omezených slotů, neaktivních slotů a dalších technicky složitějších intervalů
- Planner přímo upravuje jen jednoduché sloty vhodné pro běžný provoz:
  - `status = PUBLISHED`
  - `capacity = 1`
  - bez `publicNote` a `internalNote`
  - `serviceRestrictionMode = ANY`
  - bez `allowedServices`
  - bez navázaných rezervací
- Ostatní sloty planner zobrazuje, ale drží je jako uzamčené nebo neaktivní.
- Rychlé akce zůstávají přímo v týdnu:
  - kopírovat den na jiný den v týdnu
  - kopírovat celý týden na další týden
  - vyčistit den do stavu „zavřeno"
  - uložit a znovu použít jednoduchou týdenní šablonu v lokálním úložišti prohlížeče
- Route `novy`, `detail` a `upravit` zůstávají kvůli kompatibilitě URL, ale přesměrují do stejného planneru ve správném týdnu.

## Důsledky

### Pozitivní
- běžná obsluha pracuje přímo v týdnu bez formulářů a technických statusů
- public booking flow zůstává kompatibilní s delšími službami, protože dál rezervuje celé souvislé sloty
- planner negeneruje roztříštěná data; půlhodinové editace se ukládají jako co nejmenší počet intervalů
- server-side validace zůstává hlavním bezpečnostním bodem a neodchází do klienta
- mobil má stále týdenní režim, ale s jednodušším výběrem dne a jedním přímým editačním panelem

### Negativní
- planner záměrně neumí přímo měnit složitější sloty s omezením služeb, poznámkou nebo jinou kapacitou
- týdenní šablona je lokální pro zařízení/prohlížeč, ne sdílená databázově
- copy day/week přenáší jen běžnou dostupnost; rezervace ani omezené intervaly se nekopírují

## Alternativy
- Uložit každou půlhodinu jako samostatný slot: zamítnuto, protože by to rozbilo současný booking model a zhoršilo podporu delších služeb.
- Přepsat celý booking systém na nový planner-first model: zamítnuto, protože cílem byla evoluce bez zásahu do veřejného flow.
- Povolit planneru editovat všechny sloty bez rozdílu: zamítnuto, protože by hrozilo poškození rezervací nebo ztráta doménových omezení slotu.
