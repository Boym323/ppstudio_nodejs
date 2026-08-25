# Media Library v2: implementační plán

Tento dokument je source of truth pro budoucí implementaci. Neprovádí migraci ani nepovoluje změny produkčních dat před dokončením všech fází.

## Datový model

- `MediaAsset` reprezentuje fyzický asset, ne místo jeho použití.
- Stávající `storagePath` se nemigrují ani nepřesouvají.
- Singularní použití se řeší explicitními FK v `SiteSettings`.
- Zachovat `voucherPdfLogoMediaId`.
- Přidat `contactPhotoMediaId`, `homePortraitMediaId`, `aboutPortraitMediaId`.
- Galerie řešit přes `MediaCollection` + `MediaCollectionItem`.
- Kolekce: `CERTIFICATES`, `STUDIO_GALLERY`, `REFERENCES`.
- Služby řešit přes `ServiceMedia` s rolemi `HERO` a `GALLERY`.
- Pořadí patří vazbě (`MediaCollectionItem`/`ServiceMedia`), ne `MediaAsset`.
- `altText` na `MediaAsset` je default; relation může mít override.
- `isPublished` není synonymum pro „asset je používán“.

## Životní cyklus a storage

- Delete musí být usage-aware; používaný asset nesmí fyzicky zmizet.
- Replace musí zachovat stejné `MediaAsset.id`.
- Nové uploady mají později používat neutrální storage strukturu.
- Šest potvrzených orphan souborů se v relační migraci nemaže.

## Produkční backfill

- `CERTIFICATE` → `CERTIFICATES`, kromě voucher loga.
- `SALON_PHOTO` → `STUDIO_GALLERY`.
- `CONTACT_PHOTO` → `SiteSettings.contactPhotoMediaId`.
- `PORTRAIT_HOME` → `SiteSettings.homePortraitMediaId`.
- `PORTRAIT_ABOUT` → `SiteSettings.aboutPortraitMediaId`.
- Asset `cmoqt8k10000aarlcr95bt36c` zůstává voucher logo a nejde do `CERTIFICATES`.
- Asset `cmoq71a3v0001arlc1c5i3woh` se zařadí do `STUDIO_GALLERY` jako skrytý/neaktivní člen.

Deterministické singularní vazby:

| role | asset |
|---|---|
| voucher PDF logo | `cmoqt8k10000aarlcr95bt36c` |
| kontaktní foto | `cmoq703640000arlcaaf7v5bx` |
| homepage portrét | `cmonaquhg000dnni1vguglowq` |
| portrét O mně | `cmod7yatk0000pvo44myd7zjp` |

## Odstranění legacy kontraktu

`MediaType`, `MediaAssetKind`, globální `MediaAsset.sortOrder` a legacy duplicitní pole se odstraňují až v contract fázi, po ověření, že na ně runtime ani administrace nezávisí.

## Migrační pořadí

1. `expand` — přidat nové tabulky, FK a relation modely bez odstranění legacy kontraktu.
2. `backfill` — propsat produkční assety a zachovat stávající `storagePath` i `MediaAsset.id`.
3. `runtime cutover` — přepnout query, routy, publikaci, delete/replace a PDF použití na nové vazby.
4. `admin/UI` — správa kolekcí, pořadí vazeb, singularních rolí a usage-aware akcí.
5. `nové use cases` — `REFERENCES`, `ServiceMedia(HERO|GALLERY)` a další použití.
6. `contract` — teprve nyní odstranit redundantní enumy, globální pořadí a legacy duplicitní pole.
