# ADR 0064: Voucher PDF generator v1

## Kontext
- Admin evidence voucherů už umí vytvoření, detail, uplatnění u rezervace a veřejný intended voucher flow.
- Obsluha potřebuje z detailu voucheru stáhnout tisknutelný dárkový poukaz bez ukládání PDF do databáze.
- PDF nesmí obsahovat interní poznámky, e-mail kupujícího, historii čerpání ani technická ID.

## Rozhodnutí
- PDF se generuje server-side přes `pdf-lib` v `src/features/vouchers/lib/voucher-pdf.ts`.
- Routy jsou `/admin/vouchery/[voucherId]/pdf` a `/admin/provoz/vouchery/[voucherId]/pdf`.
- Sdílený route handler ověřuje session a roli `OWNER` nebo `SALON` na serveru, načte aktuální voucher read model a vrací `application/pdf` jako attachment.
- QR kód generuje `qrcode` a míří na veřejnou ověřovací URL `/vouchery/overeni?code=...` nad `siteConfig.url`.
- Veřejná ověřovací stránka používá bezpečný voucher read model a nezobrazuje kupujícího, interní poznámku, technická ID ani historii čerpání.
- Česká diakritika je řešená přes `@pdf-lib/fontkit` a Noto Sans z `@fontsource/noto-sans`, ne přes commitovaný font soubor.

## Alternativy
- Puppeteer nebo jiné headless browser řešení: zamítnuto kvůli váze, deploy složitosti a zbytečně širokému runtime povrchu.
- Ukládat PDF do DB nebo souborového úložiště: zamítnuto pro první verzi, protože poukaz má vždy odrážet aktuální data voucheru.
- Použít jen standardní PDF fonty: zamítnuto, protože bezpečně nepokrývají českou diakritiku.

## Důsledky
- PDF se generuje při každém stažení a není cacheované jako persistentní artefakt.
- Úpravy obsahu PDF se drží ve voucher doméně a musí dál respektovat bezpečný veřejný výstup.
- QR URL musí zůstat funkční veřejná route, protože je vytištěná v už stažených PDF.
- Runtime má nové lehké PDF/QR/font závislosti, ale žádný headless browser.

## Stav
- schváleno
