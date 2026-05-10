# ADR 0091: Veřejný booking předvýběr služby přes query slug

## Stav
schváleno

## Kontext
Veřejný detail služby a marketingové kampaně potřebují posílat návštěvnici přímo do booking flow s už předvybranou službou. Veřejná rezervace ale už má zavedený bezpečný model:

- katalog služeb se načítá server-side z DB
- klientský wizard odesílá jen `serviceId`, `slotId` a kontaktní údaje
- server při submitu znovu ověřuje existenci služby, její veřejnou rezervovatelnost i dostupnost termínu

Nechceme zavádět nový zdroj pravdy přes query parametry ani propagovat interní `serviceId` do marketingových odkazů.

## Rozhodnutí
- Route `/rezervace` podporuje query parametr `service` ve tvaru `/rezervace?service=<slug>`.
- Jako vstupní identifikátor používáme `slug`, ne `serviceId`.
- Klientský flow smí předvybrat službu jen tehdy, když najde přesnou shodu slug v právě načteném `getPublicBookingCatalog()`.
- Pokud slug neexistuje nebo odpovídá službě, která už není aktivní či veřejně rezervovatelná, booking flow parametr ignoruje a zůstane na standardním kroku výběru služby.
- Submit rezervace dál důvěřuje pouze server-side validaci nad `serviceId` a `slotId`; query parametr nikdy nevstupuje do vytvoření rezervace jako zdroj pravdy.
- Odkaz `Rezervovat službu` na detailu služby vede na `/rezervace?service=<slug>`.
- Přítomnost `service` nesmí odstranit ani přepsat `utm_*` nebo `mtm_*` query parametry.

## Důsledky

### Pozitivní
- marketing a detail služby mohou linkovat přímo do relevantního booking flow
- URL zůstává čitelná a stabilní díky slugům
- nevzniká nový bezpečnostní ani datový kontrakt mimo existující server-side booking validaci

### Negativní
- klientský booking flow má další vstupní stav z URL, který je potřeba držet otestovaný
- slug změny mohou ovlivnit starší marketingové odkazy, pokud se slug služby přepíše

## Alternativy
- Použít `serviceId` v query: zamítnuto, protože je horší pro marketingové odkazy a zbytečně vystavuje interní identifikátor.
- Přeskočit validaci proti veřejnému katalogu a spoléhat jen na submit: zamítnuto, protože by to zhoršilo UX a umožnilo předvyplnit nedostupnou službu.
