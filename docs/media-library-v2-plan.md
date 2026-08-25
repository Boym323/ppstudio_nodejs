# Media Library v2: implementační plán

Tento dokument je source of truth pro implementaci Media Library v2. Jednotlivé fáze smějí měnit produkční data pouze v rozsahu výslovně definovaném tímto plánem; destruktivní odstranění legacy kontraktu je povoleno až v závěrečné `contract` fázi.

## Datový model

- `MediaAsset` reprezentuje fyzický asset, ne místo jeho použití.
- Singularní použití se řeší explicitními FK v `SiteSettings`.
- Zachovat `voucherPdfLogoMediaId`.
- Přidat `contactPhotoMediaId`, `homePortraitMediaId`, `aboutPortraitMediaId`.
- Galerie řešit přes `MediaCollection` + `MediaCollectionItem`.
- Kolekce: `CERTIFICATES`, `STUDIO_GALLERY`, `REFERENCES`.
- `MediaCollectionItem` má vlastní stav viditelnosti (`isVisible`); viditelnost položky v kolekci není odvozena pouze z `MediaAsset.isPublished`.
- Služby řešit přes `ServiceMedia` s rolemi `HERO` a `GALLERY`.
- Pořadí patří vazbě (`MediaCollectionItem`/`ServiceMedia`), ne `MediaAsset`.
- `altText` na `MediaAsset` je default; relation může mít override.
- `isPublished` není synonymum pro „asset je používán“.
- Relační vazby na `MediaAsset` musí mít databázovou referenční integritu; usage-aware aplikační guard není jedinou ochranou proti smazání používaného assetu.
- `MediaCollectionItem` a `ServiceMedia` používají FK na `MediaAsset` s restriktivním mazáním; použitý asset nelze odstranit kaskádou.
- Singularní FK v `SiteSettings` používají `ON DELETE SET NULL`, ale běžný aplikační delete je i zde nejprve blokován usage-aware guardem.

## Životní cyklus a storage

- Delete musí být usage-aware; používaný asset nesmí fyzicky zmizet.
- Replace musí zachovat stejné `MediaAsset.id`.
- Stávající `storagePath` se nemigrují ani fyzicky nepřesouvají.
- Nové uploady mají používat neutrální strukturu `images/YYYY/MM/...`; význam média nesmí být zakódovaný v cestě (`certificates`, `services`, `references` apod.).
- `MediaAsset.storagePath` je relativní provider-independent cesta; business/runtime kód nesmí pracovat s absolutní cestou `/var/www/ppstudio/uploads`.
- Veškeré čtení, zápis, existence a mazání fyzických médií musí probíhat přes `MediaStorageAdapter`.
- Media Library musí zůstat storage-provider agnostic. Vazby `ServiceMedia`, `MediaCollectionItem` ani `SiteSettings` nesmí záviset na použitém storage provideru.
- Aktuální provider zůstává `LOCAL`; implementace S3/MinIO není součástí Media Library v2.
- Budoucí migrace `LOCAL → S3/MinIO` musí být možná bez změny business vazeb a ideálně se zachováním stejných `storagePath` jako object keys.
- `MediaAsset.isPublished` určuje způsobilost assetu pro veřejné servírování přes public media route; neurčuje existenci ani platnost interních vazeb (např. voucher PDF).
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

`MediaType`, `MediaAssetKind`, globální `MediaAsset.sortOrder` a legacy duplicitní pole se odstraňují až v `contract` fázi, po ověření, že na ně runtime ani administrace nezávisí.

## Migrační pořadí

1. `expand` — přidat nové tabulky, FK a relation modely bez odstranění legacy kontraktu.
2. `backfill` — propsat produkční assety a zachovat stávající `storagePath` i `MediaAsset.id`.
3. `runtime cutover` — přepnout query, routy, publikaci, delete/replace a PDF použití na nové vazby.
4. `admin/UI` — správa kolekcí, pořadí vazeb, singularních rolí a usage-aware akcí; nový upload již používá neutrální `images/YYYY/MM/...`.
5. `nové use cases` — `REFERENCES`, `ServiceMedia(HERO|GALLERY)` a další použití.
6. `contract` — teprve po ověření nulové runtime/admin závislosti odstranit redundantní enumy, globální pořadí a legacy duplicitní pole.
