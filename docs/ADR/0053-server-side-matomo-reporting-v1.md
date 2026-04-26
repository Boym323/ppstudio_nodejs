# 0053 Server-side Matomo Reporting v1

## Stav

Accepted

## Kontext

Admin dashboard potřebuje číst agregovaná analytics data z Matomo Reporting API, ale klientský tracking používá jen veřejné `NEXT_PUBLIC_MATOMO_*` hodnoty. Reporting API vyžaduje `token_auth`, který nesmí být dostupný v browser bundle ani v prezentačních komponentách.

## Rozhodnutí

- Server-side Reporting API wrapper je v `src/lib/analytics/matomo.ts` a používá `import "server-only"`.
- Konfigurace je oddělená od klientského trackingu: `MATOMO_URL`, `MATOMO_SITE_ID`, `MATOMO_AUTH_TOKEN`.
- Wrapper volá metody `VisitsSummary.get`, `Goals.get`, `Events.getAction` a `Referrers.getReferrerType` s parametry `idSite`, `period=day`, `date=today`, `format=JSON` a `token_auth`.
- Pro sekci zdrojů rezervací wrapper navíc volá `Referrers.getCampaigns`; pokud kampaně nejsou dostupné, používá `Referrers.getReferrerType`.
- Každé volání používá Next.js serverový `fetch(url, { next: { revalidate: 300 } })`, aby dashboard nebil Matomo při každém renderu, ale data zůstala provozně čerstvá.
- Veřejné funkce vrací normalizovaná DTO a při chybě, nedostupném API nebo chybějící konfiguraci vrací nulové fallbacky místo výjimky do UI vrstvy.
- `getDashboardAnalytics()` skládá návštěvy, součet konverzí, konverzní poměr, nejlepší referrer a booking funnel z eventů `Booking / Service selected`, `Booking / Date selected`, `Booking / Time selected`, `Booking / Created`.
- `sources` je orientační business přehled: kampaně nebo referrer typy se mapují na názvy jako `Instagram`, `Firmy`, `Google`, `Přímý vstup`, `Offline` a `Ostatní`; konverze jsou rozdělené podle podílu návštěv zdroje na celkovém počtu zdrojových návštěv.

## Dopady

- Nepřidává se žádná npm závislost.
- Reporting token se spravuje jako serverový secret a nesmí se objevit v `NEXT_PUBLIC_*` proměnných.
- Dashboard může bezpečně renderovat i při dočasném výpadku Matomo, jen zobrazí fallback hodnoty.
