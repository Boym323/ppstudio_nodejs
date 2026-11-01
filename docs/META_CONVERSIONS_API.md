# Meta Pixel a Conversions API

Tento návod popisuje aktuální serverovou integraci události `Schedule`. CAPI je vypnuté, dokud nejsou nakonfigurované obě strany Pixel/CAPI.

## Co aplikace odesílá

- `Schedule` vzniká jen při úspěšném vytvoření veřejné rezervace v databázi. Potvrzovací stránka ani opakované načtení ji znovu nevytvoří.
- Rezervace a serverový outbox se zapíšou ve stejné transakci. Při výpadku Meta se rezervace nezmění; e-mailový worker odeslání zopakuje.
- Pixel i CAPI dostanou stejné náhodné UUID jako `eventID` / `event_id`. Deduplikaci tvoří dvojice `event_name=Schedule` a UUID. ID neobsahuje osobní údaje ani interní ID rezervace.
- Čas události je `Booking.createdAt`; CAPI jej posílá v sekundách UTC. URL události je pevná veřejná cesta `/rezervace` bez query parametrů.
- CAPI posílá povinný user-agent a jen při dostupnosti také `_fbp` a `_fbc`. Neposílá IP adresu, e-mail, telefon ani hashované kontakty.
- Pixel a ostatní trackery se řídí svými konfiguračními přepínači. UTM/MTM interní atribuce se ukládá do akviziční cookie.
- Interní akviziční cookie `ppstudio-booking-acq` expiruje po 30 dnech a neukládá `fbclid`; dostupné `_fbp`/`_fbc` se předávají do CAPI outboxu a jeho kopie se odstraní po úspěchu, konečném selhání nebo šesti dnech čekání.
- `Purchase` ani CRM konverze se automaticky neposílají.

Meta pro deduplikaci vyžaduje shodu názvu události a ID, Pixel používá `eventID` jako čtvrtý argument `fbq` a CAPI `event_id`. Meta odpovídající doručení deduplikuje, pokud je obdrží v jejím 48hodinovém okně. Viz [Handling Duplicate Pixel and Conversions API Events](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events) a [Server Event Parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event).

## Konfigurace DEV a testování

Výchozí `.env.example` neposílá události. Pro skutečný test přes Meta použij oddělený testovací dataset a jeho vlastní Pixel ID/token; nikdy nepoužívej produkční dataset `1002460135763604` pro testovací události. Testovací události s `test_event_code` nejsou z Meta reportingu odfiltrovány a mohou být použity pro měření či cílení. Aplikace proto v neprodukčním runtime odmítá známý produkční dataset a v produkci odmítá `META_CAPI_TEST_EVENT_CODE`.

Na samostatném vývojovém prostředí nastav:

```dotenv
NEXT_PUBLIC_META_PIXEL_ENABLED=true
NEXT_PUBLIC_META_PIXEL_ID=<ID-testovaciho-datasetu>
META_CAPI_ENABLED=true
META_CAPI_DATASET_ID=<stejne-ID-testovaciho-datasetu>
META_CAPI_ACCESS_TOKEN=<testovaci-token>
META_CAPI_API_VERSION=v26.0
META_CAPI_TEST_EVENT_CODE=<kod-z-Test-Events>
```

V DEV se také výslovně přihlas k marketingovým cookies a vytvoř jednu skutečnou rezervaci na testovací dostupnosti. Ověř:

1. V **Events Manager → Data Sources → testovací dataset → Test Events** přijde browser i server `Schedule`.
2. Obě události mají stejný `eventID`/`event_id` a název `Schedule`; v Event Deduplication se jejich překryv sloučí.
3. `event_time` odpovídá okamžiku vytvoření rezervace, nikoli času retry.
4. Při odmítnutí marketingových cookies nepřijde Meta Pixel ani CAPI event.
5. Při unit a DB integračních testech se `fetch` mockuje. Testy nikdy nevolají Meta; ani ručně neposílej testovací událost do produkčního datasetu.

## Získání produkčního tokenu a aktivace

1. V Meta Business Suite otevři **Events Manager**, zvol existující dataset/Pixel `1002460135763604` a kartu **Settings**.
2. V sekci **Conversions API** pod manuálním nastavením klikni na **Generate access token**. Meta uvádí, že akce je dostupná uživatelům s developer oprávněním v Business portfolio.
3. Token ulož pouze do chráněné serverové konfigurace. Nikdy ho neposílej do `.env.example`, `NEXT_PUBLIC_*`, ticketu, klientského formuláře, GitHubu ani logů. Při podezření na únik jej v Meta zneplatni a vygeneruj nový.
4. Před buildem nastav veřejnou konfiguraci Pixelu a na produkčním webu stejný dataset. Na runtime nastav:

```dotenv
NEXT_PUBLIC_META_PIXEL_ENABLED=true
NEXT_PUBLIC_META_PIXEL_ID=1002460135763604
META_CAPI_ENABLED=true
META_CAPI_DATASET_ID=1002460135763604
META_CAPI_ACCESS_TOKEN=<tajny-produkční-token>
META_CAPI_API_VERSION=v26.0
# META_CAPI_TEST_EVENT_CODE v produkci nenastavovat
```

`NEXT_PUBLIC_*` hodnoty se propisují do klientského buildu; serverový token zůstává v runtime env a `src/config/env.ts` při zapnutí CAPI ověří, že Pixel a CAPI mají stejné ID. `META_CAPI_ENABLED` je záměrně defaultně `false`.

5. Ověř, že běží systemd `ppstudio-web` i `ppstudio-email-worker`. `deploy/release.sh` při nasazení aplikuje Prisma migrace před spuštěním obou služeb; tento návod sám nic nenasazuje.
6. Pro první produkční kontrolu nech aktivaci kampaní beze změny, počkej na běžnou rezervaci a zkontroluj příchod eventu. Neposílej `test_event_code` na produkční dataset.

Meta doporučuje pro CAPI stejný Pixel ID jako pro browser události. Postup pro token a dostupnost ručního nastavení popisuje [Get Started with the Conversions API](https://developers.facebook.com/documentation/ads-commerce/conversions-api/get-started); request endpoint, verzi API a Test Events popisuje [Using the API](https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api).

## Kontrola v Events Manageru

- V **Overview** vyber událost `Schedule` a zkontroluj připojení **Browser** i **Server**.
- V **Event Details → Event Deduplication** ověř použití klíče `event_id`/`eventID`, míru deduplikace a překryv zdrojů. Nízký překryv může znamenat blokování Pixelu, nesoulad ID nebo worker mimo provoz.
- V **Event Freshness** sleduj prodlevu; worker běží nad stávající PostgreSQL outbox frontou. Má šest celkových pokusů s backoffem; události starší než šest dní se zahodí dřív, než překročí Meta limit sedmi dní.
- V **Event Match Quality** sleduj kvalitu přiřazení. Aplikace posílá pouze user-agent a dostupná `_fbp`/`_fbc`; e-mail, telefon, IP ani hashované kontakty neposílá.
- V **Ads Manageru** u nové nebo ručně kontrolované reklamní sestavy ověř conversion location `Website`, dataset `1002460135763604` a optimalizační událost `Schedule`. Samotné nasazení aplikace kampaně ani jejich rozpočty nemění.
- Pro bezpečnou provozní kontrolu fronty lze použít souhrn bez identifikátorů:

```sql
SELECT "status", count(*) AS events,
       max("lastAttemptAt") AS last_attempt,
       count(*) FILTER (WHERE "lastErrorCode" IS NOT NULL) AS events_with_error
FROM "MetaConversionEvent"
GROUP BY "status"
ORDER BY "status";
```

Worker loguje pouze počty zpracovaných, odeslaných, opakovaných a neúspěšných událostí. Nezapisuje access token, user-agent, `_fbp`, `_fbc` ani event payload.

## Rozdíly proti Matomu

Matomo zaznamenává klientský funnel `Rezervace / Vytvořena` při úspěšném výsledku formuláře. Pixel posílá `Schedule` po návratu úspěšné server action. CAPI zapisuje `Schedule` až v transakci po vytvoření rezervace; může proto zachytit rezervaci i tehdy, když klientská odpověď nebo Pixel selže.

Meta Ads navíc počítá atribuci podle vlastních atribučních oken, modelování a optimalizace; Matomo reportuje návštěvy a funnel podle své session metodiky. Blokátory, odlišný okamžik zápisu a atribuční pravidla způsobí legitimní rozdíly. Počty se nemají ručně „dorovnávat“.

## Další fáze: potvrzená návštěva a tržba

Samostatná navazující fáze může na základě CRM posílat potvrzenou návštěvu nebo skutečně uhrazenou tržbu. Nejprve je potřeba vyhodnotit pravidla pro storno/no-show, případné vratky a přesnou definici hodnoty (platby, voucherové čerpání, úpravy ceny). Teprve poté lze navrhnout idempotentní CRM outbox s vlastním stabilním event ID. V první fázi zůstává `Purchase` vypnutý, aby se optimalizace nezakládala na rezervaci místo skutečné úhrady.
