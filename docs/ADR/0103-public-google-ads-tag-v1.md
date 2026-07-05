# 0103: Public Google Ads Tag v1

## Kontext

PP Studio potřebuje na veřejném webu volitelně nasadit Google tag (`gtag.js`) pro Google Ads měření nad ID typu `AW-*`. Zároveň chceme zachovat stejné privacy guardy jako u Matomo, Clarity a Meta Pixelu: žádné měření adminu, žádné tokenové self-service URL a bezpečný default `off`.

## Rozhodnutí

- Google Ads tag je volitelně zapnutý přes `NEXT_PUBLIC_GOOGLE_ADS_ENABLED=true` a `NEXT_PUBLIC_GOOGLE_ADS_ID`.
- Inicializace běží přes `next/script` v klientské komponentě `src/features/analytics/google-ads-tracker.tsx`, renderované ze `SiteShell`.
- Tracker se nenačítá v adminu, API, Next internals ani na tokenových self-service routách (`/rezervace/sprava/*`, `/rezervace/storno/*`, `/rezervace/akce/*`).
- Při přítomné admin session cookie `ppstudio-admin-session` se tag na veřejných stránkách také nespouští.
- Protože projekt běží na App Routeru, tracker po klientské navigaci dopošle další `gtag('config', tagId, { page_path, page_title })`, aby se pageview neztrácely při přechodech bez full reloadu.
- `page_path` používá stejnou sanitizaci jako Matomo helper, takže nepropouští tokenové segmenty ani citlivé query parametry.

## Důsledky

- HTML snippet od Google Ads se v tomto projektu nevkládá přímo do layoutu jako raw `<script>...</script>`, ale přes `next/script` a feature-flag guardy kompatibilní s Next.js 16 App Routerem.
- Integrace nepřidává žádnou novou runtime závislost.
- Pokud budou později potřeba konkrétní konverzní eventy Google Ads, mají navázat na tuto sdílenou tracker vrstvu místo ad-hoc inline skriptů v jednotlivých stránkách.
