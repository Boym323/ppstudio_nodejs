# ADR 0007: Role-aware admin informační architektura

## Stav
Accepted

## Kontext
Admin část už měla základní auth a dvě role, ale prakticky nabízela jen dva placeholder dashboardy:

- chyběla samostatná informační architektura pro owner a provoz
- navigace neodpovídala rozdílným potřebám rolí
- lite admin by při dalším rozšíření snadno sklouzl k technickému chaosu
- ochrana sekcí potřebovala zůstat server-side, ne jen přes skrytí položek v menu

## Rozhodnutí
Zavádíme dvě role-aware admin oblasti nad stejnou doménou:

- `OWNER` používá full admin na `/admin/*`
- `SALON` používá lite admin na `/admin/provoz/*`

Použité principy:

- sdílené provozní sekce existují v obou oblastech
- owner-only sekce mají vlastní slugy a routy jen pod `/admin/*`
- navigace se generuje z centrální konfigurace v `src/config/navigation.ts`
- server-side guardy validují jak oblast, tak konkrétní sekci
- lite admin používá jednodušší copy, méně technických detailů a menší hustotu informací

## Důsledky

### Pozitivní
- owner a provoz dostávají rozdílné UX, ne jen rozdílná oprávnění
- technické sekce nejsou v lite adminu ani v navigaci, ani v routingu
- sdílené provozní sekce se renderují z jedné centrální definice, takže menu zůstává konzistentní s povolenými route
- rozšíření o formuláře nebo akce lze doplňovat po sekcích bez přestavby IA
- server drží finální autoritu nad tím, kam která role smí

### Negativní
- některé sekce existují ve dvou URL variantách
- přibyla read vrstva pro dashboard data a více route souborů

## Alternativy
- Jedna admin navigace s podmíněným schováváním položek: zamítnuto, protože by `SALON` pořád dědil mentální model full adminu.
- Pouze permission gate bez oddělených cest: zamítnuto, protože UX by zůstalo přeplněné.
- Samostatné duplicitní komponenty pro každou roli: zamítnuto, protože by rychle vznikl zbytečný maintenance dluh.
