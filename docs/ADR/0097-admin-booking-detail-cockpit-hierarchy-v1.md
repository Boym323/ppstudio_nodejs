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
- Pravý sloupec na desktopu obsahuje kontakt a sbalitelná metadata; údaje z hlavičky se v něm neopakují. Na mobilu následuje až za hlavním pracovním obsahem.
- Technická metadata jsou sbalitelná a vizuálně tlumená.
- Panel `Úhrada` zachovává současný rozpad částek, ale doplatek nebo přeplatek je nejsilnější finanční hodnota. Při nulovém doplatku zobrazuje `Uhrazeno`. `+ Zapsat platbu` je vedlejší akce pro samostatnou úhradu (např. zálohu), která návštěvu neuzavírá. Ovladače zápisu platby a úpravy ceny zůstávají vedle sebe; vždy jeden otevřený formulář využívá celou šířku pod nimi. Přepnutí zachovává rozepsané hodnoty. Podrobnosti plateb a voucherů jsou rozbalitelné.
- Poznámky mají pevné místo před panelem `Další krok`. Sbalený panel ukazuje nejvýše dva řádky každé poznámky; celý text klientky a editor interní poznámky jsou dostupné po rozbalení.
- Historie zůstává dole jako auditní timeline a ve výchozím stavu ukazuje poslední změnu s rozbalením starších záznamů.

## Důsledky
- UI změna nemění datový model, dostupné stavové přechody ani platební výpočty.
- Completion flow pouze skládá existující platbu/voucher a stavový přechod do jednoho provozního kroku; před zápisem ověřuje, že úhrada pokryje doplatek, nebo vyžaduje vědomé `Bez platby` s důvodem.
- Potvrzená rezervace má jasnější bezpečný default: po návštěvě se uzavírá jako `Hotovo`.
- Storno je stále dostupné, ale vyžaduje vědomější práci v samostatné danger sekci.
- Mobilní pořadí odpovídá provozní prioritě: hlavička, náhled poznámek, cockpit, úhrada, historie, kontakt a metadata.
