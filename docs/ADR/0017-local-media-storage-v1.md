# 0017 Local Media Storage V1

## Kontext
Projekt dosud pracoval jen se statickými assety v `public/brand` a neměl žádný jednotný základ pro uploady z adminu. Nové požadavky zahrnují certifikáty, fotky prostor, referenční fotky klientek a další obsahové obrázky. Binární data nechceme ukládat do PostgreSQL a zatím nechceme zavádět S3 ani jiný cloud storage.

Zároveň potřebujeme řešení, které:
- drží metadata v databázi
- ukládá soubory mimo repo a mimo build artefakty
- je použitelné z owner i salon adminu bez duplicitní implementace
- nepřiváže business logiku na konkrétní filesystem detaily

## Rozhodnutí
Zavádíme sdílenou media storage vrstvu se třemi oddělenými částmi:

1. Filesystem adapter v `src/lib/media/*`
- lokální storage root je mimo repo a konfiguruje se přes `MEDIA_STORAGE_ROOT`
- pokud proměnná chybí, výchozí cesta je `../ppstudio-uploads` relativně k projektu
- veřejná a neveřejná média se fyzicky oddělují do `public/` a `private/`
- storage root má navíc připravený `temp/` prostor pro budoucí drafty nebo přechodné uploady
- soubory se ukládají pod logické doménové složky `certificates/`, `spaces/`, `references/`, `content/`
- finální relativní cesta má tvar `kind/YYYY/MM/safe-randomized-filename.ext`

2. Metadata model `MediaAsset` v Prisma
- metadata jsou v tabulce `MediaAsset`
- používáme enumy `MediaAssetKind`, `MediaAssetVisibility` a `MediaStorageProvider`
- ukládáme jen metadata a storage path, ne binární obsah
- budoucí moduly budou odkazovat na `MediaAsset.id` namísto opětovného vymýšlení upload schématu

3. Veřejné servírování přes App Router route handler
- veřejné soubory nejdou přímo z `public/` repozitáře
- route `/media/[kind]/...` validuje cestu, ověří existenci veřejného `MediaAsset` záznamu a až potom načte lokální soubor
- tím nezabetonujeme URL na náhodné projektové cesty a necháváme si prostor pro budoucí private media flow

## Alternativy
### Ukládat vše do `public/uploads`
- jednoduché, ale nevhodné pro deploy a build artefakty
- hrozí přepsání při release nebo nejasná zodpovědnost za zálohy
- chybí rozlišení public/private a audit nad metadaty

### Ukládat binární data přímo do PostgreSQL
- jednodušší z pohledu jediné persistence vrstvy
- zbytečně nafukuje databázi, zálohy i přenosy
- není to vhodný základ pro galerie a větší obrázky

### Rovnou přejít na S3-compatible storage
- dává smysl později
- pro aktuální self-hosted scope by šlo o předčasnou infrastrukturní složitost

## Důsledky
- Deploy a backup checklist musí nově počítat s adresářem uploadů a jeho právy.
- Veřejný web dostává stabilní URL vrstvu `/media/*`, která není vázaná na fyzické umístění souborů.
- Budoucí admin moduly budou používat shared feature service místo přímé práce s `fs`.
- Private média ještě nemají hotovou veřejnou autorizovanou distribuci, ale fyzické i datové oddělení pro ni už existuje.

## Stav
schváleno
