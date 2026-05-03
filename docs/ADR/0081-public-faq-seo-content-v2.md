# ADR 0081: Public FAQ SEO content v2

## Context

- FAQ stránka už měla vhodný vizuální styl i tematické sekce, ale část odpovědí byla příliš obecná pro klientku, která se rozhoduje před první návštěvou.
- Pro SEO a přístupnost potřebujeme, aby odpovědi existovaly v serverově renderovaném HTML a aby strukturovaná data odpovídala skutečně zobrazenému obsahu.
- Na kontaktní stránce už existuje praktická informace o parkování u Sadové ulice, takže FAQ ji může bezpečně odkazovat bez slibování vyhrazeného místa.

## Decision

- FAQ obsah zůstává v `src/content/public-site.ts` jako `FaqSection -> FaqItem` a drží tematické sekce `Rezervace`, `První návštěva`, `Praktické otázky`, `Komfort a průběh`, `Organizace` a `Storno`.
- Accordion dál používá nativní `details/summary`, takže odpovědi jsou přítomné v DOM hned při renderu stránky.
- `FAQPage` JSON-LD generujeme pomocí `buildFaqPageJsonLd(...)` ze stejného seznamu `FaqItem`, který renderuje stránka.
- Pravý box v hero sekci neplní roli dalšího kontaktního CTA; podporuje rozhodnutí před první návštěvou a odkazuje jen nenápadně na sekci `#prvni-navsteva`.
- Rychlá orientace zůstává jako anchor navigace na sekce a mobilní odkazy mají větší tap target.

## Consequences

- Při každé další úpravě FAQ stačí upravit viditelný obsah a JSON-LD se aktualizuje automaticky.
- Do strukturovaných dat se nesmí přidávat samostatné marketingové otázky mimo viditelnou stránku.
- Parkování ve FAQ má zůstat odkazem na `/kontakt#parkovani`, dokud studio nemá samostatně garantované parkovací informace.
