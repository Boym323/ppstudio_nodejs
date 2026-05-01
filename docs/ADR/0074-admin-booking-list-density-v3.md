# 0074 Admin booking list density v3

## Kontext

Admin seznam rezervací už fungoval jako tabulkový pracovní seznam, ale horní část stránky byla stále zbytečně vysoká a rozdělená do několika oddělených vrstev:

- vysoká hero karta
- samostatné rychlé filtry
- samostatný formulář filtrů
- původní skupiny `Později` a `Dříve`, které nebyly dost provozně čitelné

Obsluha přitom potřebuje hlavně rychle poznat, co čeká na potvrzení, co je nadcházející a co je jen historické dohledání. Nechceme měnit routy, role guardy, booking detail, potvrzovací workflow ani databázový model.

## Rozhodnutí

Stránka `/admin/rezervace` a `/admin/provoz/rezervace` nově používá hustší provozní skladbu:

- Nízká stránková hlavička ponechává jen titul `Rezervace`, krátký popis a CTA `Přidat rezervaci` vpravo.
- Quick stats a formulářové filtry sdílí jeden horní control panel.
- Pod filtrem je tenký KPI strip s provozními počty `Čeká na potvrzení`, `Dnes`, `Tento týden` a `Bez kontaktu`.
- Read model se serverově seskupuje do `Čeká na potvrzení`, `Nadcházející` a `Minulé`.
- Pending řádky mají jen jemné warning zvýraznění a levý akcent; nemění se akční workflow ani detail rezervace.
- Desktopová tabulka se zjednodušuje na sloupce `Rezervace / Termín / Status / Zdroj / Kontakt / Akce` bez selection chrome připraveného pro budoucí bulk akce.

## Alternativy

- Ponechat původní skupiny `Dnes / Zítra / Později / Dříve` a upravit jen styling.
- Přidat nové databázové agregace nebo materialized read model pro KPI.
- Zvýraznit čekající rezervace agresivní kartou mimo hlavní tabulku.

## Důsledky

- Denní provozní práce vyžaduje méně vertikálního scrollu a méně přepínání pozornosti mezi horními vrstvami stránky.
- Pending rezervace jsou vizuálně i informačně prioritní, ale stále zůstávají součástí stejného seznamu.
- KPI se dopočítávají nad existujícími booking daty a nevyžadují migraci ani nový persistovaný model.
- Budoucí bulk akce nejsou v UI předstírané disabled selectory; seznam je čistší a blíže skutečnému dnešnímu workflow.

## Stav

schváleno
