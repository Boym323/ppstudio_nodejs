# ADR 0059: Admin voucher list v1

## Kontext
- Databáze a serverová voucher doména už existují, ale provoz zatím neměl čitelný admin přehled voucherů.
- Admin rozhraní má dvě oblasti: `OWNER` na `/admin/*` a `SALON` na `/admin/provoz/*`.
- Voucher detail, tvorba a destruktivní akce nejsou součástí této iterace.

## Rozhodnutí
- Přidáváme sdílenou admin sekci `vouchery` do centrální navigace, route factory a admin guardu.
- OWNER používá `/admin/vouchery`, SALON používá `/admin/provoz/vouchery`.
- Stránka seznamu žije v `src/features/admin/components/admin-vouchers-page.tsx`, read model v `src/features/admin/lib/admin-vouchers.ts`.
- Filtry jsou URL-driven přes `q`, `type` a `status`.
- Stavový filtr i zobrazení pracují s efektivním stavem voucheru. Aktivní nebo částečně čerpaný voucher po `validUntil` je v seznamu `Propadlý`, aniž by read operace přepisovala DB status.

## Alternativy
- Vytvořit samostatné fyzické route soubory pro owner a salon: zamítnuto, protože projekt už sdílí admin sekce přes route factory a guard.
- Filtrovat `EXPIRED` jen podle DB statusu: zamítnuto, protože by admin seznam neodpovídal validační doménové logice.
- Přidat rovnou tvorbu a čerpání voucheru: odloženo, aby první UI vrstva zůstala nedestruktivní a snadno ověřitelná.

## Důsledky
- Navigace i serverový guard musí držet `vouchery` jako sdílenou sekci pro obě admin role.
- Budoucí detail a tvorba voucheru by měly zachovat paralelní owner/salon URL tvar.
- Read model voucherů nese formátovaný zůstatek pro admin UI, aby prezentační vrstva neduplikovala měnovou logiku.

## Stav
- schváleno
