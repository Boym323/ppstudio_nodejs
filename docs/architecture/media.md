# PP Studio Media Library

## Základní model

`MediaAsset` je centrální záznam souboru a jeho metadat v Media Library.

- `visibility` určuje storage oblast (`PUBLIC` nebo `PRIVATE`).
- `isPublished` určuje, zda je asset dostupný pro veřejné použití.
- `deletionRequestedAt` označuje mazání; běžná i veřejná čtení berou jen `null`.
- Originál používá `storagePath` a `url`; obrazové varianty jsou volitelné
  `optimized*` a `thumbnail*` metadata a cesty.

## Přístup a administrační rozhraní

- Veřejné media routes jsou `/media/public/[kind]/[[...path]]` a kompatibilní
  `/media/[kind]/[[...path]]`; handler vydá jen asset s `PUBLIC`, `isPublished`
  a `deletionRequestedAt = null`, pro originál i varianty.
- Admin preview je `/api/admin/media/[area]/[assetId]/preview`; přijímá jen
  `owner` nebo `salon`, ověřuje oprávnění k sekci `media` a odpovídá s
  `private, no-store`.
- Hlavní knihovna je `/admin/media` (OWNER) a `/admin/provoz/media` (SALON).
- `listMediaPage` filtruje v databázi, řadí `createdAt desc, id asc`, normalizuje
  číslo stránky a standardně vrací 48 assetů na stránku.
- `returnTo` pro media akce smí být pouze relativní URL stejné media route dané
  oblasti, bez hash; zachovává její query kontext a přidá flash. Jinak je fallback
  na základní route knihovny.

## Vazby a veřejné použití

- `getMediaAssetUsageBatch` je společný hromadný usage guard. Vrací vazby ze
  `SiteSettings`, `MediaCollectionItem` a `ServiceMedia` včetně typu zdroje,
  ID záznamu a pole.
- `MediaCollection` má jedinečný typ. `MediaCollectionItem` drží asset,
  pořadí, viditelnost, volitelný alt text a popisek. Aktuální typy kolekcí jsou
  `STUDIO_GALLERY`, `CERTIFICATES` a `REFERENCES`.
- `ServiceMedia` váže asset ke službě v roli `HERO` nebo `GALLERY`; má pořadí a
  volitelný alt text. Vazba assetu je restriktivní při mazání.
- Singularní vazby `SiteSettings` jsou `contactPhotoMediaId`,
  `homePortraitMediaId`, `aboutPortraitMediaId` a `voucherPdfLogoMediaId`;
  při smazání assetu se nastavují na `null`.
- Nová vazba, která se může ukázat na veřejném webu, musí projít
  `isPublicMediaAsset`: asset je `PUBLIC`, publikovaný a není v mazání.

## Mazání a hlavní soubory

- Mazání zamkne asset v DB, ověří usage, nastaví `deletionRequestedAt` a smaže
  záznam v jedné transakci; až potom uklízí originál i varianty z filesystemu.
  Neúspěšný filesystem cleanup nerollbackuje databázové smazání.
- Modely: `prisma/schema.prisma`.
- Knihovna, stránkování a mazání: `src/features/media/lib/media-library.ts`;
  repository a usage: `media-asset-repository.ts`, `media-asset-usage.ts`.
- Veřejná pravidla a collections: `public-media-asset.ts`,
  `src/features/media/lib/reference-collection.ts`,
  `src/features/public/lib/public-media-relations.ts` a `public-services.ts`.
- Admin UI a akce: `src/features/admin/components/admin-media-page.tsx`,
  `src/features/admin/actions/media-actions.ts` a `service-media-actions.ts`.
- HTTP handlery: `src/lib/media/public-media-route.ts` a
  `src/features/admin/lib/admin-media-preview-route-api.ts`.
