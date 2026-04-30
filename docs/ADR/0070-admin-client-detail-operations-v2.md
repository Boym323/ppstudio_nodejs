# ADR 0070: Provozní detail klientky v adminu v2

## Stav
Accepted

## Kontext
Detail klientky v adminu obsahoval správná data, ale opakoval jméno, kontakt, poslední návštěvu, další termín, počty rezervací, nejčastější službu a metadata v několika kartách. Pro běžný provoz salonu to prodlužovalo stránku a zpomalovalo odpovědi na praktické otázky: kdo je klientka, jak ji kontaktovat, kdy byla naposledy, jestli má další termín a co k ní tým interně potřebuje vědět.

## Rozhodnutí
- Detail klientky zůstává na stejných routách `/admin/klienti/[clientId]` a `/admin/provoz/klienti/[clientId]`.
- Read model `getAdminClientDetailData(...)` dál používá existující entity `Client` a `Booking`; nepřidává se DB migrace ani nové pole pro preference.
- Obrazovka je rozdělena na:
  - horní hlavičku s klientkou, stavem profilu, poslední/další návštěvou a rychlými akcemi
  - čtyři KPI karty bez samostatné velké karty pro nejčastější službu
  - levý sloupec `Historie návštěv` a `Interní poznámka`
  - pravý sloupec `Kontakt`, `Přehled klientky` a tlumená `Profilová metadata`
- Kontaktní akce používají `mailto:` a `tel:` jen při dostupné hodnotě; při chybějícím kontaktu se vykreslí neaktivní akce bez neplatného odkazu.
- Do KPI se doplňuje počet zrušených rezervací jako další bezpečná agregace nad existujícím stavem `BookingStatus.CANCELLED`.
- `Poslední návštěva` se v detailu odvozuje z poslední rezervace ve stavu `COMPLETED`, ne z `Client.lastBookedAt`; toto pole znamená aktivitu profilu při rezervaci a může předbíhat skutečnou návštěvu.

## Důsledky

### Pozitivní
- Detail je kratší a méně duplicitní, ale nepřichází o provozně důležité údaje.
- Interní poznámka zůstává dobře dostupná jako samostatný pracovní blok.
- Historie návštěv je čitelnější na mobilu, protože nepoužívá širokou tabulku.
- Chybějící e-mail nebo telefon už nevytváří neplatné kontaktní odkazy.

### Negativní
- Primární akce `Vytvořit rezervaci` vede na existující sekci rezervací, protože detail klientky zatím nemá vložený manual booking drawer s předvyplněnou klientkou.
- Nejčastější služba je méně dominantní než dřív; zůstává v pravém přehledu klientky.

## Alternativy
- Zachovat původní tři informační karty a jen upravit copy: zamítnuto, protože by neodstranilo hlavní duplicity.
- Přidat nové preference do DB: zamítnuto jako mimo scope; preference lze řešit později samostatnou migrací a produkčním procesem.
- Vložit ruční rezervaci přímo do detailu klientky: odloženo, protože by vyžadovalo širší práci s drawerem a předvyplněním klientky.
