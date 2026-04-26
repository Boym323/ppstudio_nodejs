# ADR 0023: Draft-first pracovní workspace pro admin týdenní planner

## Stav
Accepted

## Kontext
Planner dostupností už měl funkční 30min grid a server-side ochranu proti zásahu do rezervací nebo omezených slotů. V praxi ale pořád narážel na několik provozních problémů:

- sidebar a okolní panely měly příliš velkou vizuální váhu vůči samotné týdenní mřížce
- pravý panel byl spíš informační než akční
- změny se při běžné práci ukládaly příliš brzy, takže obsluha ztrácela klidný kontext pro kontrolu více úprav v týdnu
- mobil a menší notebooky neměly jasně oddělený grid-first režim a sekundární obsah

Pro každodenní provoz salonu bylo potřeba z planneru udělat spíš kompaktní nástroj než dekorativní dashboard.

## Rozhodnutí
- Hlavní pracovní plocha planneru je nově jednoznačně týdenní grid; shell i sidebar jsou záměrně kompaktnější.
- Pravý panel se mění na akční inspektor dne:
  - krátký souhrn dne
  - hlavní akce dne
  - detail aktuálního výběru z gridu
  - kompaktní seznam volných oken
  - malý seznam rezervací
- Interakce planneru je draft-first:
  - kliknutí do gridu vybírá blok nebo buňku pro inspektor
  - tažení vytváří lokální koncept změny týdne
  - koncept se publikuje až explicitně přes sticky action bar
- Sticky action bar se zobrazuje jen při reálném diffu proti serverovým dnům a nabízí:
  - `Zahodit`
  - `Publikovat změny`
- Koncept týdne i týdenní šablona zůstávají lokální v prohlížeči; backend zatím neřeší sdílené drafty nebo workflow schvalování.
- Publikace konceptu používá jednu server action pro synchronizaci celého otevřeného týdne, ale dál respektuje stejná doménová pravidla jako původní planner:
  - rezervace a omezené intervaly zůstávají chráněné
  - DB zápis dál končí jako minimální sada souvislých `AvailabilitySlot` intervalů

## Důsledky

### Pozitivní
- grid dostává maximum místa a planner působí rychleji i na menších displejích
- obsluha může udělat více změn najednou a zkontrolovat je před publikací
- mobilní workflow je jasnější: sidebar je drawer a inspektor dne je spodní sheet
- redesign nevynutil novou tabulku, novou knihovnu ani změnu booking modelu

### Negativní
- koncept týdne je zatím lokální pro zařízení/prohlížeč a není sdílený mezi uživateli
- `Označit den jako zavřeno` je stále reprezentované jako den bez běžné dostupnosti, ne jako samostatná doménová entita
- kopírování celého týdne na další týden zůstává serverová akce nad publikovaným stavem; uživatel musí nejdřív vyřešit lokální koncept

## Alternativy
- Zachovat okamžité ukládání po každém drag gestu: zamítnuto, protože to zhoršovalo kontrolu nad více změnami v týdnu a způsobovalo pocit „uskakujícího“ rozhraní.
- Přidat databázové drafty a workflow schvalování: zamítnuto pro tuto iteraci, protože by to rozšířilo scope i datový model mimo potřeby aktuálního provozu salonu.
- Řešit mobil přes úplně jinou route nebo samostatnou planner aplikaci: zamítnuto, protože cílem byla evoluce jedné sdílené admin sekce bez rozštěpení logiky.
