# 0051 Public Matomo Analytics v1

## Stav

Accepted

## Kontext

PP Studio potřebuje měřit návštěvnost veřejného webu, rezervační funnel a dokončené rezervace bez Google Analytics, session replay, heatmap nebo ukládání analytics dat do aplikační databáze. Admin nesmí být měřený a tracking nesmí posílat osobní údaje ani tokenové URL.

## Rozhodnutí

- Matomo je volitelně zapnuté přes `NEXT_PUBLIC_MATOMO_ENABLED=true`, `NEXT_PUBLIC_MATOMO_URL` a `NEXT_PUBLIC_MATOMO_SITE_ID`.
- Inicializace je v klientské komponentě `MatomoTracker`, vložené jen do veřejného `SiteShell`, který používají public a booking stránky, ne admin.
- `SiteShell` navíc před renderem kontroluje přítomnost admin session cookie `ppstudio-admin-session` a při aktivní admin session předá do `MatomoTracker` `disabled=true`, takže se Matomo nenačte ani na veřejných stránkách otevřených přihlášeným adminem.
- App Router klientské navigace se měří přes změny `pathname` a `searchParams`; první pageview posílá inicializační script a efekt ho neduplikuje.
- Tracking helper `trackMatomoEvent` je bezpečný no-op při SSR, chybějící konfiguraci nebo nedostupné `_paq`.
- Sanitizace zahazuje citlivé query parametry a rediguje tokenové self-service booking route na bezpečné placeholder path.
- Admin, API a Next internals Matomo vůbec neinicializují. Tokenové self-service booking route neinicializují pageview, ale mohou inicializovat `_paq` pro bezpečné custom eventy z klientských handlerů.
- První krok booking funnelu je samotný Matomo pageview `/rezervace`; klientské funnel eventy se volají až pro navazující kroky veřejného flow: `Rezervace / Služba vybrána`, `Rezervace / Čas vybrán`, `Rezervace / Kontakt zahájen`, `Rezervace / Odeslána rezervace` a `Rezervace / Vytvořena`.
- `Rezervace / Formulář chyba` je agregovaný diagnostický event pro klientskou blokaci kontaktního kroku nebo serverový submit error; detailní field-level signály zůstávají odděleně jako `Kontakt pole fokus`, `Kontakt pole vyplnění začátek`, `Kontakt pole chyba`.
- Self-service změna termínu posílá pouze `Rezervace / Datum vybráno` s denním klíčem a `Rezervace / Čas vybrán` s rozsahem času; neposílá token, URL, klientku ani kontakt.

## Matomo Goal

Goal se nastaví ručně v Matomo, ne přes API:

- název: `Rezervace vytvořena`
- trigger: `custom event`
- category: `Rezervace`
- action: `Vytvořena`

## Dopady

- Nezavádí se nová npm závislost.
- Analytics výpadek nesmí rozbít web ani rezervační flow.
- Do Matomo se neposílají jména, e-maily, telefony, poznámky, booking tokeny ani raw citlivé URL.
- Tokenové manage/storno/action route zůstávají mimo pageview reporting, takže případné self-service eventy nejsou navázané na raw tokenovou URL.
