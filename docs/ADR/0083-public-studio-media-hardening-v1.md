# ADR 0083: Public Studio Media Hardening V1

- Datum: 2026-05-03
- Stav: Accepted

## Kontext
- Stránka `/studio` je vizuálně závislá na fotkách studia z modulu `Média webu`.
- V praxi se objevily případy, kdy `MediaAsset` záznam zůstal publikovaný, ale fyzický soubor už ve storage chyběl.
- Výsledek na webu byl broken image placeholder, což snižuje důvěru i kvalitu první návštěvy.

## Rozhodnutí
- Veřejný read model `getPublicStudioPhotos()` vrací jen publikované `MediaType.SALON_PHOTO` assety, u kterých existuje soubor (`optimizedStoragePath` nebo `storagePath`) ve storage.
- `/studio` používá první dostupný asset jako hero a další dostupné assety jako galerii (max 6).
- Galerie začíná až za hero fotkou a má responzivní layout pro 1-6 navazujících fotek, aby se hero záběr neduplikoval a stránka nepůsobila prázdně při menším počtu médií.
- Obsahové fotky studia používají alt text z `MediaAsset.altText`; při chybějícím alt textu se použije fallback `Fotografie prostoru PP Studio`.
- Pokud dostupná galerie data chybí, sekce galerie se skryje místo renderu rozbitého obrázku.
- Dev fallback je povolen jen pro `NODE_ENV=development` z `public/dev/studio/*`; produkce fallback nepoužívá.
- Admin media formuláře zpřístupňují existující `MediaAsset.sortOrder`; tento údaj řídí pořadí hero/galerie přes stávající repository řazení.
- Upload formulář na aktivním filtru předvybere odpovídající `MediaType`, aby obsluha ve filtru `Prostory` omylem nenahrála studio fotku jako certifikát.
- Media server actions revalidují `/studio` i `/kontakt`, protože obě veřejné stránky čtou média ze stejné knihovny.
- `/kontakt` má samostatný `MediaType.CONTACT_PHOTO` a už nepoužívá fallback na `SALON_PHOTO`; bez kontaktní fotky zobrazí placeholder.

## Důsledky
- Produkce přestane zobrazovat broken image boxy pro orphan media záznamy.
- Admin workflow má nově jasné rozlišení: `Prostory` (`SALON_PHOTO`) pro `/studio`, `Kontakt` (`CONTACT_PHOTO`) pro hero kontaktní stránky.
- Vývoj bez produkční DB zůstává možný díky dev-only fallbacku.
