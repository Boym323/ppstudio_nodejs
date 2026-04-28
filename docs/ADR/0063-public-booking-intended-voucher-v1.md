# ADR 0063: Public booking intended voucher v1

## Kontext
- Voucher doména a admin uplatnění voucheru u rezervace už existují.
- `Booking` má pole pro intended voucher, ale veřejné booking flow je zatím neplnilo.
- Zadání voucheru klientkou při rezervaci není uplatnění poukazu.

## Rozhodnutí
- Kontaktní krok veřejné rezervace má volitelné pole `Kód voucheru`.
- Server při vytvoření rezervace volá `validateVoucherForBookingInput({ code, serviceId })`.
- Při validním voucheru se na `Booking` uloží pouze `intendedVoucherId`, normalizovaný `intendedVoucherCodeSnapshot` a `intendedVoucherValidatedAt`.
- Při nevalidním voucheru se rezervace nevytvoří a chyba se vrací k poli `voucherCode`.
- Potvrzovací obrazovka, rekapitulace a booking e-mail zobrazují jen bezpečný text, že poukaz bude zkontrolován a uplatněn při návštěvě.

## Alternativy
- Vytvořit `VoucherRedemption` už při veřejné rezervaci: zamítnuto, protože klientka pouze oznamuje záměr použít poukaz.
- Live odečítat nebo kalkulovat cenu v UI: zamítnuto, protože veřejný flow nemá provádět čerpání ani platební logiku.
- Vyžadovat, aby `VALUE` voucher pokryl celou cenu služby: zamítnuto, hodnotový voucher je kredit a zbytek se doplatí na místě.

## Důsledky
- Veřejné booking flow nemění `remainingValueCzk`, `Voucher.status` ani nevytváří `VoucherRedemption`.
- `VALUE` voucher je validní, pokud má kladný zůstatek, včetně `PARTIALLY_REDEEMED`.
- `SERVICE` voucher je validní pouze pro stejnou službu jako rezervace.
- Skutečné uplatnění zůstává v admin detailu rezervace.

## Stav
- schváleno
