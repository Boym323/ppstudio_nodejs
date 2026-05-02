# ADR 0078: Admin booking direct payments v1

## Kontext
- Detail rezervace už má panel `Úhrada`, který počítal doplatek z ceny služby a voucher redemption.
- Voucher redemption zůstává samostatný mechanismus pro skutečné čerpání dárkového poukazu.
- Provoz potřebuje k rezervaci evidovat i reálně přijaté platby mimo voucher: hotově, kartou, bankovním převodem / QR a jinou metodou.
- Projekt zatím nezavádí platební bránu, fakturaci, pokladnu, refundy ani skutečné generování QR kódu.

## Rozhodnutí
- Přidáváme enum `BookingPaymentMethod` a model `BookingPayment` s vazbou na `Booking` a volitelným auditním odkazem na `AdminUser`.
- `BookingPayment` eviduje pouze přijaté platby mimo voucher. Voucherové čerpání dál běží přes `VoucherRedemption`.
- Stav úhrady se neukládá do databáze; počítá ho helper `getBookingPaymentSummary(...)` ze snapshotu ceny rezervace, voucher redemptions a běžných plateb.
- UI zůstává v existujícím panelu `Úhrada` v detailu rezervace. Nevzniká nová samostatná platební karta mimo tento panel.
- `OWNER` i `SALON` mohou platbu zapsat. Mazání platby je omezené na `OWNER`.
- Metoda `BANK_TRANSFER` se v UI zobrazuje jako `Převodem / QR`, ale QR kód se v této verzi negeneruje.

## Důsledky
- Skutečný stav úhrady rezervace může být `Neuhrazeno`, `Částečně uhrazeno`, `Uhrazeno` nebo `Přeplaceno`.
- Přeplatek se nezakazuje; UI ho pouze zobrazí jako stav `Přeplaceno` a řádek `Přeplaceno o`.
- Public booking flow, cancel/reschedule token flow a voucher doména zůstávají beze změny.
- Při změně platebního summary nebo admin detailu je potřeba ověřit jak voucher historii, tak historii běžných plateb.

## Stav
- schváleno
