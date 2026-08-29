# ADR 0062: Admin booking voucher redemption v1

## Kontext
- Voucher databázový základ, doménová vrstva, admin seznam, detail a tvorba voucheru už existují.
- Veřejný booking může v budoucnu uložit intended voucher na `Booking`, ale nesmí odečítat zůstatek.
- OWNER i SALON mají v provozu stejná práva pro uplatnění voucheru u rezervace.

## Rozhodnutí
- Do admin detailu rezervace přidáváme panel `Voucher` pro `/admin/rezervace/[bookingId]` i `/admin/provoz/rezervace/[bookingId]`.
- Read model `getAdminBookingDetailData(...)` vrací intended voucher, snapshot kódu a historii `VoucherRedemption` záznamů pro danou rezervaci.
- Voucherový panel zobrazuje případný intended voucher jako záměr zadaný při rezervaci; neobsahuje samostatné tlačítko pro finanční čerpání.
- Skutečné čerpání probíhá v `completeBookingVisitAction(...)`: v jedné serializovatelné transakci se rezervace nejdříve přepne do `COMPLETED` a následně se vytvoří `VoucherRedemption`. Při chybě se vrátí celá transakce.
- Historická server action `redeemBookingVoucherAction(...)` zůstává pouze jako fail-closed kompatibilní pojistka a žádné redemption nevytváří.
- Rezervaci s existujícím redemptionem nelze dodatečně stornovat, označit jako `NO_SHOW` ani přesunout; finanční historie se nemaže ani tiše nereverzuje.

## Alternativy
- Uplatnit voucher přímo z detailu voucheru: odloženo, protože provozní kontext je konkrétní návštěva a rezervace.
- Ukládat čerpání už ve veřejném booking flow: zamítnuto, protože zadání kódu klientkou je pouze intent a nesmí odečítat hodnotu.
- Přidat storno redemptionu hned v první iteraci: odloženo jako samostatné workflow s vlastním auditem.

## Důsledky
- Skutečné čerpání voucheru vzniká pouze vytvořením `VoucherRedemption` v rámci dokončení návštěvy.
- Hodnotový voucher vyžaduje částku, kterou doménová vrstva kontroluje proti zůstatku.
- Službový voucher se uplatní pouze při shodě `voucher.serviceId` a `booking.serviceId`.
- Panel zobrazuje historii všech redemption záznamů u rezervace, ale neobsahuje destruktivní akce.
- `CANCELLED`, `NO_SHOW` a jiné nedokončené stavy nemohou vytvořit nové redemption.

## Stav
- schváleno
