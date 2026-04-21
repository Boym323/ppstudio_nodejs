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
