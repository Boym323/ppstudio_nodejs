# ADR 0065: Public voucher verification v1

## Kontext
- PDF voucheru obsahuje QR kód na `/vouchery/overeni?code=...`.
- Veřejná kontrola musí pomoci klientce i obsluze ověřit platnost poukazu bez přihlášení.
- Voucher obsahuje citlivá a provozní data, která se nesmí ukazovat mimo admin: kupující e-mail, interní poznámka, historie čerpání, booking vazby a technická ID.
- Veřejná route nesmí voucher uplatnit ani měnit jeho zůstatek nebo stav.

## Rozhodnutí
- Veřejná route je `/vouchery/overeni` v public App Router části a přijímá volitelný query parametr `code`.
- Stránka má `noindex` metadata a není zařazená do `sitemap.ts`.
- Serverová validace běží přes `verifyVoucherPublic(...)` v `src/features/vouchers/lib/voucher-validation.ts`.
- Helper normalizuje kód, čte jen bezpečný select voucheru a vrací union výsledek `ok: true/false`.
- Platný výsledek smí ukázat jen kód, typ, zbývající hodnotu u hodnotového poukazu, název služby ze snapshotu u službového poukazu a platnost do.
- Neplatný výsledek smí ukázat pouze bezpečné důvody: nenalezený, zatím neaktivní, uplatněný, propadlý, zrušený nebo bez dostupného zůstatku.

## Alternativy
- Použít admin detail read model: zamítnuto, protože obsahuje interní poznámky, historii čerpání, uživatele a další provozní data.
- Použít booking validační helper: zamítnuto pro tuto route, protože vyžaduje `serviceId` a řeší i service mismatch, což samostatné ověření z QR kódu nepotřebuje.
- Vracet detailní technický stav chyby: zamítnuto, protože veřejná stránka nemá prozrazovat interní chyby ani citlivé kontexty.

## Důsledky
- Veřejné ověření je čistě read-only a nikdy nevytváří `VoucherRedemption`, nemění `remainingValueCzk` ani `Voucher.status`.
- Pokud se rozšíří veřejně povolená pole voucheru, musí se změnit explicitní safe helper i testy.
- QR odkazy z už stažených PDF zůstávají funkční, ale stránka se neindexuje.

## Stav
- schváleno
