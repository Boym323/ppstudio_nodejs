# 0053 Server-side Matomo Reporting v1

## Stav

Accepted

## Kontext

Admin dashboard potřebuje číst agregovaná analytics data z Matomo Reporting API, ale klientský tracking používá jen veřejné `NEXT_PUBLIC_MATOMO_*` hodnoty. Reporting API vyžaduje `token_auth`, který nesmí být dostupný v browser bundle ani v prezentačních komponentách.

## Rozhodnutí

- Server-side Reporting API wrapper je v `src/lib/analytics/matomo.ts` a používá `import "server-only"`.
- Konfigurace je oddělená od klientského trackingu: `MATOMO_URL`, `MATOMO_SITE_ID`, `MATOMO_AUTH_TOKEN`.
- Wrapper volá metody `VisitsSummary.get`, `Goals.get`, `Actions.getPageUrls`, `Events.getAction`, `Referrers.getReferrerType` a `Referrers.getCampaigns` s parametry `idSite`, `period=day`, `date=today`, `format=JSON` a `token_auth`; goal a zdrojové reporty používají booking cíl `idGoal=1` a report `Actions.getPageUrls` si navíc říká o `flat=1`, aby šly bezpečně sečíst všechny varianty `/rezervace?...`.
- Pro sekci zdrojů rezervací wrapper navíc volá `Referrers.getCampaigns`; pokud kampaně nejsou dostupné, používá `Referrers.getReferrerType`.
- Každé volání používá Next.js serverový `fetch(url, { next: { revalidate: 300 } })`, aby dashboard nebil Matomo při každém renderu, ale data zůstala provozně čerstvá.
- Veřejné funkce vrací normalizovaná DTO a při chybě, nedostupném API nebo chybějící konfiguraci vrací nulové fallbacky místo výjimky do UI vrstvy.
- `getDashboardAnalytics()` skládá návštěvy, booking funnel a konverze odděleně: `conversions` a `conversionRate` bere z Matomo Goal `idGoal=1`, zatímco `funnel.viewed` bere z pageview `/rezervace` (`Actions.getPageUrls`) a kroky `service`, `term`, `contact`, `submitted`, `created` z klientských eventů. Event `Rezervace / Vytvořena` je technický konec funnelu, nikoli autoritativní goal metrika.
- Reporting navíc samostatně počítá `contactStepQuality` z eventů `Kontakt zahájen`, `Kontakt pole fokus`, `Kontakt pole vyplnění začátek` a `Kontakt pole chyba`, aby dashboard odlišil hlavní funnel od detailní kvality kontaktního kroku.
- `sources` mapuje kampaně nebo referrer typy na názvy jako `Instagram`, `Firmy`, `Google`, `Přímý vstup`, `Offline` a `Ostatní`; konverze u zdrojů jsou skutečné goal metriky pro `idGoal=1`, nikoli odhad rozdělený podle návštěvnosti.

## Dopady

- Nepřidává se žádná npm závislost.
- Reporting token se spravuje jako serverový secret a nesmí se objevit v `NEXT_PUBLIC_*` proměnných.
- Dashboard může bezpečně renderovat i při dočasném výpadku Matomo, jen zobrazí fallback hodnoty.
