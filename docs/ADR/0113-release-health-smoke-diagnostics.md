# ADR 0113: Rozlišená diagnostika release health a smoke kontroly

## Kontext

Release helper ověřuje `/api/health`, deployment ID a homepage `/`, ale při selhání vypisoval pouze společnou hlášku. HTTP 500 z homepage proto vypadalo jako nefunkční health endpoint a vedlo k chybným opravám.

## Rozhodnutí

- `deploy/release.sh` ověřuje oba endpointy samostatně a při selhání vypisuje jejich roli, URL a HTTP status.
- Kontrola zůstává strict: ne-2xx z kteréhokoli endpointu stále vyvolá rollback.

## Alternativy

- Akceptovat 500 při homepage smoke: zamítnuto, protože by release potvrdil nefunkčný veřejný web.
- Diagnostikovat pouze přes ruční journal: zamítnuto, protože release log musí nejprve určit správnou failing větev.

## Důsledky

- Operátor pozná, zda hledat chybu v health read modelu, deployment ID, nebo server renderu homepage.
- Nezvyšuje se počet endpointů ani se nemění env kontrakt.

## Stav

Schváleno.
