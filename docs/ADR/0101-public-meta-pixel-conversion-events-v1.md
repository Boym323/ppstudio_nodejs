# 0101 Public Meta Pixel conversion events v1

## Kontext

Samotny `PageView` v Meta Pixelu nestacil pro smysluplne remarketingove publikum ani pro zakladni optimalizaci kampani na realne kroky rezervacniho funnelu. Potrebujeme doplnit standardni a custom eventy, ale bez posilani PII, tokenu nebo citlivych URL.

## Rozhodnuti

- Meta Pixel zustava volitelny pres `NEXT_PUBLIC_META_PIXEL_ENABLED=true` a `NEXT_PUBLIC_META_PIXEL_ID`.
- `PageView` zustava globalni v `MetaPixelTracker`, ale dalsi funnel eventy se volaji jen z klientskych handleru nebo efektu po uspesne akci.
- Detail sluzby `/sluzby/[slug]` posila standardni event `ViewContent`.
- Booking flow `/rezervace` posila:
  - `InitiateCheckout` pri otevreni aktivniho booking flow
  - `AddToCart` pri vyberu sluzby nebo pri URL prefill `?service=...`
  - custom `BookingDateSelected` pri vyberu dne
  - custom `BookingTimeSelected` pri vyberu casu
  - custom `BookingContactStarted` pri prvni interakci s kontaktnim krokem
  - `Lead` po uspesnem vytvoreni rezervace
- Event payloady se sanitizuji v helperu `src/features/analytics/meta-pixel.ts`; zakazane jsou e-maily, telefony, tokeny, klientske poznamky a hodnoty vypadajici jako PII nebo tokenova URL.

## Alternativy

- Posilat do Meta i detailni eventy kontaktniho formulare (`focus`, `input start`, `error`).
  - Zamitnuto, protoze jde o diagnosticke UX signaly vhodnejsi pro Matomo nez pro reklamni optimalizaci.
- Posilat `Purchase` po vytvoreni rezervace.
  - Odlozeno; bez online platby by semantika mohla byt matouci. V1 zustava u `Lead`.

## Dusledky

- Meta Pixel umi rozpoznat hlavni kroky verejneho funnelu bez nove npm zavislosti.
- Marketing ma lepsi zaklad pro remarketing a optimalizaci kampani na rezervace.
- Bezpecnostni guard zustava centralizovany v jednom helperu a stejne citlive hodnoty se do Pixelu nedostanou ani pri dalsim rozsireni eventu.

## Stav

schvaleno
