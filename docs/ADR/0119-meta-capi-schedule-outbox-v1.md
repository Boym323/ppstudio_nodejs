# ADR 0119: Meta CAPI Schedule přes transakční outbox

## Kontext

Veřejný booking flow už po úspěšné serverové akci posílal Meta Pixel `Schedule`, ale browserová událost neměla deduplikační ID a událost nebyla krytá serverovou frontou. Přímé volání Meta uvnitř rezervace by spojilo dostupnost externí služby s databázovým zápisem.

## Rozhodnutí

- Jedinou konverzí první fáze je `Schedule` po vytvoření veřejné rezervace. Vytvoření rezervace a řádku `MetaConversionEvent` proběhne v jedné PostgreSQL transakci.
- Server vygeneruje náhodné UUID pro jednu rezervaci. Klientský Pixel odešle stejné `eventID`; serverový worker jej odešle jako CAPI `event_id`.
- Zpracování využije existující `ppstudio-email-worker`, claim přes `FOR UPDATE SKIP LOCKED`, lease token, omezený retry a backoff. Meta API tak neblokuje rezervaci a outbox přežije restart procesu.
- Outbox drží jen událost, bezpečnou veřejnou URL, user-agent a případné `_fbp`/`_fbc`. Kontakty, IP, booking ID a jejich hash se do Meta neposílají. Browserové identifikátory se mažou po úspěchu, konečném selhání nebo expiraci.
- Meta Pixel, CAPI a Google Ads vyžadují marketingový souhlas. Matomo, Clarity, Web Vitals a interní UTM/MTM atribuce vyžadují samostatný analytický souhlas.
- CAPI je bezpečně vypnuté do konfigurace. Neprodukční runtime odmítá známý produkční dataset a produkční runtime odmítá `META_CAPI_TEST_EVENT_CODE`.
- `Purchase` a další CRM konverze zůstávají mimo první fázi.

## Alternativy

- Odeslat CAPI synchronně v requestu rezervace: zamítnuto, protože dostupnost Meta nesmí ovlivnit úspěšný booking.
- Vytvořit samostatnou worker službu: zamítnuto, protože stávající PostgreSQL/email worker už zajišťuje trvalé frontování a restart recovery.
- Posílat hashované kontakty nebo IP: odloženo do samostatného posouzení právního základu a souhlasového modelu.
- Posílat `Purchase` při vytvoření nebo potvrzení rezervace: zamítnuto, protože booking nemusí znamenat dokončenou návštěvu ani úhradu.

## Důsledky

- Doručení je trvalé a opakovatelné, ale závisí na běhu existujícího workeru; Meta deduplikaci browser/server provádí podle kombinace názvu `Schedule` a stabilního ID.
- Identifikátory potřebné pro serverové přiřazení mají omezenou retenci; po zpracování se z outboxu odstraní.
- Detail konfigurace, Events Manager kontrol a další CRM fáze je v [`docs/META_CONVERSIONS_API.md`](../META_CONVERSIONS_API.md).

## Stav

schváleno; měření bez souhlasové kontroly je popsáno v ADR 0120
