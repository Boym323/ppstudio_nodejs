# ADR 0073: Admin voucher list density v2

## Kontext
- První verze admin seznamu voucherů už měla správná data a URL-driven filtry, ale horní statistiky, filtry i tabulka byly vizuálně příliš vysoké.
- Stavové badge působily odtrženě od konkrétních řádků, takže hlavní provozní úkoly šly číst pomaleji než je potřeba.
- Voucher evidence je provozní obrazovka, ne dashboard; priorita je rychlá orientace v kódu, typu, zůstatku, stavu a platnosti.

## Rozhodnutí
- Seznam zůstává server-rendered a URL-driven, ale layout se zhušťuje do nižšího workflow.
- Horní metriky jsou nově v jedné nízké čtyřsloupcové kartě `Voucherů celkem / Aktivní / Částečně čerpané / Uzavřené`.
- Desktopový hlavní obsah tvoří skutečná tabulka se sloupci `Kód`, `Typ`, `Voucher`, `Čerpání / zůstatek`, `Stav`, `Platnost` a `Akce`.
- Stavové badge jsou přímo ve sloupci `Stav`; `Propadlý` dostává vlastní varovný tón a badge už nepoužívají přehnaný uppercase styling, který by zvětšoval výšku řádku.
- Mobil zůstává kartový, ale zachovává stejnou informační prioritu jako desktop.

## Alternativy
- Zachovat samostatné vysoké KPI karty: zamítnuto, protože vytlačovaly tabulku pod přehyb bez vyšší informační hodnoty.
- Nechat grid-based pseudo-tabuku: zamítnuto, protože hůř držela badge uvnitř řádku a méně přesně reprezentovala tabulární obsah.
- Přesunout část údajů do detailu voucheru: zamítnuto, protože seznam musí sám odpovědět na základní provozní otázky bez zbytečných kliků.

## Důsledky
- Voucher list UI je hustší a tabulka je hlavní fokální bod stránky.
- Prezentační vrstva nově víc rozlišuje primární a sekundární text v buňce `Voucher`, ale business logika, filtrace i routy zůstávají beze změny.
- Další úpravy seznamu by měly držet nízkou výšku hlavičky, stripu i filtrů a nevracet se k dashboardovému rytmu.

## Stav
- schváleno
