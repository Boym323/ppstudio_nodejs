# ADR 0062: Admin booking voucher redemption v1

## Kontext
- Voucher databázový základ, doménová vrstva, admin seznam, detail a tvorba voucheru už existují.
- Veřejný booking může v budoucnu uložit intended voucher na `Booking`, ale nesmí odečítat zůstatek.
- OWNER i SALON mají v provozu stejná práva pro uplatnění voucheru u rezervace.

## Rozhodnutí
- Do admin detailu rezervace přidáváme panel `Voucher` pro `/admin/rezervace/[bookingId]` i `/admin/provoz/rezervace/[bookingId]`.
- Read model `getAdminBookingDetailData(...)` vrací intended voucher, snapshot kódu a historii `VoucherRedemption` záznamů pro danou rezervaci.
- Formulář `AdminBookingVoucherForm` volá server action `redeemBookingVoucherAction(...)`.
- Server action ověřuje roli `OWNER` nebo `SALON`, validuje vstup, volá `redeemVoucherForBooking(...)` a vrací typed action state se bezpečnou chybou nebo úspěchem.
- Po úspěchu se revalidují owner i salon booking detail/list cesty a voucher seznamy.

## Alternativy
- Uplatnit voucher přímo z detailu voucheru: odloženo, protože provozní kontext je konkrétní návštěva a rezervace.
- Ukládat čerpání už ve veřejném booking flow: zamítnuto, protože zadání kódu klientkou je pouze intent a nesmí odečítat hodnotu.
- Přidat storno redemptionu hned v první iteraci: odloženo jako samostatné workflow s vlastním auditem.

## Důsledky
- Skutečné čerpání voucheru vzniká pouze vytvořením `VoucherRedemption` v adminu.
- Hodnotový voucher vyžaduje částku, kterou doménová vrstva kontroluje proti zůstatku.
- Službový voucher se uplatní pouze při shodě `voucher.serviceId` a `booking.serviceId`.
- Panel zobrazuje historii všech redemption záznamů u rezervace, ale neobsahuje destruktivní akce.

## Stav
- schváleno
