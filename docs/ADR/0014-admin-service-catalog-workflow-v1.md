# ADR 0014: Admin katalog služeb a oddělená veřejná rezervovatelnost

## Stav
Accepted

## Kontext
Projekt už měl v databázi migrované služby a kategorie, ale admin sekce `Služby` byla jen read-only přehled. To nestačilo pro běžný provoz, protože tým potřebuje rychle upravit délku, cenu nebo publikaci služby bez zásahu do databáze nebo import skriptu.

Zároveň se ukázalo, že jedno pole `isActive` nestačí pro reálný provoz:

- některé služby mají zůstat interně aktivní kvůli historii, slotům nebo přípravě nabídky
- veřejný booking flow musí přesně vědět, co se smí rezervovat z webu
- historické rezervace už správně používají snapshot služby, takže úpravy katalogu nesmí přepsat minulost

## Rozhodnutí
- Sekce `Služby` dostává vlastní admin workflow na `/admin/sluzby` a `/admin/provoz/sluzby`.
- UI je rozdělené na serverový seznam s jednoduchými filtry a samostatný editor vybrané služby.
- Přidáváme pole `Service.isPubliclyBookable`, které odděluje veřejnou rezervovatelnost od obecné aktivity služby.
- Public booking flow smí použít jen službu, která je:
  - `isActive = true`
  - `isPubliclyBookable = true`
  - v aktivní kategorii
- Editace služby zůstává server-side přes server action a Zod validaci; nepřidáváme externí form builder ani admin knihovnu.

## Důsledky

### Pozitivní
- běžná provozní úprava služby je možná bez importu nebo ruční DB práce
- délka služby je pod přímou kontrolou adminu a zůstává spolehlivá pro booking logiku
- tým může skrýt službu z veřejné rezervace, aniž by ji musel úplně deaktivovat
- historické rezervace zůstávají konzistentní díky snapshotům v `Booking`

### Negativní
- přibývá další publikační přepínač, který je potřeba v UI dobře vysvětlit
- veřejný marketingový web `/sluzby` a `/cenik` zatím stále používá statický obsah v `src/content/public-site.ts`, takže katalog v adminu a prezentační obsah ještě nejsou jeden zdroj pravdy

## Alternativy
- Nechat jen `isActive`: zamítnuto, protože by nešlo čistě oddělit interní aktivní službu od veřejně rezervovatelné nabídky.
- Vytvořit plný CRUD kategorií ve stejné iteraci: odloženo, protože pro každodenní provoz je teď důležitější spolehlivá práce se službami.
- Použít generický admin formulář nebo CMS builder: zamítnuto kvůli zbytečné složitosti a slabšímu napojení na booking pravidla.
