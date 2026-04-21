# ADR 0020: Admin layout Kategorie sluzeb v2

## Kontext

Prvni produkcni workflow pro `Kategorie sluzeb` uz bylo funkcni, ale pri kazdodenni praci salonu narazelo na prakticke limity:

- desktop seznam a detail nebyly dost oddelene pro rychle prochazeni vice kategorii
- problematicke kategorie nebyly dost viditelne uz v hlavnim seznamu
- mobilni detail sice existoval, ale chybel mu vyraznejsi vlastni UX s rychlymi akcemi
- rychle provozni zmeny jako zapnuti/vypnuti nebo reorder stale pusobily vic jako mini navigace nez jako okamzita akce

## Rozhodnuti

- Sekce `Kategorie sluzeb` zustane na stavajicich routach `/admin/kategorie-sluzeb` a `/admin/provoz/kategorie-sluzeb`.
- Desktop workflow bude mit pracovni rozlozeni `hlavni seznam + sticky detail`, pricemz levy shell sidebar zustava soucasti sdileneho admin layoutu.
- Vznikne nova sada komponent v `src/components/admin/categories/` oddelena od feature server wrapperu:
  - `CategoryStats`
  - `CategoryFilters`
  - `CategoryList`
  - `CategoryRow`
  - `CategoryDetailPanel`
  - `CategoryDetailDrawer`
  - `CategoryManagementWorkspace`
- Rychle akce `toggle aktivni` a `posun nahoru/dolu` budou dal bezet pres server actions, ale UI smi pouzit lehky optimistic state pres React primitives.
- Mobil zustane bez nove routy; detail se otevre jako full-screen drawer nad hlavnim seznamem.

## Alternativy

- Samostatna detail route pro kazdou kategorii: zamitnuto, protoze by zvetsila pocet navigacnich kroku a zhorsila rychlost bezne obsluhy.
- Tezsi klientsky state management nebo drag-and-drop knihovna: zamitnuto, protoze by zvetsila bundle i provozni slozitost bez jasne potreby.
- Ponechat puvodni server-refresh model bez optimistic UI: zamitnuto, protoze prepinani aktivity a reorder musi pusobit okamzite.

## Dusledky

- Read model musi dodavat vic kontextu pro seznam i detail najednou, vcetne preview navazanych sluzeb a warningu.
- Query params `mode` a `mobileDetail` zustavaji jen jako vstup do workflow; po nacteni uz klient muze pracovat s lokalnim stavem.
- Dokumentace a manualni QA musi nove pokryvat sticky desktop detail, chip filtry a mobilni drawer.

## Stav

schvaleno
