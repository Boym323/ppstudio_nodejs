# ADR 0067: Admin voucher email delivery v1

## Kontext
- Voucher system uz ma databazovy model, admin seznam/detail/create, PDF generator a verejne overeni kodu.
- PP Studio potrebuje poslat voucher e-mailem rucne z admin detailu, bez automatickeho odesilani pri vytvoreni.
- Projekt uz ma email outbox architekturu (`EmailLog`, worker, retry) a novy flow ma zustat konzistentni s timto modelem.

## Rozhodnuti
- V detailu voucheru je nova manualni akce `Poslat e-mailem` dostupna pro role `OWNER` i `SALON`.
- Odeslani bezi jen pres server action s povinnou kontrolou session + role + server-side validace vstupu.
- Odeslat lze pouze vouchery s efektivnim stavem `ACTIVE` nebo `PARTIALLY_REDEEMED`.
- Stavy `DRAFT`, `REDEEMED`, `EXPIRED`, `CANCELLED` jsou blokovane bez side effectu.
- Email se neposila primo z klienta; zalozi se `EmailLog` s novym typem `VOUCHER_SENT` a template key `voucher-sent-v1`.
- Template `voucher-sent-v1` generuje PDF server-side pres existujici helper (`generateVoucherPdf`) bez HTTP callu na admin PDF route.
- Finalni email obsahuje jen bezpecna business data (typ, hodnota nebo sluzba, kod, platnost, overovaci URL, instrukce) a prilohu `voucher-KOD.pdf` s `application/pdf`.
- Interni data (`internalNote`, historie cerpani, technicka ID) se do emailu ani prilohy neposilaji.

## Alternativy
- Prime SMTP odeslani rovnou ze server action: zamitnuto, protoze by vznikly dva nekonzistentni email flow.
- Posilani bez prilohy jen s odkazem: zamitnuto jako vychozi varianta, protoze existujici serverovy PDF helper umoznuje rozumne pridat attachment.
- Automaticke odeslani pri vytvoreni voucheru: zamitnuto, business pozadavek je explicitne manualni trigger.

## Dusledky
- Voucher email flow pouziva stejnou observabilitu a retry jako ostatni emaily pres `EmailLog`.
- V `EMAIL_DELIVERY_MODE=background` je voucher email queued pro worker a retry.
- V `EMAIL_DELIVERY_MODE=log` se zapisuje odeslani bez SMTP side effectu, aby slo flow bezpecne testovat.
- Business logika cerpani voucheru se nemeni; jde jen o komunikacni vrstvu nad existujicim voucher modelem.

## Stav
- schvaleno
