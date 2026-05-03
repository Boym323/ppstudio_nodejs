# ADR 0026: Konverznější landing-page skladba pro veřejnou stránku O mně

## Kontext
Původní stránka `/o-mne` už měla klidný tón a kvalitní copy, ale v praxi byla příliš lineární a textová:

- CTA byla níž, než je vhodné pro rozhodovací stránku
- důvěra, osobní příběh a důvod rezervace nebyly dost jasně oddělené
- stránka se hůř skenovala na mobilu i desktopu
- sekce certifikací nebyla připravená fungovat i ve stavu bez finálních assetů

Pro značku PP Studio potřebujeme stránku, která zůstane jemná, osobní a elegantní, ale zároveň lépe povede návštěvnici k rezervaci.

## Rozhodnutí
- Stránku `/o-mne` stavíme jako modulární landing page se sekcemi:
  - `HeroSection`
  - `WhyChooseMeSection`
  - `StorySection`
  - `ApproachSection`
  - `WhatToExpectSection`
  - `CertificationsSection`
  - `FinalCtaSection`
- Hero používá výraznější dvousloupcovou kompozici s časně umístěnými CTA a service badge.
- Obsahový model `aboutContent` rozšiřujeme o strukturované bloky `whyChooseMe`, hero CTA a badge, aby copy i hierarchy šly upravovat bez zásahu do layoutu.
- Certifikace zůstávají napojené na public read model admin uploadů, ale UI musí umět smysluplně renderovat i placeholder karty, pokud zatím nejsou nahrané reálné soubory.
- Zůstáváme na stávajícím veřejném design systému: `Container`, měkké radiusy, jemné border, lehké stíny a konzistentní CTA styl.

## Aktualizace 2026-04-25
- Zachováváme modulární strukturu stránky, ale copy vedeme klidněji a méně marketingově.
- Odstraňujeme defenzivní formulace o nahrazování praxe a nahrazujeme je sebevědomým popisem pečlivosti, klidu a osobního doporučení.
- Sekce benefitů může zobrazit krátký podnadpis z `aboutContent.whyChooseMe.description`, aby se textová hierarchie dala zjemnit bez redesignu.
- Certifikace dál čtou data z Media Library; fallback titulek reálného certifikátu bez názvu už není jen obecné `Certifikát`.

## Aktualizace 2026-05-03
- Stránka zůstává ve stejné modulární skladbě a vizuálním jazyce, ale layout je kompaktnější: hero je nižší, sekce mají menší vertikální odsazení, karty střídmější padding a certifikační náhledy menší výšku.
- `Můj příběh` a `Můj přístup` zůstávají samostatné sekce, ale mají těsnější návaznost, aby působily jako jeden přirozený obsahový tok.
- Copy příběhu už nezdůrazňuje krátkou praxi formulací „začala v roce 2024“; nově rámuje PP Studio jako cíleně budované klidné místo pro promyšlenou péči.
- Hodnota `Rozvoj` je přejmenovaná na `Odbornost` a FOR LIFE & MADAGA copy je formulované víc jako přímý benefit pro klientku.

## Alternativy
- Ponechat původní strukturu a pouze zkrátit texty: zamítnuto, protože hlavní problém byl v hierarchii a rozhodovacím toku, ne jen v délce copy.
- Udělat z `/o-mne` minimalistickou informační stránku bez výrazného hero a bez opakovaných CTA: zamítnuto, protože stránka má aktivně podporovat rezervaci.
- Přesunout certifikace jen do adminově řízené sekce a při nulovém stavu je úplně skrýt: zamítnuto, protože by layout při prázdném stavu ztratil rytmus a připravenost na budoucí obsah.

## Důsledky

### Pozitivní
- stránka lépe vede od prvního dojmu k důvěře a rezervaci
- mobilní skenovatelnost je výrazně lepší díky kratším blokům a jasné hierarchii
- copy i assety lze upravovat bez přepisování celé stránky
- certifikační sekce je odolnější vůči „prázdnému“ obsahu před finálním napojením

### Negativní
- `/o-mne` je oproti jiným public stránkám vizuálně silnější a porušuje obecné pravidlo „bez portrait-first kompozice“ mimo homepage
- finální kvalita hero stále závisí na dodání vhodné portrétní fotografie a skutečných certifikátů

## Stav
schváleno
