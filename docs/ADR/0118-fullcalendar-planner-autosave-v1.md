# ADR 0118: FullCalendar planner s průběžným autosave

## Stav
Accepted

## Kontext
Původní draft-first workspace pro týdenní planner byl nahrazen jedním produkčním rozhraním FullCalendar. OWNER i SALON potřebují stejný pracovní postup a okamžitou zpětnou vazbu při jednotlivých úpravách dostupnosti.

## Rozhodnutí
- FullCalendar je jediný produkční planner pro OWNER i SALON a obě routy používají společnou implementaci.
- Každá změna dostupnosti se ukládá průběžně přes FIFO frontu autosave.
- Neúspěšná změna zůstává ve frontě pro opakování; klient může obnovit poslední uložený stav.
- Každá změna používá `operationId` pro idempotentní zápis a bezpečné opakování.
- Server při zápisu chrání rezervované i jinak blokované intervaly; nelze je přepsat editací dostupnosti.
- Draft-first workflow, hromadná publikace konceptu, šablony a kopírování týdne nejsou součástí produkčního API.

## Alternativy
- Zachovat lokální koncept týdne s explicitním publikováním: zamítnuto, protože by udržoval druhý, již nepoužívaný pracovní postup.

## Důsledky
- Obsluha dostává výsledek jednotlivé úpravy bez samostatného kroku publikace.
- Selhaný zápis vyžaduje retry nebo vědomé obnovení uloženého stavu; neexistuje serverový týdenní draft.
- ADR 0023 je historický záznam a je nahrazen tímto rozhodnutím.
