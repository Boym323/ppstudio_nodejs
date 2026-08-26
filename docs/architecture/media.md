# PP Studio Media Library

Stručný kontext aktuální implementace Media Library.

## Model

- `MediaAsset` je centrální záznam souboru, metadat a uložených variant.
- `visibility` je `PUBLIC` nebo `PRIVATE` a určuje oblast storage.
- `isPublished` určuje, zda může být asset vydán přes veřejný media access.
- `deletionRequestedAt` je stavová značka mazání; aktivní assety mají hodnotu
  `null`.
- Originál je reprezentovaný poli `storagePath`/`url` a jeho metadata.
- Volitelné varianty jsou `optimized` a `thumbnail`, každá se storage cestou,
  URL, MIME typem, rozměry a velikostí.

## Access

- Veřejný access obsluhují `/media/public/[kind]/[[...path]]` a kompatibilní
  alias `/media/[kind]/[[...path]]`.
- Veřejný handler vydá pouze asset s `PUBLIC`, `isPublished: true` a
  `deletionRequestedAt: null`; stejná podmínka platí pro originál i varianty.
- Unpublished asset nemá veřejnou URL. Autorizovaný admin jej může previewovat
  přes `/api/admin/media/[area]/[assetId]/preview`.
- Admin preview vyžaduje přístup k media sekci a používá `owner` nebo `salon`.
  Odpověď je privátní a bez uložení do cache.
- Hlavní admin entry pointy jsou `/admin/media` pro OWNER a
  `/admin/provoz/media` pro SALON.

## Library

- `AdminMediaPage` načítá knihovnu server-side přes `listMediaPage`.
- Stránkování probíhá v databázi; výchozí velikost stránky je 48 a řazení je
  `createdAt desc, id asc`.
- Hledání je case-insensitive přes titulek, název souboru, původní název a
  alt text.
- Filtry rozlišují všechna, použitá a nepoužitá média a také kolekci.
- Filtry Studio a Certifikáty otevírají správu celé dané kolekce nezávisle na ostatních filtrech knihovny; grid se v tomto pohledu nezobrazuje duplicitně.
- Usage se zjišťuje hromadně přes `getMediaAssetUsageBatch`.
- `returnTo` zachovává aktuální media route, query kontext a po akci přidává
  flash zprávu; neplatná hodnota vede na základní route dané oblasti.
- `MediaUploadDialog` je pouze UI formulář nad existující serverovou upload
  pipeline (`uploadMediaAction` → `createMedia` → validace, zpracování a zápis).

## Relations

- `MediaCollection` má právě jeden typ z množiny `STUDIO_GALLERY`,
  `CERTIFICATES` a `REFERENCES`.
- `MediaCollectionItem` drží vazbu assetu, pořadí, viditelnost, alt text a
  caption.
- `ServiceMedia` váže asset ke službě v roli `HERO` nebo `GALLERY`, s pořadím
  a volitelným alt textem.
- `SiteSettings` je singulární záznam s vazbami:
  `contactPhotoMediaId`, `homePortraitMediaId`, `aboutPortraitMediaId` a
  `voucherPdfLogoMediaId`.

## Rules

- Nová relation použitelná na veřejném webu vyžaduje `PUBLIC`, publikovaný asset
  a `deletionRequestedAt: null`.
- Serverová validace je autoritativní; UI výběr sám o sobě vazbu nepotvrzuje.
- Použité médium nelze smazat. Usage guard zahrnuje SiteSettings, kolekce a
  ServiceMedia.
- Unpublish použitého média vyžaduje UX confirmation, protože může zmizet z webu.
- Mazání provede DB commit nejdříve a filesystem cleanup až následně.
- Neúspěšný filesystem cleanup po DB smazání nevrací databázovou změnu.

## Main files

- Schéma: `prisma/schema.prisma` (`MediaAsset`, kolekce, `ServiceMedia`,
  `SiteSettings`).
- Core library a upload pipeline: `src/features/media/lib/media-library.ts`.
- Repository a usage: `src/features/media/lib/media-asset-repository.ts` a
  `src/features/media/lib/media-asset-usage.ts`.
- Veřejná pravidla a access: `src/features/media/lib/public-media-asset.ts`,
  `src/lib/media/public-media-route.ts`.
- Admin stránka, akce a dialogy: `src/features/admin/components/admin-media-page.tsx`,
  `src/features/admin/actions/media-actions.ts`, `src/features/admin/components/media-asset-detail-dialog.tsx`
  a `src/features/admin/components/media-upload-dialog.tsx`.
