# ADR 0082: Admin explicit noindex v1

## Context

- Administrace je neveřejná část aplikace chráněná session a už blokovaná v `robots.txt`.
- Samotný `robots.txt` ale nefunguje jako explicitní stránkový signál pro URL, které by se k robotovi dostaly přes externí odkaz, preview, cache nebo chybnou konfiguraci.
- Next.js 16 App Router podporuje `metadata.robots` přímo v layoutu, takže lze nastavit stejnou politiku pro celý `/admin/*` strom bez opakování v jednotlivých stránkách.

## Decision

- Kořenový admin layout `src/app/(admin)/admin/layout.tsx` exportuje `metadata.robots` s `index: false` a `follow: false`.
- `src/app/robots.ts` dál blokuje `/admin`, `/admin/` a `/admin/*`, protože crawlerům nemá dávat důvod admin routy procházet.
- Stávající explicitní noindex na tokenových nebo veřejně dostupných citlivých stránkách zůstává per-page metadata, protože neleží pod admin layoutem.

## Consequences

- Každá současná i budoucí stránka pod `/admin/*`, včetně loginu, pozvánek, owner a provozních sekcí, dědí HTML meta tag `robots` s noindex/nofollow.
- Nové statické admin routy musí zůstat fyzicky pod `src/app/(admin)/admin`, jinak tuto politiku nezdědí.
- `robots.txt` a HTML metadata se doplňují: první omezuje crawl, druhé dává explicitní indexační signál při renderu stránky.
