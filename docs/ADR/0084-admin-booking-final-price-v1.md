# ADR 0084: Admin booking final price v1

## Kontext
- Panel `Úhrada` umí evidovat voucherová čerpání a skutečně přijaté platby mimo voucher.
- Provoz potřebuje dát klientce individuální slevu nebo výjimečné navýšení bez toho, aby se tato úprava tvářila jako platba.
- Záporná platba by zkreslila reporting `Uhrazeno mimo voucher` a míchala by obchodní rozhodnutí s peněžním tokem.

## Rozhodnutí
- Na `Booking` přidáváme volitelnou finální cenu `finalPriceCzk` a auditní metadata `priceAdjustmentReason`, `priceAdjustedAt`, `priceAdjustedByUserId`.
- Původní `Booking.servicePriceFromCzk` zůstává ceníkový snapshot služby při vytvoření rezervace.
- Efektivní cena pro úhradu je `Booking.finalPriceCzk ?? Booking.servicePriceFromCzk`, s fallbackem na aktuální `Service.priceFromCzk` jen tam, kde historický snapshot chybí.
- Úprava ceny je dostupná pro `OWNER` i `SALON`, protože jde o běžný provozní zásah v detailu rezervace.
- Rozdílná finální cena vyžaduje důvod. Prázdná hodnota nebo částka shodná s ceníkovým snapshotem úpravu ruší.
- `BookingPayment` dál eviduje pouze skutečně přijaté platby mimo voucher. Voucherové čerpání dál zůstává ve `VoucherRedemption`.
- `SERVICE` voucher je nárok na konkrétní službu, ne hodnotová sleva. Při čerpání se proto dál zapisuje podle snapshotu služby na voucheru a individuální cena rezervace nemění jeho redeem částku.

## Důsledky
- Platební summary, doporučená částka pro `VALUE` voucher a `CRM souhrn` počítají z finální ceny rezervace.
- Doporučená částka se u `SERVICE` voucheru nezadává; doména ověřuje shodu služby a neporovnává cenu rezervace.
- Sleva se v UI ukazuje jako rozdíl mezi ceníkovou cenou a cenou k úhradě, ne jako záporná platba.
- Reporting `Uhrazeno` zůstává čistý: sčítá jen voucherová čerpání a skutečně zapsané platby.
- Release obsahuje Prisma migraci `20260507103000_booking_final_price_v1`.

## Stav
- schváleno
