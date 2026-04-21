# ADR 0024: Operativní dashboard dne pro admin overview

## Stav
schváleno

## Kontext
Původní overview adminu fungoval jako obecný hero se statistikami a dvojice seznamů. To stačilo pro první orientaci, ale neodpovídalo tomu, jak salon dashboard skutečně používá:

- během několika sekund musí být vidět dnešek, další klientka a co čeká na akci
- nejdůležitější není dlouhodobá statistika, ale provozní rozhodnutí pro dnešní směnu
- owner i salon role sice mají jinou šířku navigace, ale na overview potřebují stejný klidný workspace orientovaný na dnešní provoz
- původní `admin-data.ts` vracel spíš obecný read model pro více typů overview/sekcí, což tlačilo UI do příliš generické skladby

## Rozhodnutí
- Overview na `/admin` a `/admin/provoz` se mění na operativní dashboard dne.
- Layout je fixní a neodvozuje se z generického page shellu:
  - hlavní plocha: `TodayHeroCard`, `AlertsRow`, `TodayTimeline`, `KPIGrid`
  - pravý sidebar: `QuickStats`, karta `Čeká na potvrzení`, `UpcomingSlots`, `QuickActions`
- Levý navigační sidebar zůstává součástí `AdminShell`; jeho spacing se jen lehce utahuje.
- Dashboard má vlastní serverový read model `src/features/admin/lib/admin-dashboard.ts`, který skládá data napřímo z existujících modelů `Booking`, `AvailabilitySlot`, `Client`, `Service`, `ServiceCategory` a `EmailLog`.
- `AdminOverviewPage` je jen tenký wrapper, který načte read model a předá ho do prezentační komponenty `admin-dashboard-page.tsx`.
- Dashboard zůstává server-rendered a nepřidává další klientský state management ani novou UI knihovnu.

## Důsledky

### Pozitivní
- obsluha rychleji přečte dnešní situaci a má na jedné obrazovce navazující akce
- overview je vizuálně stabilní a nezahlcuje horní část technickými metrikami
- owner i salon používají stejný mentální model dashboardu, jen s rozdílnou navigací a cílovými URL
- změna nevyžaduje nové dependency ani datovou migraci

### Negativní
- overview už není vhodné místo pro rozšiřování o obecné manažerské reporty; ty budou případně potřebovat samostatnou sekci
- část logiky pro dashboard je nyní oddělená od staršího `admin-data.ts`, takže při změnách admin overview je potřeba hlídat dvě read vrstvy
- tlačítko `Upravit` u další klientky zatím vede do existujícího detail workflow rezervace, protože samostatná edit route rezervace zatím neexistuje

## Alternativy
- Zachovat generický hero + stat cards a jen je vizuálně přebarvit: zamítnuto, protože problém byl ve struktuře a prioritách, ne jen v designu.
- Přidat hned grafy a týdenní trendové boxy: zamítnuto, protože overview má být operativní, ne reportovací.
- Udělat rozdílný dashboard pro `OWNER` a `SALON`: zamítnuto pro tuto iteraci, protože hlavní provozní otázky dne jsou pro obě role stejné a rozdíl stačí řešit navigací a cílovými linky.
