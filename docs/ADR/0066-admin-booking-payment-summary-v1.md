# ADR 0066: Admin booking payment summary v1

Poznámka k aktuálnímu stavu: toto rozhodnutí popisuje mezikrok, kdy panel `Úhrada` počítal jen voucherové čerpání. Evidenci běžných plateb mimo voucher následně doplnilo ADR 0078, které je pro současný stav autoritativní.

Aktualizace lifecycle voucherů: historická samostatná akce a formulář popsané níže už nejsou součástí UI ani finančního workflow. Skutečné `VoucherRedemption` vzniká pouze při atomickém dokončení návštěvy; stará serverová action zůstává jen jako odmítající kompatibilní pojistka.

## Kontext
- Voucher redemption u rezervace uz existuje a je provozni dukaz skutecneho uplatneni poukazu.
- Detail rezervace mel panel `Voucher`, ale obsluha potrebovala rychle videt, kolik je sluzba uhrazena voucherem a kolik zbyva doplatit.
- V době tohoto ADR projekt ještě neměl obecný platební ledger a tato konkrétní změna neměla zavést hotovost, kartu ani novou DB tabulku.

## Rozhodnuti
- Panel `Voucher` v admin detailu rezervace jsme v tomto mezikroku měnili na čtecí panel `Uhrada`.
- Read model `getAdminBookingDetailData(...)` pocita `voucher.paymentSummary` bez nove migrace.
- `totalPriceCzk` bere nejdrive ze snapshotu `Booking.servicePriceFromCzk`, fallbackove z aktualni `Service.priceFromCzk`.
- `voucherPaidCzk` je soucet existujicich `VoucherRedemption.amountCzk` pro rezervaci.
- `paidAmountCzk` je v teto verzi stejne jako `voucherPaidCzk`.
- `remainingAmountCzk` je `max(totalPriceCzk - paidAmountCzk, 0)`, pokud je cena znama.
- `paymentStatus` je `UNPAID`, `PARTIALLY_PAID` nebo `PAID` podle zaplacene castky a zbyvajiciho doplatku; pri nezname cene nesmi byt stav `PAID`.
- V době tohoto ADR sekce `Darkovy poukaz` v panelu používala `redeemBookingVoucherAction(...)` a `AdminBookingVoucherForm`; aktuální lifecycle je popsán v úvodní aktualizaci tohoto dokumentu.
- V době tohoto ADR UI panelu zůstávalo bez nové business logiky: summary se zobrazoval jako kompaktní receipt-like blok se stavem jako badge a vizuálně nejvýraznějším doplatkem. Historické rozložení sekce `Dárkový poukaz` a formuláře proto nereprezentuje aktuální UI.

## Alternativy
- Pridat `BookingPayment` tabulku: v době ADR zamitnuto, protoze aktualni cil byl jen voucher settlement summary; později nahrazeno ADR 0078.
- Evidovat hotovost a kartu v detailu rezervace: v době ADR odloženo jako mimo rozsah; později nahrazeno ADR 0078.
- Refaktorovat public booking, PDF nebo public overeni voucheru: zamitnuto, protoze uhrada vznikne az admin redemptionem.

## Dusledky
- `VoucherRedemption` zustava jediny zdroj uhrazene castky voucherem.
- Summary je odvozeny read model, ne novy financni ledger.
- Pokud rezervace nema cenu ani ve snapshotu, ani v aktualni sluzbe, UI ukaze `Cena neni nastavena` a nezobrazi stav jako uhrazeny.
- Dalsi voucher se v UI nenabizi, pokud uz rezervace ma redemption nebo pokud `remainingAmountCzk` vychazi na `0`.

## Stav
- nahrazeno ADR 0078 pro evidenci běžných plateb mimo voucher
