# ADR 0097: Admin booking detail cockpit hierarchy v1

## Stav
schváleno

## Kontext
Detail rezervace už měl správné provozní funkce, ale potvrzená rezervace stále míchala běžné kroky, přesun termínu a storno příliš blízko sebe. Obsluha po otevření detailu potřebuje rychle vědět `kdo / kdy / služba / doplatek / co dál` a zároveň se vyhnout omylu, kdy by místo uzavření návštěvy sáhla po zrušení.

## Rozhodnutí
- Panel `Další krok` chápeme jako pracovní cockpit aktuálního stavu rezervace.
- U `CONFIRMED` rezervace je nejvýraznější provozní akce `Dokončit návštěvu`; interně dál uzavírá rezervaci do stavu `Hotovo`.
- Dokončení návštěvy nese platební kontext. Pokud existuje doplatek, běžné flow admina vede přes hotovost, QR, voucher, kombinovanou úhradu nebo vědomou výjimku `Bez platby` s důvodem.
- `Přesunout termín` zůstává samostatný drawer s existující validací a historií, ale vizuálně je sekundární vůči dokončení návštěvy.
- `Nedorazila` je sekundární provozní akce vedle hlavního dokončení.
- `Zrušit rezervaci` se odděluje do sekce `Nebezpečná akce / Zrušení rezervace`; zachovává červené varování, důvod a potvrzovací tlačítko, ale nepůsobí jako běžný další krok.
- Souhrn rezervace zůstává v pravém sloupci na desktopu a na mobilu se přesouvá hned pod hlavičku před cockpit.
- Technická metadata jsou sbalitelná a vizuálně tlumená.
- Panel `Úhrada` zachovává současný rozpad částek, ale doplatek nebo přeplatek je nejsilnější finanční hodnota. `+ Zapsat platbu` je dostupné, ne dominantnější než hlavní provozní CTA.
- Poznámky zůstávají v jednom panelu, ale klientská poznámka a interní týmová poznámka jsou opticky oddělené.
- Historie zůstává dole jako auditní timeline a ve výchozím stavu ukazuje poslední změnu s rozbalením starších záznamů.

## Důsledky
- UI změna nemění datový model, dostupné stavové přechody ani platební výpočty.
- Completion flow pouze skládá existující platbu/voucher a stavový přechod do jednoho provozního kroku; před zápisem ověřuje, že úhrada pokryje doplatek, nebo vyžaduje vědomé `Bez platby` s důvodem.
- Potvrzená rezervace má jasnější bezpečný default: po návštěvě se uzavírá jako `Hotovo`.
- Storno je stále dostupné, ale vyžaduje vědomější práci v samostatné danger sekci.
- Mobilní pořadí lépe odpovídá provozní prioritě: hlavička, souhrn, cockpit, úhrada, poznámky, historie.
