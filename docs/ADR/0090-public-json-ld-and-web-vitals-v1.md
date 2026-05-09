# 0090 Public JSON-LD and Web Vitals v1

## Stav

Accepted

## Kontext

Veřejný web PP Studia potřebuje udržovat strukturovaná data pro lokální kosmetické studio a detail služby ze stejných veřejných read modelů, které se renderují v HTML. Zároveň chceme připravit základ pro reálné Web Vitals měření bez nové analytické platformy, bez DB změn a bez ukládání osobních údajů.

## Rozhodnutí

- JSON-LD se skládá přes `src/features/public/components/seo-json-ld.tsx` a vkládá se nativním `<script type="application/ld+json">` tagem přes sdílený serializer.
- `buildLocalBusinessJsonLd(...)` používá veřejný profil salonu ze `SiteSettings` fallback vrstvy a negeneruje otevírací dobu, protože dostupnost salonu stojí na ručně vypsaných termínech, ne na pevné otevírací době.
- Detail služby používá `buildServiceJsonLd(...)` s veřejným názvem, SEO popisem, canonical URL, providerem PP Studio, oblastí `Zlín`, nabídkou pouze při jasně číselné ceně a ISO 8601 délkou přes `durationMinutesToIsoDuration(...)`.
- JSON-LD serializer před vložením čistí `undefined`, `null` a prázdné stringy a escapuje znak `<`; českou diakritiku nechává čitelnou.
- Web Vitals se zachytávají v samostatné klientské komponentě `WebVitalsReporter` přes `useReportWebVitals` a posílají anonymní Matomo custom eventy `Web Vitals / <metric>` s ratingem a zaokrouhlenou hodnotou.

## Dopady

- Nepřidává se nová npm závislost, API endpoint ani databázový model.
- Matomo zůstává volitelné; bez konfigurace je Web Vitals reporting bezpečný no-op přes existující tracking helper.
- Do JSON-LD nepřidáváme recenze, ratingy ani pevnou otevírací dobu, dokud nejsou reálně viditelné a konzistentní na webu.
