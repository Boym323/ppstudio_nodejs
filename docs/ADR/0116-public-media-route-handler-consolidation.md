# ADR 0116: Sjednocení handleru veřejných media route

## Kontext

Kanonická route `/media/public/[kind]/[[...path]]` a zpětně kompatibilní `/media/[kind]/[[...path]]` obsahovaly totožný handler. Obě bezpečně hledaly pouze publikovaný `MediaAsset`, ale budoucí oprava validace cesty, databázové filtrace nebo response hlaviček mohla být aplikovaná jen do jedné z nich.

## Rozhodnutí

Bezpečnostně citlivý `GET` handler je jedině v `src/lib/media/public-media-route.ts`. Oba route soubory z něj přímo reexportují tutéž funkci. Databázový dotaz zůstává omezený na `isPublished: true`; URL nemají samostatnou větev pro soukromá média.

## Alternativy

### Zachovat dvě shodné implementace

- nevyžaduje přesun souboru
- zvyšuje riziko, že se bezpečnostní oprava provede jen v jedné URL variantě

### Přesměrovat legacy URL na kanonickou URL

- odstranilo by obsluhu dvou URL v aplikaci
- měnilo by stávající kompatibilitu a cache chování starších odkazů

## Důsledky

- Obě veřejné URL zůstávají kompatibilní a mají shodné statusy i hlavičky.
- Kontrola cesty, publikace a čtení storage existují pouze jednou.
- Regresní test ověřuje, že oba route moduly exportují stejný handler.

## Stav

schváleno
