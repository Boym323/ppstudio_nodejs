# ADR 0031: Owner Bookings ICS Feed V1

## Kontext

Majitelka potřebuje vidět potvrzené rezervace v Apple Kalendáři na iPhonu a Macu, ale nechceme:
- zavádět Google Calendar integraci
- řešit CalDAV sync nebo obousměrnou synchronizaci
- přesunout source of truth mimo PostgreSQL aplikace

Současně musí být řešení:
- jednoduché pro běžný provoz malého salonu
- bezpečné i bez interaktivního loginu
- kompatibilní s běžným subscription flow Apple Calendar / iCloud

## Rozhodnutí

Zavedli jsme jednostranný chráněný `.ics` feed na route `/api/calendar/owner.ics?token=...`.

### Klíčové body

- Feed je read-only a slouží jen jako přehled potvrzených rezervací.
- Do feedu jdou pouze rezervace se stavem `CONFIRMED`.
- Rezervace v `PENDING`, `CANCELLED`, `COMPLETED` a `NO_SHOW` se do subscription kalendáře nepromítají.
- Endpoint generuje `.ics` dynamicky při každém requestu přímo z PostgreSQL.
- Admin správa feedu je owner-only a je součástí sekce `/admin/nastaveni`.

## Bezpečnostní model

- Feed používá samostatný model `CalendarFeed`.
- V databázi neukládáme raw subscription token.
- Kopírovatelná URL se odvozuje serverově z:
  - `CalendarFeed.id`
  - `CalendarFeed.scope`
  - `CalendarFeed.tokenSalt`
  - `ADMIN_SESSION_SECRET`
- Validace feedu probíhá přes HMAC podpis a `isActive` flag.
- Rotace tokenu znamená výměnu `tokenSalt`, takže starý odkaz okamžitě přestane fungovat.
- Vypnutí feedu nastaví `isActive = false`, takže se validace zastaví i bez mazání záznamu.

## Proč tato varianta

### Výhody

- Aplikace zůstává jediným source of truth.
- Apple Calendar funguje přes obyčejnou subscription URL bez další integrace.
- Admin může URL zkopírovat kdykoliv; není nutné držet raw token mimo první vytvoření.
- Rotace i deaktivace jsou levné a čitelné operace bez vedlejší infrastruktury.
- Nezavádíme novou externí knihovnu pro iCalendar ani další sync backend.

### Nezvolené alternativy

- Google Calendar integrace:
  - zamítnuto, mimo scope a zbytečně složité pro read-only přehled.
- CalDAV / obousměrný sync:
  - zamítnuto, vysoká složitost a provozní riziko.
- Veřejný nechráněný `.ics` feed:
  - zamítnuto kvůli ochraně osobních údajů.
- Uložení pouze hashovaného raw tokenu:
  - bezpečnostně dobré, ale zhoršuje UX, protože admin už neumí kdykoliv znovu zkopírovat stejný odkaz bez dalšího úložiště raw secretu.

## Kompatibilita a data

- Feed vrací `Content-Type: text/calendar; charset=utf-8`.
- `VCALENDAR` používá:
  - `VERSION:2.0`
  - `PRODID`
  - `CALSCALE:GREGORIAN`
  - `METHOD:PUBLISH`
- Každá rezervace je mapovaná na samostatný `VEVENT`.
- Eventy obsahují minimálně:
  - `UID`
  - `DTSTAMP`
  - `DTSTART`
  - `DTEND`
  - `SUMMARY`
- Doplňujeme i:
  - `DESCRIPTION`
  - `LOCATION`
  - `STATUS`
  - `LAST-MODIFIED`
  - `SEQUENCE`
- Časy zapisujeme s `TZID=Europe/Prague` a přikládáme `VTIMEZONE` blok.

## Dopady

- Owner admin získal jednoduchý blok `Kalendář` v sekci `Nastavení`.
- Přibyl model `CalendarFeed` a migrace `20260422193000_calendar_feed_v1`.
- Přibyla nová feature vrstva `src/features/calendar/lib/*`.
- Osobní údaje ve feedu jsou omezené na provozně užitečné minimum:
  - jméno klientky
  - služba
  - telefon
  - e-mail
  - klientská poznámka
- Pokud bude později potřeba feed omezit, máme text eventu centralizovaný v mapper helperu, ne rozptýlený po route handleru.
