# Media Library v2: produkční audit

Stručný read-only audit produkce PP Studio, provedený 25. 8. 2026. Neobsahuje credentials, secrets ani binární data.

## Production identity

- Hostname: `lo-prod-web-ppstudio`
- Release: `e645881a17be-20260825132011`
- Git commit: `e645881a17be13b0072b8b87db2c355673d94f11`
- `NODE_ENV`: `production`
- Databáze: `ppstudio`
- `MEDIA_STORAGE_ROOT`: `/var/www/ppstudio/uploads`

## MediaAsset v DB

- Celkem 16 assetů; všechny `storageProvider=LOCAL`, `visibility=PUBLIC`.
- 14 publikovaných, 2 skryté, 0 pending deletion.
- MIME: 15× `image/jpeg`, 1× `image/png`.
- Všech 16 assetů má originál, optimized i thumbnail variantu: 48 očekávaných fyzických souborů.

Agregace:

| type | kind | published | počet |
|---|---|---:|---:|
| `CERTIFICATE` | `CERTIFICATE` | false | 1 |
| `CERTIFICATE` | `CERTIFICATE` | true | 6 |
| `SALON_PHOTO` | `SPACE` | false | 1 |
| `SALON_PHOTO` | `SPACE` | true | 5 |
| `PORTRAIT_HOME` | `CONTENT` | true | 1 |
| `PORTRAIT_ABOUT` | `CONTENT` | true | 1 |
| `CONTACT_PHOTO` | `SPACE` | true | 1 |

Produkční ID potřebná pro backfill:

| ID | type | stav / význam |
|---|---|---|
| `cmod3lrnu0002h1o41urgylvb` | `CERTIFICATE` | certifikát, publikovaný |
| `cmod6tg1y0000c9o4kx5tzsm7` | `CERTIFICATE` | certifikát, publikovaný |
| `cmod6tpyx0001c9o48apynqz6` | `CERTIFICATE` | certifikát, publikovaný |
| `cmod6u2050002c9o4ntksx58s` | `CERTIFICATE` | certifikát, publikovaný |
| `cmod6ua2e0003c9o4dyf8pd0a` | `CERTIFICATE` | certifikát, publikovaný |
| `cmsezuytz0001n9l15pwcjoca` | `CERTIFICATE` | certifikát, publikovaný |
| `cmoqt8k10000aarlcr95bt36c` | `CERTIFICATE` | voucher PDF logo, skryté |
| `cmoq71a3v0001arlc1c5i3woh` | `SALON_PHOTO` | skryté, `sortOrder=1` |
| `cmoq73bfe0002arlcgop25wj8` | `SALON_PHOTO` | publikované, `sortOrder=8` |
| `cmoq74d4u0003arlcvwppnkwm` | `SALON_PHOTO` | publikované, `sortOrder=11` |
| `cmoq75gfv0004arlcl2pfvitq` | `SALON_PHOTO` | publikované, `sortOrder=5` |
| `cmoq76gbq0005arlcwc6vdy1r` | `SALON_PHOTO` | publikované, `sortOrder=15` |
| `cmp9x85w4000cm0l1cda89s3k` | `SALON_PHOTO` | publikované, `sortOrder=1` |
| `cmoq703640000arlcaaf7v5bx` | `CONTACT_PHOTO` | primární kontaktní foto |
| `cmonaquhg000dnni1vguglowq` | `PORTRAIT_HOME` | primární homepage portrét |
| `cmod7yatk0000pvo44myd7zjp` | `PORTRAIT_ABOUT` | primární portrét O mně |

## Skutečné DB vazby

PostgreSQL katalogy nalezly jedinou FK na `MediaAsset`:

`SiteSettings.voucherPdfLogoMediaId → MediaAsset.id`, `ON DELETE SET NULL`, 1 nenulová vazba:
`site-settings → cmoqt8k10000aarlcr95bt36c`.

Všechna media-related pole `SiteSettings`: pouze `voucherPdfLogoMediaId`.

## Enumy a legacy konzistence

`MediaType`: `CERTIFICATE=7`, `SALON_PHOTO=6`, `PORTRAIT=0`, `GENERAL=0`, `PORTRAIT_HOME=1`, `PORTRAIT_ABOUT=1`, `CONTACT_PHOTO=1`.

`MediaAssetKind`: `CERTIFICATE=7`, `SPACE=7`, `REFERENCE=0`, `CONTENT=2`.

Ověření:

- `alt` vs `altText`: 0 mismatchů.
- `sizeBytes` vs `size`: 0 mismatchů.
- `fileName` vs `storedFilename`: 0 mismatchů.
- originální, optimized i thumbnail URL jsou všechny kanonické `/media/public/...`; legacy `/media/...` výskyt: 0.
- duplicity `storagePath`: 0; duplicity URL napříč všemi variantami: 0.
- NULL jsou pouze očekávaná volitelná metadata (`title`, alt text, `sortOrder`, deletion timestamp).
- `MediaAssetKind` je u všech řádků odvoditelný z `MediaType`; nenese samostatný význam.

## Filesystem audit

- Skutečné regulární soubory pod rootem: 54.
- Missing DB varianty: 0/48.
- Orphan soubory: 6, celkem 505 517 B.
- Celková velikost storage: 16 869 487 B.
- Symlinky: 0.

Rozdělení podle adresáře:

| adresář | soubory | bytes |
|---|---:|---:|
| `public/certificates` | 24 | 8 318 286 |
| `public/contact` | 6 | 769 014 |
| `public/general` | 3 | 121 010 |
| `public/portraits` | 3 | 500 747 |
| `public/portraits-about` | 3 | 1 229 247 |
| `public/spaces` | 15 | 5 931 183 |

Orphan trojice, potvrzené SHA-256 jako kopie existujících assetů:

- `public/contact/2026/05/78ec00a8330b-{original,optimized,thumbnail}.jpg` je binární kopie trojice `4080155bd39d-*` assetu `cmoq703640000arlcaaf7v5bx`.
- `public/general/2026/04/69f85668ed8b-{original,optimized,thumbnail}.png` je binární kopie trojice `d55ca5e04e32-*` assetu `cmoqt8k10000aarlcr95bt36c`.
- Reprezentativní SHA: contact original `5047443f...`, optimized `0119c2d4...`, thumbnail `5687de1d...`; general original/optimized `201711b7...`, thumbnail `d6c57055...`.

Odchylky typu vůči aktuálnímu adresářovému mapování:

- `cmonaquhg000dnni1vguglowq` (`PORTRAIT_HOME`) používá legacy `portraits/...` místo nového `portraits-home/...`.
- `cmoq73bfe0002arlcgop25wj8` (`SALON_PHOTO`) používá `certificates/...` místo `spaces/...`.

Cesty fungují podle uloženého `storagePath`; při migraci se nemají přesouvat.

## Runtime závislosti

- `src/features/media/lib/media-asset-repository.ts` → Prisma query/CRUD, filtry `MediaType`, `isPublished`, `deletionRequestedAt`, řazení `sortOrder`.
- `src/features/media/lib/media-library.ts` → upload, varianty, replace/delete, zápis legacy polí a `MediaAssetKind`.
- `src/features/admin/actions/media-actions.ts`, `admin-media-page.tsx` → admin upload/edit/publish/sort/delete.
- `src/features/public/lib/public-certificates.ts` → publikované certifikáty.
- `src/features/public/lib/public-media.ts` → homepage/O mně portréty.
- `src/features/public/lib/public-studio-photos.ts` → salon galerie a kontaktní foto.
- `src/lib/media/public-media-route.ts`, `src/lib/media/media-route.ts` → kanonická i legacy media route.
- `src/features/admin/actions/settings-actions.ts` → validace a zápis `voucherPdfLogoMediaId`.
- `src/features/vouchers/lib/voucher-pdf-core.ts`, `voucher-print-a4-pdf-core.ts` → načtení media loga do voucher PDF.
- `src/lib/email/templates.ts` → voucher PDF jako e-mailová příloha.

## Deterministická migrační mapa

- `CERTIFICATE` → kolekce `CERTIFICATES`, kromě `cmoqt8k10000aarlcr95bt36c`.
- `SALON_PHOTO` → `STUDIO_GALLERY`.
- `CONTACT_PHOTO` → `SiteSettings.contactPhotoMediaId` = `cmoq703640000arlcaaf7v5bx`.
- `PORTRAIT_HOME` → `SiteSettings.homePortraitMediaId` = `cmonaquhg000dnni1vguglowq`.
- `PORTRAIT_ABOUT` → `SiteSettings.aboutPortraitMediaId` = `cmod7yatk0000pvo44myd7zjp`.
- `cmoqt8k10000aarlcr95bt36c` zůstává `SiteSettings.voucherPdfLogoMediaId`; nepatří do `CERTIFICATES`.
- `cmoq71a3v0001arlc1c5i3woh` patří do `STUDIO_GALLERY` jako skrytý/neaktivní člen.

## Závěr

Migrace může být datově deterministická bez ztráty významu, pokud se zachová explicitní role voucher loga, singularních portrétů/kontaktní fotografie a skrytý salon asset. Všech 48 DB variant je dostupných.

Nelze nyní bezpečně odstranit `MediaType`, globální `MediaAsset.sortOrder` ani legacy duplicitní pole, protože je používá runtime. `MediaAssetKind` je redundantní, ale odstranit jej lze až po úpravě kontraktu uploadu a runtime. Orphan soubory se v relační migraci nemažou.
