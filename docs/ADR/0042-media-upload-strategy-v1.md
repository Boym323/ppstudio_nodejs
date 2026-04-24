# ADR 0042: Media Upload Strategy v1

## Kontext
Media Library už měla základní lokální storage a image varianty, ale naming, URL a vazba publish stavu na filesystem nebyly dostatečně sjednocené pro dlouhodobý růst projektu.

Potřebujeme strategii, která:
- drží jednoduchý lokální filesystem bez redesignu Media Library
- nevyužívá původní názvy uploadovaných souborů jako součást finálních cest
- dává stabilní URL nezávislé na publish/unpublish
- zachová kompatibilitu se staršími médii bez fyzické migrace souborů
- nechá prostor pro budoucí další varianty a případné S3/CDN napojení

## Rozhodnutí
Pro nové uploady používáme jednotnou strukturu:

- root `MEDIA_STORAGE_ROOT=/var/www/ppstudio/uploads`
- fyzická cesta `<root>/public/{type}/YYYY/MM/{assetId}-{variant}.{ext}`
- typové větve `certificates`, `spaces`, `portraits`, `general`
- varianty `original`, `optimized`, `thumbnail`

Naming nepoužívá původní název souboru. Každý asset dostane krátký generovaný identifikátor a podle něj vzniknou názvy:

- `{assetId}-original.<ext>`
- `{assetId}-optimized.<ext>`
- `{assetId}-thumbnail.<ext>`

Kanonická veřejná URL pro nové uploady je:

- `/media/public/{type}/YYYY/MM/{assetId}-{variant}.{ext}`

Publish stav je čistě databázový přes `MediaAsset.isPublished`. Nové uploady se nepřesouvají mezi `public/private`; při publish/unpublish se nemění storage path ani URL.

Upload pipeline pro JPEG/PNG/WebP:

1. validace MIME typu, přípony a limitu
2. uložení originálu po `sharp.rotate()` kvůli EXIF normalizaci
3. vytvoření `optimized` varianty s max šířkou 1920 px
4. vytvoření `thumbnail` varianty s cílovou šířkou kolem 400 px
5. zápis URL a variantových metadat do `MediaAsset`

Fallback pro starší média:

- pokud chybí `optimizedUrl`, veřejný web použije `url`
- pokud chybí `thumbnailUrl`, admin použije `optimizedUrl` nebo `url`
- legacy route `/media/[kind]/[[...path]]` zůstává zachovaná

## Alternativy
### Zachovat naming z původních jmen
- je čitelnější pro člověka
- ale dlouhodobě zvyšuje riziko nekonzistence, kolizí a problematických znaků

### Řídit public/private přes přesuny souborů
- vypadá čistě na úrovni filesystemu
- ale komplikuje publish/unpublish, rozbíjí stabilitu URL a zbytečně váže business stav na storage

### Přidat hned responsive sizes, AVIF a CDN
- dává smysl později
- pro aktuální scope by šlo o předčasné rozšíření a vyšší provozní složitost

## Důsledky
- Nové uploady mají předvídatelnou a neměnnou storage strukturu.
- `MediaAsset` metadata odpovídají skutečně uloženému originálu i variantám.
- Starší média bez variant a starší URL dál fungují bez migrace souborů.
- Budoucí rozšíření může přidat další varianty nebo jiný storage backend nad stejným asset key a DB modelem.

## Stav
schváleno
