# ADR 0005: Public booking flow v1

## Stav
Accepted

## Kontext
Veřejný web potřebuje první produkčně použitelnou rezervaci bez falešných demo dat:

- termíny vypisuje ručně admin
- klientský flow musí být jednoduchý na mobilu
- validace a zápis musí být server-side
- slot nesmí být možné omylem rezervovat dvakrát
- struktura musí rovnou počítat s potvrzovacími e-maily a stornem

## Rozhodnutí
- Veřejná route `/rezervace` načítá katalog služeb a publikované sloty server-side.
- Interaktivní 4krokové UI běží v klientské komponentě, ale finální submit jde přes server action.
- Orchestrace zápisu je soustředěná v `src/features/booking/lib/booking-public.ts`.
- Při potvrzení rezervace se v jedné transakci:
  - znovu ověří služba a slot
  - uzamkne řádek slotu
  - ověří zbývající kapacita
  - upsertne klient podle e-mailu
  - vytvoří booking a status history
  - vygeneruje hashovaný storno token
  - založí `EmailLog` placeholder pro potvrzovací e-mail
- Pro zamezení double booking kombinujeme aplikační kontrolu kapacity, row lock a serializable transakci.

## Důsledky

### Pozitivní
- UX zůstává rychlé, ale server dál drží důležité invariants.
- Sloty nejsou vázané na pevnou otevírací dobu ani generované kalendáře.
- E-mailové workflow lze doplnit bez změny booking write modelu.
- Storno link už má finální tokenizovaný tvar.

### Negativní
- První verze zatím neřeší self-service storno ani reschedule.
- Klientský wizard drží mezikroky lokálně, takže po reloadu formuláře se stav resetuje.

## Alternativy
- Čistý route handler bez server action: zamítnuto, protože by přidal zbytečný boilerplate pro jednoduchý App Router flow.
- Čistě klientská validace: zamítnuto kvůli riziku nekonzistentních booking zápisů.
- Rezervaci ukládat bez token/email struktury: zamítnuto, protože by další iterace zbytečně rozbíjela write flow.
