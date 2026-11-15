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
- `focalPointX` a `focalPointY` (0–100, výchozí 50/50) určují ohnisko pro
  responzivní ořez; administrace je nastavuje na detailu média a veřejné
  obrázky ho používají přes `object-position`.
- Veřejné karty, portréty, kontakt a studio používají výřez přes `object-fit: cover`
  s uloženým ohniskem; výchozí 50/50 zachovává dosavadní středový ořez;
  originální soubor ani uložené varianty se tím nemění.
- Detail média v administraci umožňuje přepínat orientační náhledy poměrů
  používaných na webu a předvolí poměr podle aktuálního použití. Proměnlivé
  poměry portrétů a studia závisí na šířce obrazovky; certifikáty se neořezávají.

## Access

- Veřejný access obsluhují `/media/public/[kind]/[[...path]]` a kompatibilní
  alias `/media/[kind]/[[...path]]`.
- Veřejný handler vydá pouze asset s `PUBLIC`, `isPublished: true` a
  `deletionRequestedAt: null`; stejná podmínka platí pro originál i varianty.
- Veřejné soubory vracejí `public, max-age=0, must-revalidate` a Next Image
  má `minimumCacheTTL: 0`. Proxy před `/_next/image` znovu ověřuje veřejnou
  dostupnost lokálních médií, takže ani stará optimalizační cache nevydá
  zneveřejněný asset. Statické obrázky mimo `/media/` kontrolu nevyžadují.
- Veřejné mapování přidává `media-cache=2`, aby nové stránky obešly dříve
  vydané roční cache; uložené URL ani soubory se nemění. Dříve stažené kopie
  ve starých prohlížečích nelze zpětně odvolat. Kontrola v proxy přidává
  jeden DB dotaz na požadavek optimalizovaného média.
- Studio a kontakt při nedostupné optimalizované variantě použijí URL
  i rozměry existujícího originálu; chybějící soubory se vynechají.
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
- Knihovna nabízí seznam nebo mřížku, stránkované hledání podle metadat, názvu služby a názvů umístění, filtry použití, publikace, konkrétního umístění a chybějícího názvu a řazení podle data, názvu nebo velikosti. Hromadné publikování je idempotentní; hromadné mazání zachovává usage guard každého média.
- Pohled „Umístění na webu“ odděluje přiřazení fotografií stránek a služeb od správy souborů. U médií přehled i detail ukazují skutečné vazby s přímým odkazem na jejich správu. Publikace a viditelnost zařazení jsou samostatné stavy.
- Filtry rozlišují všechna, použitá a nepoužitá média a také kolekci.
- Přehled `collection=SERVICE_MEDIA` odkazuje přímo na samostatnou správu
  fotografií služby přes `view=photos&serviceId=…` v příslušné admin oblasti.
  Tento pohled má návrat do přehledu a zachovává se i po uploadu.
- Filtry Studio a Certifikáty otevírají správu celé dané kolekce nezávisle na ostatních filtrech knihovny; grid se v tomto pohledu nezobrazuje duplicitně.
- Usage se zjišťuje hromadně přes `getMediaAssetUsageBatch`.
- `returnTo` zachovává aktuální media route, query kontext a po akci přidává
  flash zprávu; u správy Studio a Certifikátů používá pouze kanonický collection
  kontext. Neplatná hodnota vede na základní route dané oblasti.
- Správa Studio a Certifikátů má vlastní kanonickou URL `collection=<typ>`;
  knihovní parametry `q`, `usage`, `publication` a `page` se z ní odstraňují,
  přičemž `flash` po serverové akci zůstává zachovaný.
- `MediaUploadDialog` umožňuje při hromadném uploadu vlastní název a alt text pro každý soubor; výchozí název se odvodí z názvu souboru. Z konkrétní kolekce lze publikovaný asset při vytvoření atomicky zařadit na konec kolekce; nezaškrtnutý upload zůstává dohledatelný jako neveřejný soubor.
- `MediaUploadDialog` je pouze UI formulář nad existující serverovou upload
  pipeline (`uploadMediaAction` → `createMedia` → validace, zpracování a zápis).
- Nové admin uploady jsou ve výchozím stavu neveřejné (`isPublished=false`) a
  publikace je samostatný vědomý krok. Knihovna podporuje více souborů v jednom
  formuláři, souhrn částečných selhání a HEIC/HEIF převod do JPEG variant při
  dostupném dekodéru Sharp.

## Admin picker

- `MediaPicker` nenačítá kandidáty v parent page loaderu. Po otevření dialogu
  volá jednu autorizovanou server action nad společným picker query.
- Query vrací po 24 položkách, řadí `createdAt desc, id asc` a hledá
  case-insensitive přes titulek, uložený i původní název souboru a alt text.
- Kandidáty omezuje sdílený public eligibility filtr a validovaný scope
  `GENERAL`, `COLLECTION`, `REFERENCES` nebo `SERVICE_GALLERY`; exclusions pro
  kolekce, reference a galerii služby odvozuje přímo z databázových relations.
- Každé načtení používá dva konstantní DB dotazy (`count` a stránkovaný
  `findMany`), bez per-asset validace a bez N+1. Uložené singularní vazby v
  Settings se pro prvotní render načtou jedním batch `id IN (...)` dotazem.
- Klient hledání debouncuje, ignoruje zastaralé odpovědi a drží summary právě
  vybraného assetu nezávisle na aktuální stránce výsledků.

## Relations

- `MediaCollection` má právě jeden typ z množiny `STUDIO_GALLERY`,
  `CERTIFICATES` a `REFERENCES`.
- `MediaCollectionItem` drží vazbu assetu, pořadí, viditelnost, alt text a
  caption.
- `ServiceMedia` váže asset ke službě v roli `HERO` nebo `GALLERY`, s pořadím
  a volitelným alt textem.
- `SiteSettings` je singulární záznam s vazbami:
  `contactPhotoMediaId`, `homePortraitMediaId`, `aboutPortraitMediaId` a
  `voucherPdfLogoMediaId`. Poslední vazba je legacy kompatibilita; aktuální
  voucherové PDF ani admin UI ji nepoužívají.

## Rules

- Nová relation použitelná na veřejném webu vyžaduje `PUBLIC`, publikovaný asset
  a `deletionRequestedAt: null`.
- Serverová validace je autoritativní; UI výběr sám o sobě vazbu nepotvrzuje.
- Použité médium nelze smazat. Usage guard zahrnuje SiteSettings, kolekce a
  ServiceMedia; legacy reference voucherového loga se kvůli bezpečnosti mazání
  stále eviduje, i když už není součástí aktuálního renderingu.
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
- Přehled fotografického pokrytí služeb: `src/features/admin/components/service-media-overview.tsx`;
  přímý upload z detailu služby používá `uploadServiceMediaAction`.
