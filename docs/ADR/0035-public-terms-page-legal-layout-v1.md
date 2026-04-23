# ADR 0035: Public terms page legal layout v1

## Stav
Accepted

## Kontext
Stránka `/obchodni-podminky` byla ve veřejném webu jen lehký draft s placeholder texty a neúplnou osnovou. To je u právní a provozní stránky rizikové, protože má pomáhat předcházet sporům kolem rezervací, storna, ceny nebo odpovědnosti za zdravotní kontraindikace.

## Rozhodnutí
- Stránka zůstává na sdílené komponentě `LegalPage`, aby právní stránky používaly jednotný hero, obsahovou navigaci a rytmus sekcí.
- `LegalSection` rozšiřujeme o volitelný `eyebrow`, aby šlo držet číslovanou právní osnovu bez vytváření nové specializované page komponenty jen pro obchodní podmínky.
- Finální texty obchodních podmínek držíme v `src/content/public-site.ts`, ne přímo v routě. Route skládá jen metadata, CTA a praktický blok poskytovatele z `getPublicSalonProfile()`.
- Provozní identitu (`operatorName`, `businessId`) vrací sdílený public profile helper, aby kontaktní a právní stránky nepoužívaly rozdílné hardcoded údaje.

## Důsledky
- Právní stránky zůstávají obsahově editovatelné bez zásahu do layout komponent.
- `/obchodni-podminky` a `/gdpr` sdílí stejné UX páky: hero aside, obsahovou navigaci a kompaktní karty.
- Pokud se v budoucnu změní provozní pravidla nebo textace podmínek, stačí upravit obsahovou vrstvu a případně shared public profile helper.
