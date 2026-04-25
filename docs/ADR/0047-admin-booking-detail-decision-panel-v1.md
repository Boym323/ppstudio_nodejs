# ADR 0047: Admin booking detail jako decision panel v1

## Stav
schváleno

## Kontext
Detail rezervace po předchozích iteracích uměl bezpečné změny stavu, interní poznámku i samostatný reschedule drawer, ale pořád působil příliš jako dlouhá čtecí stránka:

- hlavní termín a další krok nebyly dostatečně dominantní
- akční panel byl až pod souhrnem a poznámkami
- klientská a interní poznámka byly oddělené do dvou bloků
- historie měla správná data, ale zbytečně velkou výšku
- souhrn rezervace zabíral zbytečně moc prostoru a tlačil akce dolů

Provoz potřebuje po otevření detailu během pár sekund pochopit `kdo / kdy / na co / v jakém stavu / co dál`, a to stejně pro role `OWNER` i `SALON`.

## Rozhodnutí
- Detail rezervace stavíme jako decision-first layout:
  - sticky header s klientkou, službou, dominantním termínem, stavem, zdrojem a rychlými akcemi
  - akční panel hned pod headerem
  - levý sloupec `akce -> poznámky -> historie`
  - pravý sloupec `souhrn -> technická metadata`
- `Přesunout termín` zůstává samostatná akce mimo status chooser; dál používá existující drawer, validaci dostupnosti, historii změn a email workflow.
- Status chooser zkracujeme na velká akční tlačítka s minimem copy a s jednou zvýrazněnou primární akcí podle aktuálního stavu rezervace.
- Souhrn rezervace převádíme na kompaktní key/value kartu bez dlouhých popisů.
- Klientskou a interní poznámku sjednocujeme do jednoho bloku `Poznámky`; interní poznámka zůstává editovatelná přes stávající server action.
- Historie zůstává auditní timeline, ale v základním stavu ukazuje jen posledních 5 položek a starší záznamy schová do rozbalení.
- Role `OWNER` a `SALON` používají stejné provozní akce; rozdíl zůstává jen v admin cestě a okolní navigaci.

## Alternativy
- Nechat původní detail a jen zmenšit spacing: zamítnuto, nezlepšilo by to rozhodovací rychlost ani informační hierarchii.
- Přidat reschedule jako další volbu do status chooseru: zamítnuto, protože jde o komplexnější flow s vlastním drawerem, validací a side effects.
- Rozlišit dostupné akce mezi `OWNER` a `SALON`: zamítnuto, protože by to zavedlo zbytečné role-based omezení do čistě provozního workflow.

## Důsledky

### Pozitivní
- detail je rychleji čitelný a akce jsou vidět bez scrollování
- termín, stav a další krok mají jednoznačnou prioritu
- poznámky a historie méně dominují, ale zůstávají po ruce
- reschedule flow zůstává bezpečně oddělené od běžných stavových změn

### Negativní
- layout je více závislý na kvalitním sticky chování shellu a viewport offsetů
- část historie je ve výchozím stavu schovaná a vyžaduje rozbalení
