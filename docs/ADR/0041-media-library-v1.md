# ADR 0041: Media Library v1

## Stav
Přijato 2026-04-24.

## Kontext
Admin sekce `Certifikáty` byla první produkční vrstva nad lokálním media storage. Potřebujeme ji rozšířit na jednoduchou správu obrázků pro celý web bez budování komplexního CMS, složek, tagů, CDN nebo drag-and-drop pořadí.

## Rozhodnutí
Zachováme existující model `MediaAsset`, ale zobecníme jeho aplikační API přes nový enum `MediaType`:

- `CERTIFICATE`
- `SALON_PHOTO`
- `PORTRAIT`
- `GENERAL`

Do modelu přidáváme nová obecná pole `fileName`, `url`, `size`, `altText`, `sortOrder` a `isPublished`. Legacy storage pole (`kind`, `visibility`, `originalFilename`, `sizeBytes`, `alt`, `storagePath`) zatím nemažeme, protože zajišťují bezpečné mapování existujících souborů a nedestruktivní migraci.

Admin UI se jmenuje `Média webu`, ale ponechává kompatibilní routy `/admin/certifikaty` a `/admin/provoz/certifikaty`. Certifikáty jsou pouze jeden typ média a veřejná stránka `/o-mne` smí číst jen `MediaType.CERTIFICATE` s `isPublished = true`.

## Důsledky
- Existující certifikáty se při migraci zpětně mapují na `type = CERTIFICATE`, `isPublished = true` pro původní veřejné záznamy a zachovanou URL `/media/certificates/...`.
- Nové služby `createMedia`, `listMedia`, `updateMedia` a `deleteMedia` jsou kanonické API pro admin media workflow.
- UI je jednoduché: upload, filtr typů, grid karet, editace titulku, alt textu, typu a publish/unpublish.
- Budoucí rozšíření má přidávat nové typy přes enum a prezentační read modely, ne přes další izolované certifikátové moduly.

## Bezpečný postup migrace
1. Přidat nový enum a obecná pole bez mazání legacy sloupců.
2. Backfillnout existující záznamy z `kind`, `visibility`, `originalFilename`, `sizeBytes`, `alt` a `storagePath`.
3. Přepnout admin UI a služby na `MediaType` a `isPublished`.
4. Ověřit `/o-mne`, že načítá pouze publikované certifikáty.
