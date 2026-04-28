# ADR 0066: Admin booking payment summary v1

## Kontext
- Voucher redemption u rezervace uz existuje a je provozni dukaz skutecneho uplatneni poukazu.
- Detail rezervace mel panel `Voucher`, ale obsluha potrebovala rychle videt, kolik je sluzba uhrazena voucherem a kolik zbyva doplatit.
- Projekt zatim nema obecny platebni ledger a aktualni zmena nema zavest hotovost, kartu ani novou DB tabulku.

## Rozhodnuti
- Panel `Voucher` v admin detailu rezervace menime na read-only panel `Uhrada`.
- Read model `getAdminBookingDetailData(...)` pocita `voucher.paymentSummary` bez nove migrace.
- `totalPriceCzk` bere nejdrive ze snapshotu `Booking.servicePriceFromCzk`, fallbackove z aktualni `Service.priceFromCzk`.
- `voucherPaidCzk` je soucet existujicich `VoucherRedemption.amountCzk` pro rezervaci.
- `paidAmountCzk` je v teto verzi stejne jako `voucherPaidCzk`.
- `remainingAmountCzk` je `max(totalPriceCzk - paidAmountCzk, 0)`, pokud je cena znama.
- `paymentStatus` je `UNPAID`, `PARTIALLY_PAID` nebo `PAID` podle zaplacene castky a zbyvajiciho doplatku; pri nezname cene nesmi byt stav `PAID`.
- Sekce `Darkovy poukaz` zustava v panelu a dal pouziva existujici `redeemBookingVoucherAction(...)` a `AdminBookingVoucherForm`.
- UI panelu zustava bez nove business logiky: summary se zobrazuje jako kompaktní receipt-like blok se stavem jako badge a vizuálně nejvýraznějším doplatkem. Sekce `Dárkový poukaz` i historie úhrad jsou zhuštěné; u rezervací bez intended voucheru i bez redemptionu se formulář zobrazi až po rozbalení přes `+ Uplatnit voucher`, ale u rezervací s intended voucherem je formulář přímo v jeho kartě bez anchor mezikroku.

## Alternativy
- Pridat `BookingPayment` tabulku: zamitnuto, protoze aktualni cil je jen voucher settlement summary a projekt nema zadani pro hotovost/kartu.
- Evidovat hotovost a kartu v detailu rezervace: zamitnuto jako mimo rozsah.
- Refaktorovat public booking, PDF nebo public overeni voucheru: zamitnuto, protoze uhrada vznikne az admin redemptionem.

## Dusledky
- `VoucherRedemption` zustava jediny zdroj uhrazene castky voucherem.
- Summary je odvozeny read model, ne novy financni ledger.
- Pokud rezervace nema cenu ani ve snapshotu, ani v aktualni sluzbe, UI ukaze `Cena neni nastavena` a nezobrazi stav jako uhrazeny.
- Dalsi voucher se v UI nenabizi, pokud uz rezervace ma redemption nebo pokud `remainingAmountCzk` vychazi na `0`.

## Stav
- schvaleno
