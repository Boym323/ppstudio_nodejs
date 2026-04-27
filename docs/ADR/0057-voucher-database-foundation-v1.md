# ADR 0057: Voucher database foundation v1

## Kontext
- PP Studio potřebuje evidovat dárkové vouchery jako samostatnou doménu, ne jako slevové kódy.
- Voucher může být hodnotový (`VALUE`) nebo navázaný na konkrétní službu (`SERVICE`).
- Veřejná rezervace může v budoucnu uložit pouze záměr použít voucher; skutečné čerpání musí vzniknout až ruční admin akcí.

## Rozhodnutí
- Přidáváme Prisma enumy `VoucherType` a `VoucherStatus`.
- Přidáváme model `Voucher` pro vydaný voucher, jeho typ, stav, hodnotu nebo service snapshot a auditní vazbu na admin uživatele.
- Přidáváme model `VoucherRedemption` jako jediný perzistentní důkaz skutečného uplatnění voucheru.
- Model `Booking` dostává pouze MVP intent pole `intendedVoucherId`, `intendedVoucherCodeSnapshot` a `intendedVoucherValidatedAt`; samostatný `BookingVoucherIntent` se nepřidává.
- Aplikační UI, public booking flow a PDF zůstávají mimo tuto fázi.

## Alternativy
- Samostatný model `BookingVoucherIntent`: zamítnuto pro MVP, protože intent zatím stačí držet přímo na rezervaci.
- Okamžité odečtení voucheru při veřejném bookingu: zamítnuto, protože voucher není slevový kód a čerpání má být ruční admin rozhodnutí.
- Ukládání čerpání jen změnou zůstatku na voucheru: zamítnuto, protože chybí auditní stopa jednotlivých uplatnění.

## Důsledky
- `VALUE` voucher může mít postupné čerpání přes více `VoucherRedemption` záznamů.
- `SERVICE` voucher se váže na službu a drží snapshot názvu, ceny a délky pro historickou čitelnost.
- Budoucí admin akce musí čerpání zapisovat transakčně a udržovat `remainingValueCzk` / `status` konzistentní.
- Databáze zatím nevynucuje typová pravidla přes check constraint; budou v doménové validační vrstvě `src/features/vouchers`.

## Stav
- schváleno
