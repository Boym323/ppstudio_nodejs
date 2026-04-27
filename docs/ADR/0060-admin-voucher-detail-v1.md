# ADR 0060: Admin voucher detail v1

## Kontext
- Voucher databázový základ, doménová vrstva a admin seznam už existují.
- Detail odkazy ze seznamu míří na paralelní OWNER a SALON URL, ale zatím končily bez specializovaného detailu.
- PDF, editace, zrušení a uplatnění voucheru nejsou součástí této iterace.

## Rozhodnutí
- Přidáváme read-only detail voucheru pro `OWNER` na `/admin/vouchery/[voucherId]` a pro `SALON` na `/admin/provoz/vouchery/[voucherId]`.
- Route se napojuje přes `createAdminVoucherDetailRoute(...)` v route factory a serverově ověřuje přístup k sekci `vouchery`.
- Prezentační vrstva je `src/features/admin/components/admin-voucher-detail-page.tsx`.
- Admin wrapper `getAdminVoucherDetailData(...)` používá existující voucher read model a doplňuje admin hrefy pro návrat na seznam a navázané rezervace.
- Detail ukazuje kód, typ, efektivní stav, platnosti, kupujícího/obdarovaného, hodnotu nebo snapshot služby, historii `VoucherRedemption` a interní poznámku.

## Alternativy
- Použít generickou dynamickou route `/admin/[section]/[id]`: zamítnuto, protože voucher detail má samostatnou statickou sekci a nemá sdílet booking detail kontrakt.
- Přidat editaci, rušení nebo redemption rovnou do detailu: odloženo, aby první detail zůstal nedestruktivní a provozně bezpečný.
- Přidat PDF download jako aktivní akci: odloženo, protože PDF generátor zatím neexistuje.

## Důsledky
- Interní poznámka je viditelná pouze v admin detailu a nesmí se později propisovat do veřejného PDF ani veřejného ověření voucheru.
- Detail zobrazuje efektivní stav podle aplikačního pravidla expirace, ale read operace nepřepisuje DB status.
- Budoucí akce nad voucherem mají navazovat na stejný admin wrapper a zachovat paralelní owner/salon URL tvar.

## Stav
- schváleno
