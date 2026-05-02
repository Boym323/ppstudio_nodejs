# ADR 0079: Admin voucher operational edit and cancellation v1

## Kontext
- Admin detail voucheru byl převážně read-only a provoz potřebuje opravovat bezpečné kontaktní údaje nebo platnost bez zásahu do hodnoty voucheru.
- Voucher nesmí být fyzicky mazán, protože kód, PDF, e-mailová historie a případné čerpání tvoří provozní auditní stopu.
- `OWNER` i `SALON` mají v PP Studiu stejná provozní práva k voucherům.

## Rozhodnutí
- Používáme existující stav `VoucherStatus.CANCELLED`.
- Do `Voucher` přidáváme `cancelledByUserId`, `cancelReason` a `updatedByUserId`; existující `cancelledAt` zůstává časem zrušení.
- Zrušení je povolené jen pro voucher bez `VoucherRedemption`. Částečně nebo plně čerpaný voucher se v této verzi ručně neruší.
- Provozní editace smí měnit jen `purchaserName`, `purchaserEmail`, `validUntil` a `internalNote`.
- Kód, typ, hodnota, služba, měna, čerpání, rezervace, vytvoření a PDF identita zůstávají mimo běžnou provozní editaci.
- Veřejné ověření zrušeného voucheru vrací neutrální neplatný stav bez důvodu zrušení, interní poznámky nebo admin metadata.

## Důsledky
- Zrušený voucher zůstává dohledatelný v seznamu i detailu, ale nejde uplatnit.
- Admin detail zobrazuje kdo voucher zrušil, kdy a proč.
- Server actions mapují aktuální admin session na `AdminUser.id`; pokud jde o bootstrap účet bez DB záznamu, auditní FK může zůstat `null`.
- Nezavádíme refundy, účetnictví, pokladnu, automatické e-maily po zrušení ani nový audit log model.
- Nepřidáváme pole pro jméno obdarované osoby ani věnování.

## Stav
- schváleno
