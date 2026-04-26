# 0051 Public Matomo Analytics v1

## Stav

Accepted

## Kontext

PP Studio potřebuje měřit návštěvnost veřejného webu, rezervační funnel a dokončené rezervace bez Google Analytics, session replay, heatmap nebo ukládání analytics dat do aplikační databáze. Admin nesmí být měřený a tracking nesmí posílat osobní údaje ani tokenové URL.

## Rozhodnutí

- Matomo je volitelně zapnuté přes `NEXT_PUBLIC_MATOMO_ENABLED=true`, `NEXT_PUBLIC_MATOMO_URL` a `NEXT_PUBLIC_MATOMO_SITE_ID`.
- Inicializace je v klientské komponentě `MatomoTracker`, vložené jen do veřejného `SiteShell`, který používají public a booking stránky, ne admin.
- App Router klientské navigace se měří přes změny `pathname` a `searchParams`; první pageview posílá inicializační script a efekt ho neduplikuje.
- Tracking helper `trackMatomoEvent` je bezpečný no-op při SSR, chybějící konfiguraci nebo nedostupné `_paq`.
- Sanitizace zahazuje citlivé query parametry a rediguje tokenové self-service booking route na bezpečné placeholder path.
- Admin, API a Next internals Matomo vůbec neinicializují. Tokenové self-service booking route neinicializují pageview, ale mohou inicializovat `_paq` pro bezpečné custom eventy z klientských handlerů.
- Booking funnel eventy se volají pouze v client handlerech a `Booking / Created` až po úspěšném návratu server action, chráněný refem proti duplicitnímu odeslání.
- Self-service změna termínu posílá pouze `Booking / Date selected` s denním klíčem a `Booking / Time selected` s rozsahem času; neposílá token, URL, klientku ani kontakt.

## Matomo Goal

Goal se nastaví ručně v Matomo, ne přes API:

- název: `Booking created`
- trigger: `custom event`
- category: `Booking`
- action: `Created`

## Dopady

- Nezavádí se nová npm závislost.
- Analytics výpadek nesmí rozbít web ani rezervační flow.
- Do Matomo se neposílají jména, e-maily, telefony, poznámky, booking tokeny ani raw citlivé URL.
- Tokenové manage/storno/action route zůstávají mimo pageview reporting, takže případné self-service eventy nejsou navázané na raw tokenovou URL.
