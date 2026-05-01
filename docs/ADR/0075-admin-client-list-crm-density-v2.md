# 0075 Admin client list CRM density v2

## Kontext

Admin sekce `Klienti` už měla reálný read model, detail klientky, hledání, stavový filtr a řazení. Seznam ale působil spíš jako technický výpis databáze než jako každodenní CRM pracovní plocha pro salon:

- horní metriky opakovaly méně užitečné stavové počty
- chyběly rychlé řezy typu klientky bez kontaktu nebo bez rezervace
- dlouhé e-maily a testovací názvy mohly narušit čitelnost řádku
- kontakt nerozlišoval mezi chybějícím e-mailem, telefonem a úplně prázdným kontaktem

Nechceme měnit databázový model, detail klientky, role guardy, routy ani business logiku rezervací.

## Rozhodnutí

Seznam klientů na `/admin/klienti` a `/admin/provoz/klienti` zůstává server-rendered nad existujícím read modelem, ale mění informační architekturu:

- Nízká stránková hlavička ponechává `Klienti`, `Klientská databáze` a krátký provozní popis.
- KPI strip ukazuje `Klientů/Klientek celkem`, `Nové za 30 dní`, `Bez kontaktu` a `S poznámkou`.
- Quick filtry používají nový `quick` search parametr a kombinují se se stávajícím `query`, `status` a `sort`.
- Desktopový seznam je tabulkový s pevnou skladbou sloupců `Klientka / Kontakt / Rezervace / Poslední návštěva / Poznámka / Stav / Akce`.
- Mobilní zobrazení používá kompaktní klientské karty se stejnými prioritními informacemi.
- Testovací profily se jen označují badge `test` podle bezpečných signálů v názvu nebo e-mailu.

## Alternativy

- Ponechat card layout a pouze snížit spacing.
- Přidat nové persistované CRM atributy pro segmentaci klientek.
- Implementovat destruktivní či hromadné čištění testovacích záznamů přímo ze seznamu.

## Důsledky

- Salon získá praktičtější CRM seznam bez migrace a bez zásahu do detailu klientky.
- Rychlé filtry jsou sdílené přes URL, takže fungují s obnovou stránky i odkazy.
- Technické a dlouhé hodnoty zůstávají dohledatelné, ale vizuálně nerozbíjí tabulku.
- Testovací data jsou rozpoznatelná, ale žádná data se nemažou ani nemění.

## Stav

schváleno
