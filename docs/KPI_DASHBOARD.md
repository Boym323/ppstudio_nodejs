# KPI dashboard

Tento dokument je stručný zdroj pravdy pro dashboard `/admin/statistiky` a jeho provozní variantu `/admin/provoz/statistiky`. Před další úpravou nejdřív určete dotčenou metriku a otevřete pouze zde uvedený helper, komponentu a test.

## Přístup, čas a období

- Přístup mají přihlášené role `OWNER` a `SALON`; nepřihlášený uživatel je přesměrován na přihlášení.
- Všechny intervaly používají aplikační časovou zónu `Europe/Prague` a tvar `[od, do)`.
- Rezervace se do období řadí podle `scheduledStartsAt`, nikoli podle `createdAt`.
- Rychlé filtry: `this_month`, `last_month`, `last_30_days`, `this_year`; vlastní období: `custom`.
- URL vlastního období: `?period=custom&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`.
- Rychlý filtr se přepočítá ihned. Datumová pole jsou vidět jen u vlastního období a změny se použijí až potvrzením.
- Předchozí období bezprostředně předchází aktuálnímu a má stejnou délku.
- Retenční odkaz navíc používá `retention=8_11|12_15|16_plus` a referenční čas `retentionAt=<Unix ms>`.

Implementace období: `kpi-date-range.ts`, `kpi-period-filter.tsx`.

## Cenové a identifikační zásady

- Historické výpočty používají cenu rezervace `finalPriceCzk`, při její absenci `servicePriceFromCzk`.
- Nikdy se zpětně nepoužívá aktuální cena služby.
- Chybějící cenový snapshot se bezpečně interpretuje jako nula; u očekávaných tržeb se rezervace nezapočte a eviduje se v `missingPriceCount`.
- Klientky se počítají unikátně podle stabilního `clientId`.
- Historické rezervace bez spolehlivého `clientId` se do klientských metrik nezapojují a neslučují se podle jména, e-mailu ani telefonu.
- Dashboardový payload neposílá e-mail ani telefon klientky. Kontakty jsou dostupné až v oprávněném klientském seznamu/detailu.

## Definice KPI

### Tržby a návštěvy

- **Tržby:** součet historických cen rezervací ve stavu `COMPLETED`.
- **Dokončené návštěvy:** počet rezervací ve stavu `COMPLETED`.
- **Průměrná útrata:** tržby / počet dokončených návštěv; při nulovém počtu `0`.
- **Neuhrazená částka:** součet `max(0, historická cena − suma BookingPayment.amountCzk)` pouze u dokončených návštěv.

### Klientky

- **Nová klientka:** její vůbec první dokončená návštěva nastala ve vybraném období.
- **Vracející se klientka:** má dokončenou návštěvu v období a alespoň jednu dokončenou návštěvu před jeho začátkem.
- **Klientka s opakovanou návštěvou v období:** má v období nejméně dvě dokončené návštěvy.
- **Míra opakované návštěvy:** klientky s nejméně dvěma dokončenými návštěvami / unikátní klientky s dokončenou návštěvou v období.
- Klientka může být nová a současně opakovaná. Nemůže být současně nová a vracející se podle návštěvy před obdobím.

Implementace: `kpi-client-metrics.ts`.

### Storna a no-show

- **Storno:** stav `CANCELLED`.
- **No-show:** stav `NO_SHOW`.
- **Míra:** počet daného stavu / počet relevantních reálných rezervací.
- Relevantní rezervace musí mít publikovaný slot (`publishedAt` není `null`) a stav `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED` nebo `NO_SHOW`.
- Koncepty, nepublikované a technické záznamy jsou vyloučené.
- Při nulovém jmenovateli je míra `0`, nikdy `NaN`.
- **Hodnota zrušených rezervací** a **hodnota no-show rezervací** používají historické cenové snapshoty. Neoznačují se jako ušlé tržby.

Implementace: `kpi-disruption-metrics.ts`.

### Očekávané tržby

- Součet historických cen budoucích rezervací ve stavu `CONFIRMED`, jejichž slot má stav `PUBLISHED`.
- Interval je průnik vybraného období a času od aktuálního okamžiku.
- „Tento měsíc“ končí koncem aktuálního měsíce; „Tento rok“ koncem aktuálního roku.
- Historické období zobrazuje `—` a text „Historické období“, nikoli zavádějící nulu.
- Karta uvádí počet zahrnutých budoucích rezervací a případný počet rezervací bez ceny.
- Tooltip: „Potvrzené budoucí rezervace ve vybraném období.“

Implementace: `kpi-expected-revenue.ts`.

### Obsazenost

- Čas dokončených návštěv / čas slotů s aktuálním stavem `PUBLISHED`.
- Používá skutečné překrytí intervalů rezervací a slotů s vybraným obdobím.
- Historická obsazenost je orientační: model neuchovává úplnou historii publikace a opětovného uvolnění slotů.
- Toto omezení je uvedeno v tooltipu karty.

## Grafy

- „Vývoj tržeb“ a „Vývoj rezervací“ obsahují kompletní souvislou časovou řadu.
- Rozsah do 62 kalendářních dní používá jeden bod za každý den; delší rozsah jeden bod za každý kalendářní měsíc.
- Chybějící body mají nulové hodnoty.
- Každý bod má ISO `periodStart`; řadí se podle něj chronologicky před vytvořením českého popisku.
- Nespoléhá se na pořadí Prisma výsledků ani na lokalizovaný text.
- Přechody měsíce a roku používají pražský kalendář.
- UI omezuje počet viditelných popisků osy přibližně na osm, ale datové body zachovává všechny.

Implementace: `kpi-time-series.ts`, `kpi-date-range.ts`, `admin-kpi-dashboard-page.tsx`.

## Nejvýdělečnější služby

- Zahrnují pouze `COMPLETED` ve vybraném období.
- Název, cena a interval pocházejí z rezervace, nikoli z aktuální služby.
- **Průměr:** tržby / dokončené návštěvy.
- **Čas:** suma skutečných rozdílů `scheduledEndsAt − scheduledStartsAt`.
- **Kč/h:** tržby / (`reservedMinutes / 60`); při nulovém čase `null`, v UI `—`.
- **Podíl:** tržby služby / celkové tržby služeb.
- Výchozí řazení je podle tržeb sestupně. Lze řadit podle tržeb, návštěv, průměru a Kč/h.
- Standardně se zobrazí top 8; lze zobrazit všechny.
- Na úzké obrazovce je tabulka vodorovně posuvná a její název služby zůstává čitelný.

Implementace: `kpi-service-metrics.ts`, `kpi-services-table.tsx`.

## Akviziční zdroje

- Normalizace probíhá pouze v analytické agregaci; historické databázové hodnoty se nemění.
- Zdroj vychází přednostně z `acquisitionUtmSource`, jinak z `acquisitionSource`.
- Okolní mezery se odstraní a velikost písmen se ignoruje.
- Mapování zdrojů:
  - `ig`, `instagram` → `Instagram`
  - `fb`, `facebook` → `Facebook`
  - `google` → `Google`
  - `firmy`, `firmy_cz`, `firmy.cz` → `Firmy.cz`
  - `sklik`, `seznam` → `Sklik`
  - `direct`, explicitní přímý vstup → `Přímý vstup`
  - prázdná hodnota bez důkazu přímého vstupu → `Neznámý zdroj`
  - neznámá neprázdná hodnota se zachová v očištěné čitelné podobě
- Média: `cpc|ppc` → `CPC`, `social|social_media` → `Social`, `email|e_mail` → `E-mail`, `organic|organic_search` → `Organic`; prázdné → `Neuvedeno`.
- Kampaň se trimuje; prázdná se zobrazuje jako `—`.
- Souhrn agreguje podle normalizovaného zdroje. Detail zachovává zdroj, médium a kampaň.
- **Rezervace:** počet všech agregovaných rezervací.
- **Dokončeno:** počet `COMPLETED`.
- **Hodnota rezervací:** součet historických cen všech agregovaných rezervací.
- **Skutečné tržby:** součet historických cen pouze `COMPLETED`.
- **Průměrná hodnota:** hodnota rezervací / počet rezervací.
- Zařazení do období vždy používá plánované datum návštěvy.

Implementace: `kpi-acquisition.ts`.

## Retence

- Referenční okamžik je konec vybraného období, nejvýše aktuální okamžik.
- Základem je poslední dokončená návštěva před referenčním okamžikem.
- Zahrnují se jen aktivní klientky alespoň s jednou dokončenou návštěvou.
- Pásma jsou výlučná:
  - `8_11`: 8–11 dokončených kalendářních týdnů,
  - `12_15`: 12–15 týdnů,
  - `16_plus`: 16 a více týdnů.
- Budoucí aktivní rezervace pásmo nemění; klientka se v seznamu označí „Již objednaná“.
- Kliknutí na kartu otevře klientský seznam se stejným pásmem i referenčním časem.

Implementace: `kpi-retention.ts`, retenční část `kpi-dashboard.ts`, `admin-clients.ts`.

## Porovnání KPI

- Stavy: dostupné srovnání, skutečná předchozí nula, chybějící použitelná historie.
- Při chybějících datech většiny metrik se zobrazí jedno společné upozornění; karty používají `—`.
- Předchozí nula není chybějící údaj. Při růstu z nuly se zobrazí „Nově“ místo nekonečného procenta.
- Nulový rozdíl se zobrazuje „Beze změny“.
- U procentních KPI je relativní změna v `%`, absolutní rozdíl v `p. b.`.
- Centrální konfigurace určuje význam směru:
  - růst je pozitivní u tržeb, dokončených návštěv, průměrné útraty, obsazenosti a opakovaných návštěv,
  - růst je negativní u storen, storno míry, no-show, no-show míry a neuhrazené částky.
- Pokles negativního KPI je pozitivní vývoj.

Implementace: `kpi-comparison.ts`, `kpi-config.ts`.

## Kontrolní součty

Automatické testy ověřují:

- relevantní rezervace = dokončené + storna + no-show + další explicitně povolené relevantní stavy (`PENDING`, `CONFIRMED`),
- hodnota rezervací = skutečné tržby dokončených + hodnota ostatních relevantních stavů,
- součet skutečných tržeb podle akvizičních zdrojů = hlavní KPI tržeb,
- součet dokončených podle akvizičních zdrojů = hlavní KPI dokončených návštěv,
- normalizace zdrojů nemění celkové počty ani peněžní součty.

Implementace testu: `kpi-consistency.test.ts`.

## UI, responzivita a přístupnost

- Dashboard zachovává design administrace.
- KPI definice používají klávesnicově a dotykově dostupné tooltipy.
- Tabulky mají sémantické hlavičky sloupců/řádků a fokusovatelný horizontální posun.
- Ovládací prvky mají minimální výšku 44 px a viditelné focus stavy.
- Akviziční tabulky a tabulka služeb se na 375 px posouvají uvnitř panelu; stránka jako celek horizontálně nepřetéká.
- Grafy mají textovou legendu, české popisky a strojový popis počtu chronologických bodů.

## Databázové dotazy, cache a ochrana dat

- Dashboard načítá omezené `select` projekce, nikoli celé rezervace.
- Dotazy jsou dávkové; klientky ani platby se nenačítají N+1.
- Hlavní intervalové dotazy využívají existující index `Booking(status, scheduledStartsAt)`.
- Aktuálně se nepoužívá sdílená cache. Stránka je serverově chráněná a dynamická, takže data různých relací se nemíchají a není potřebná cache invalidace.
- Případná budoucí cache musí být neveřejná, klíčovaná nejméně identitou salonu a intervalem, s TTL 30–120 sekund a invalidací po změně rezervace nebo platby.

## Mapa souborů

- Sestavení dat a Prisma dotazy: `src/features/admin/lib/kpi-dashboard.ts`
- Typy payloadu: `src/features/admin/types/kpi-dashboard.ts`
- Serverová stránka: `src/features/admin/components/admin-kpi-dashboard.tsx`
- Vykreslení dashboardu: `src/features/admin/components/admin-kpi-dashboard-page.tsx`
- Filtr období: `src/features/admin/components/kpi-period-filter.tsx`
- Tabulka služeb: `src/features/admin/components/kpi-services-table.tsx`
- Čisté výpočty a jejich testy: `src/features/admin/lib/kpi-*.ts`, `src/features/admin/lib/kpi-*.test.ts`
- OWNER route: `src/app/(admin)/admin/(protected)/statistiky/`
- SALON route: `src/app/(admin)/admin/provoz/statistiky/`
- Relevantní E2E: `tests/e2e/site-smoke.spec.ts`

## Minimální ověření po změně

Podle rozsahu spusťte nejmenší relevantní kontroly:

```bash
node --import ./src/test/register-server-only.mjs --import tsx --test src/features/admin/lib/kpi-*.test.ts src/features/admin/lib/kpi-client-metrics.integration.test.ts
npm run typecheck
npx eslint src/features/admin/components/admin-kpi-dashboard-page.tsx src/features/admin/components/kpi-period-filter.tsx src/features/admin/components/kpi-services-table.tsx src/features/admin/lib/kpi-*.ts
```

Při změně rout, filtru nebo responzivity navíc relevantní Playwright testy. Celý `npm test` a `npm run build` jsou nutné až při široké nebo rizikové změně či na výslovný požadavek.

## Známá omezení a další fáze

- Historická obsazenost je orientační kvůli chybějící historii publikace slotů.
- Rezervace bez `clientId` nelze bezpečně zahrnout do klientských metrik.
- Chybějící cenový snapshot nelze dopočítat z aktuálního ceníku bez zkreslení historie.
- Dashboard zatím neobsahuje náklady kampaní, ROAS, marže, cohorty, predikce ani exporty, protože pro ně nejsou kompletní a spolehlivé vstupy.
- Změna těchto omezení může vyžadovat nové snapshoty, databázové schéma nebo indexy; neřešit ji pouze prezentačním dopočtem.
