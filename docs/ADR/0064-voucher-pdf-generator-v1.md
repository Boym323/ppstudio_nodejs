# ADR 0064: Voucher PDF generator v1

## Kontext
- Admin evidence voucherů už umí vytvoření, detail, uplatnění u rezervace a veřejný intended voucher flow.
- Obsluha potřebuje z detailu voucheru stáhnout tisknutelný dárkový poukaz bez ukládání PDF do databáze.
- PDF nesmí obsahovat interní poznámky, e-mail kupujícího, historii čerpání ani technická ID.

## Rozhodnutí
- PDF se generuje server-side přes `pdf-lib` v worker-safe `src/features/vouchers/lib/voucher-pdf-core.ts`; `src/features/vouchers/lib/voucher-pdf.ts` zůstává jako Next.js wrapper se `import "server-only"`.
- Routy jsou `/admin/vouchery/[voucherId]/pdf` a `/admin/provoz/vouchery/[voucherId]/pdf`.
- Sdílený route handler ověřuje session a roli `OWNER` nebo `SALON` na serveru, načte aktuální voucher read model a vrací `application/pdf` jako attachment.
- QR kód generuje `qrcode` a míří na veřejnou ověřovací URL `/vouchery/overeni?code=...` nad `siteConfig.url`.
- Veřejná ověřovací stránka používá bezpečný voucher read model a nezobrazuje kupujícího, interní poznámku, technická ID ani historii čerpání.
- Česká diakritika je řešená přes `@pdf-lib/fontkit` a Noto Sans z `@fontsource/noto-sans`, ne přes commitovaný font soubor.
- Logo pro PDF voucher je samostatná nullable reference `SiteSettings.voucherPdfLogoMediaId -> MediaAsset.id`. Spravuje se přes existující Média webu a výběr v `/admin/nastaveni`, nezávisle na logu webového layoutu.
- Generátor smí načítat pouze lokální soubory z `MediaAsset.storagePath` / `optimizedStoragePath` přes existující media storage. PNG/JPEG se vloží do PDF, nepodporovaný nebo chybějící soubor spadne na textové logo `PP Studio`.
- Kontakty ve spodní části PDF se berou ze `SiteSettings`; adresa se skládá přes `getSalonAddressLine(...)` a web z `siteConfig.url`.

## Alternativy
- Puppeteer nebo jiné headless browser řešení: zamítnuto kvůli váze, deploy složitosti a zbytečně širokému runtime povrchu.
- Ukládat PDF do DB nebo souborového úložiště: zamítnuto pro první verzi, protože poukaz má vždy odrážet aktuální data voucheru.
- Použít jen standardní PDF fonty: zamítnuto, protože bezpečně nepokrývají českou diakritiku.
- Zavést samostatné upload/storage workflow pro voucher logo: zamítnuto, protože `MediaAsset` už řeší metadata, lokální soubor i admin správu médií.

## Důsledky
- PDF se generuje při každém stažení a není cacheované jako persistentní artefakt.
- Úpravy obsahu PDF se drží ve voucher doméně a musí dál respektovat bezpečný veřejný výstup.
- Mazání nebo chybějící soubor vybraného média nesmí shodit generování PDF; fallback textové logo je součástí kontraktu.
- QR URL musí zůstat funkční veřejná route, protože je vytištěná v už stažených PDF.
- Runtime má nové lehké PDF/QR/font závislosti, ale žádný headless browser.
- Standalone skripty a worker procesy musí používat `voucher-pdf-core.ts`; wrapper s `server-only` patří jen do Next.js runtime.

## Stav
- schváleno
