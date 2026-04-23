# ADR 0036: Public cancellation policy page v1

## Kontext

Stránka `/storno-podminky` původně používala stejnou skladbu jako ostatní právní stránky přes sdílenou komponentu `LegalPage`. To fungovalo pro delší právní texty, ale u storno podmínek vznikal praktický problém:

- hero působil jako obecný právní obsah místo rychlé provozní informace
- klientka neviděla hned první akci `jak rezervaci zrušit`
- klíčová pravidla (`včas zdarma`, `pozdě plná úhrada`, `no-show`) byla schovaná až v textu
- stránka nepůsobila dostatečně konkrétně a důvěryhodně pro provoz salonu

## Rozhodnutí

Pro `/storno-podminky` zavádíme specializovanou veřejnou skladbu `CancellationPolicyPage`, zatímco ostatní právní stránky dál zůstávají na sdílené `LegalPage`.

Nová stránka má pevnou strukturu:

1. hero s finálním krátkým copy
2. praktický pravý blok `Jak zrušit rezervaci` s klikacím telefonem a e-mailem
3. stručný přehled nejdůležitějších pravidel v samostatných kartách
4. menší obsahové sekce s anchor navigací
5. závěrečnou provozní poznámku s výzvou ozvat se co nejdříve

Obsah dál vzniká centrálně v `src/content/public-site.ts` a bere kontaktní údaje i storno limit ze `SiteSettings`.

## Alternativy

### Rozšířit `LegalPage` pro všechny právní stránky

Zamítnuto, protože by generická komponenta začala nést příliš mnoho variant kvůli jedné praktické stránce a zhoršila by se čitelnost jejího API.

### Nechat stávající layout a upravit jen text

Zamítnuto, protože samotný copy refresh by nevyřešil hlavní UX problém: chybějící okamžitou akci a rychlou scanovatelnost.

## Důsledky

- `/storno-podminky` má vlastní akčnější UX bez dopadu na `/obchodni-podminky` a `/gdpr`
- sdílená právní vrstva zůstává jednodušší a vhodná pro delší textové stránky
- při změně `SiteSettings` je nutné dál ručně ověřit i storno summary karty a kontaktní box

## Stav

schváleno
