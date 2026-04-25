# ADR 0050: Admin dashboard jako denní provozní panel

## Kontext

První verze operativního overview dashboardu už ukazovala dnešek, alerty a timeline, ale pořád měla několik UX slabin:

- horní část byla rozdělená mezi počítadlo rezervací a samostatný box `Další klientka`
- počet dnešních rezervací se opakoval v hero, quick stats a dalších kartách
- `Čeká na potvrzení` bylo schované mezi sekundárními KPI místo jasného pracovního alertu
- pravý panel byl přeplněný a míchal důležité denní akce s doplňkovými statistikami
- `Dnešní plán` působil spíš jako seznam než jako skutečný pracovní rozvrh

Současně nechceme měnit booking engine, slot calculation, email flow, datový model ani API kontrakty. Cíl je čistě v informační hierarchii a ergonomii každodenní práce.

## Rozhodnutí

Overview `/admin` a `/admin/provoz` se posouvá z dashboardu metrik na denní provozní panel otázky `Co mám dnes udělat?`.

- Horní část se sjednocuje do jediného bloku `Dnešní provoz`.
  - V jednom cardu jsou datum, dominantní počet dnešních rezervací, další klientka a hlavní CTA.
  - Součástí bloku je i kompaktní sekce `Dnešní úkoly`.
- `Čeká na potvrzení` se při nenulovém stavu zobrazuje jako primární alert nad dnešním plánem.
  - Ostatní alerty zůstávají sekundární.
  - Bez pending stavu se dashboard chová klidně a ukazuje jen decentní OK stav nebo menší sekundární upozornění.
- `Dnešní plán` je hlavní pracovní sekce.
  - Používá mini timeline s výrazným časem vlevo.
  - Rezervace a volná okna jsou jasně odlišené.
  - Řádky jsou click-to-open, mají hover/focus stavy a rychlé akce.
  - Rezervace používají existující inline server actions `Potvrdit / Zrušit / Otevřít`.
  - Volná okna nabízejí `Vytvořit rezervaci / Upravit slot`.
- Pravý panel se zjednodušuje na dva bloky:
  - `Nejbližší volné sloty`
  - `Rychlé akce`, kde je `Vytvořit rezervaci` vždy primární CTA
- KPI zůstávají jen jako doplňková spodní vrstva a neopakují počet dnešních rezervací.
- Overview zůstává server-rendered, ale route nově používá `Suspense` fallback se skeletonem pro klidnější loading stav.

## Alternativy

- Jen vizuálně přebarvit původní dashboard bez změny hierarchie.
- Přidat další KPI a grafy místo zjednodušení.
- Přesunout všechny rychlé akce do pravého panelu a timeline nechat pasivní.
- Vytvořit samostatnou edit route rezervace jen kvůli dashboardu.

## Důsledky

- Během několika sekund je jasné, co se děje dnes, kdo je další klientka, co vyžaduje pozornost a jaká akce má následovat.
- Přehled je méně duplicitní a méně kognitivně náročný.
- Dashboard znovu používá existující booking/status flow bez změny domény.
- Přibyla malá klientská vrstva jen pro interaktivitu timeline a toast feedback; read model a většina IA zůstávají serverové.

## Stav

schváleno
