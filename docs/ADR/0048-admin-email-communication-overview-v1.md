# 0048 Admin Email Communication Overview v1

## Kontext

Owner-only sekce `Email logy` dosud ukazovala hlavně technický stav outbox fronty: pending, retry a poslední chyby. To bylo užitečné pro debugging workeru, ale provozně chyběla rychlá odpověď na otázky typu:

- chodí emaily klientkám
- který email odešel naposledy
- které rezervace se problém týká
- kde je potřeba zásah

Přitom nechceme měnit samotný `email:worker`, retry politiku ani queue mechanismus.

## Rozhodnutí

- Stránka `/admin/email-logy` zůstává owner-only, ale mění informační architekturu z technického logu na business-first přehled `Komunikace se zákaznicemi`.
- Horní část stránky nově obsahuje výrazný health panel a krátké metriky:
  - dnes odesláno
  - za posledních 7 dní
  - čeká na odeslání
  - selhalo
  - poslední odeslání
- Hlavní obsah tvoří filtrovatelný seznam posledních emailů s vazbou na rezervaci, stavem, typem, příjemcem, časem a akcemi.
- Hlavní seznam schovává placeholder tracking data mimo hlavní sloupce a meta `Další pokus` ukazuje jen tam, kde je operativně relevantní.
- Technické bloky `Pending fronta`, `Retry pokusy` a `Poslední chyby` zůstávají dostupné, ale až ve spodní debug sekci `Technický stav fronty`, která může být defaultně sbalená do krátkého souhrnu.
- Detail email logu zůstává technický, ale doplňuje srozumitelnější error kontext, přímý odkaz na rezervaci a stejný kompaktní provozní layout jako seznam.

## Alternativy

- Zachovat čistě technický layout a přidat pouze další metriky.
  - Zamítnuto, protože problém byl hlavně v informační architektuře a pořadí priorit.
- Vytvořit zcela nový reporting endpoint nebo samostatný monitoring model.
  - Zamítnuto, protože pro v1 stačí read model nad existující tabulkou `EmailLog`.
- Přidat worker heartbeat nebo měnit retry flow.
  - Odloženo, protože zadání výslovně preferuje UX refactor bez zásahu do delivery logiky.

## Důsledky

- Owner získá do 3 sekund rychlou odpověď, zda komunikace funguje a co případně řešit.
- Stránka lépe propojuje email log s reálnou rezervací a klientkou.
- Debug informace nezmizí, jen se přesunou níž a nepřebijí hlavní provozní přehled.
- Tracking sloupce `Otevřeno` a `Kliknuto` zůstávají připravené pro budoucí data, ale v hlavním seznamu nejsou dominantní placeholder položkou.

## Stav

schváleno
