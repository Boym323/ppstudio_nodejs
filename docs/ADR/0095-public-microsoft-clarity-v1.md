# 0095 Public Microsoft Clarity v1

## Kontext

Vedle Matomo metrik potřebujeme volitelně zapnout i Microsoft Clarity pro kvalitativní analýzu veřejného webu. Zároveň musíme zachovat stejné privacy guardy jako u stávající analytics vrstvy: žádné měření adminu, žádné měření tokenových self-service URL a bezpečný default `off`.

## Rozhodnutí

- Clarity je volitelně zapnutá přes `NEXT_PUBLIC_CLARITY_ENABLED=true` a `NEXT_PUBLIC_CLARITY_PROJECT_ID`.
- Inicializace je v klientské komponentě `ClarityTracker`, vložené do veřejného `SiteShell` vedle `MatomoTracker`.
- Script se načítá přes `next/script` se strategií `lazyOnload`, aby se nespouštěl v kritickém renderu.
- `SiteShell` předává `ClarityTracker` stejný `disabled` guard podle admin session cookie `ppstudio-admin-session`.
- Clarity se neinicializuje na `/admin`, `/api`, `/_next` ani na tokenových self-service routách `/rezervace/sprava/*`, `/rezervace/storno/*`, `/rezervace/akce/*`.

## Alternativy

- Přidat Clarity přímo do root `app/layout.tsx` bez route guardů.
  - Zamítnuto, protože by se měřily i route, které nechceme sledovat.
- Vázat Clarity jen na konkrétní public route soubory.
  - Zamítnuto, protože by vznikla fragmentovaná konfigurace a vyšší riziko regresí při změnách layoutu.

## Důsledky

- Clarity lze zapnout bez nové npm závislosti.
- Výchozí stav je bezpečný no-op.
- Měření veřejného webu zůstává oddělené od admin provozu a citlivých tokenových cest.

## Stav

schváleno
