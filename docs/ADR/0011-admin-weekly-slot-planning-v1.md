# ADR 0011: Týdenní planner dostupností jako hlavní admin workflow

## Stav
Accepted

## Kontext
Původní admin workflow pro sloty už umělo CRUD nad jednotlivými termíny, ale hlavní obrazovka pořád fungovala spíš jako seznam a filtr. To nestačilo pro každodenní práci salonu, kde je potřeba:

- plánovat celý týden jako jednu provozní jednotku
- rychle vidět prázdné, aktivní a problematické dny
- přidávat sloty bez zbytečných přechodů na nové stránky
- mít plnohodnotné použití na mobilu bez tabulky s horizontálním scrollem
- neobcházet stávající server-side validace slotů a vazby na rezervace

## Rozhodnutí
- Hlavní admin obrazovka dostupností je nově týdenní planner po dnech, ne plochý seznam slotů.
- Každý den má vlastní kartu se summary:
  - počet slotů
  - počet volných a plných publikovaných slotů
  - časový rozsah dne
  - mini timeline rozložení času
  - stav dne (`Prázdný`, `Aktivní`, `Omezený`, `Zrušený`)
- Detail dne je sekundární vrstva:
  - na desktopu pravý panel vedle týdne
  - na mobilu stacked blok pod týdenním přehledem
- Z detailu dne se přímo řeší operativní práce:
  - rychlé přidání jednoho slotu
  - dávkové vytvoření série slotů
  - rychlá změna stavu slotu
  - rychlá úprava času vybraného slotu
  - přechod do plné editace pro služby a poznámky
- URL-driven stav planneru drží i vybraný slot, aby se obsluha po akci vracela do stejného týdne, dne a pracovního kontextu.
- Dávkové vytváření slotů běží server-side v jedné transakci a používá stejnou validační logiku jako jednotlivý CRUD.
- Nepřidáváme kalendářovou knihovnu, drag-and-drop ani externí drawer/modal framework.

## Důsledky

### Pozitivní
- týden se stává skutečnou pracovní plochou místo orientačního dashboardu
- běžné denní operace jdou udělat s menším počtem kliknutí a bez ztráty kontextu
- mobilní rozhraní je plnohodnotné díky stacked kartám dnů a sekundárnímu panelu dne
- sticky mobilní akce drží nejčastější workflow v dosahu palce
- batch create nezavádí paralelní byznys pravidla; používá stejnou doménovou validaci jako jednotlivé sloty

### Negativní
- planner read model a URL stav jsou složitější než původní plochý seznam
- pro detailní editaci služeb a poznámek stále zůstává samostatná plná editace slotu
- bez drag-and-dropu zůstává přesun většího množství slotů manuální

## Alternativy
- Zachovat seznam slotů a jen přidat další filtry: zamítnuto, protože by týden zůstal sekundární a každodenní práce by byla pomalá.
- Přidat plnohodnotný kalendář s drag-and-drop: zamítnuto pro v1 kvůli složitosti, riziku na mobilu a zbytečné knihovní zátěži.
- Použít externí drawer/dialog UI knihovnu: zamítnuto, protože stávající stack stačí a nechceme rozšiřovat závislosti.
