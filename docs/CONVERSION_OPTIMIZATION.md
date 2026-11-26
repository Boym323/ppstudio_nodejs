# Optimalizace dokončení rezervací

## Cesta návštěvníka

| Vstup | Chování | Co sledovat |
| --- | --- | --- |
| Úvodní stránka | Hlavní tlačítko otevře rezervaci. Doporučené služby odkazují na detail služby. | Aktivace hlavního tlačítka. |
| Ceník a detail služby | Při kliknutí u konkrétní služby zákazník naváže výběrem termínu. Ceník sleduje samostatně hlavní tlačítko, řádky a karty. | Aktivace podle umístění a služby, výběr termínu a případy nulové dostupnosti. |
| Termín a kontakt | Po výběru času zákazník doplní kontakt a zkontroluje souhrn. | Návštěvy s výběrem času, zahájením kontaktu a chybou pole. |
| Souhrn | Po úspěšném odeslání zákazník uvidí přijetí žádosti a informaci o následném finálním potvrzení. | Návštěvy s odesláním a vytvořením rezervace, konverze Matomo cíle 1. |

## Měření a interpretace

- `CTA / Rezervace klik` má název ve formátu `stránka | umístění` a u odkazu na konkrétní službu veřejný slug jako třetí část. Jedna aktivace odkazu vyvolá jednu událost. Opakované aktivace uživatele se měří samostatně. Předvýběr služby má vlastní událost.
- `source=homepage` v rezervačním odkazu určuje interní vstup do rezervace. V Matomu má událost s akcí „Rezervace zahájena“ český název zdroje, například „Úvodní stránka“. Starší záznamy mohou používat anglický identifikátor, například `homepage`. Akvizice pracuje s označením externí kampaně nebo s odkazujícím webem.
- V administraci `bookingPageviews` počítá zobrazení stránky a `bookingActivity` počítá návštěvy s jednotlivými akcemi. Například návštěva může mít opakovaný výběr času a stále přispěje jednou k dané akci. Při souběhu historického a nového názvu určuje přesný počet segment se sjednocením akcí. Je-li segment nedostupný, použije se nejvyšší jednotlivá hodnota jako dolní mez a dashboard zobrazí upozornění na neúplný report.
- Dashboardové agregáty nevyžadují určené pořadí kroků. Pro míru dokončení konkrétní cesty nastav v Matomo sekvenci kliknutí, výběru termínu, kontaktu a vytvoření. Dokumentovaný kontrakt administračního API včetně kompatibilního `funnel` je v [API](API.md#get-apiadminanalytics).
- Po vydání porovnej stejně dlouhá období se stejnými dny v týdnu. Primární metrikou jsou konverze cíle 1 na návštěvu. V Matomo je cíl 1 navázaný na akci obsahující `Vytvořena` a započítává nejvýše jednu konverzi za návštěvu. Pro interpretaci porovnej mobil a desktop, dostupnost termínů, akviziční kanály a počty návštěv v jednotlivých krocích. Nově měřená umístění CTA sbírají srovnatelnou historii od prvního vydání změny.

## Kampaň `homepage`

Při kontrole 26. listopadu 2026 vrátil agregovaný report `Referrers.getCampaigns` za posledních 90 dní 166 návštěv kampaně `homepage`. Report vstupních stránek segmentovaný podle `referrerName==homepage` potvrdil jako vstup kořen `/` u všech 166 návštěv. Ve vzorku jednotlivých návštěv byly mezi referrery Google a Seznam i návštěvy bez referreru. Google nebo Seznam v referreru samy o sobě nedokládají placenou reklamu.

Matomo získává název kampaně z kampaní označených ve vstupní URL nebo přímo parametrem trackingového požadavku. Aplikační `source` se vytváří až v odkazu do `/rezervace`. Historický report první zaznamenané stránky kampaňové parametry nezachoval, proto z něj nelze určit konkrétní značku, odkaz ani platformu, která štítek `homepage` nastavila. V dashboardu zůstává mezi neurčenými kampaněmi. [Matomo Tracking API](https://developer.matomo.org/api-reference/tracking-api) · [Implementace klasifikace pro Matomo 5](https://github.com/matomo-org/matomo/blob/5.x-dev/plugins/Referrers/Columns/Base.php)

## Označování reklam a soukromí

- URL pageviewů zachovává atribuční a booking parametry. Parametry, jejichž klíče nebo hodnoty odpovídají známým osobním údajům, se vynechávají; tokenové self-service cesty používají šablonu. Referrer předávaný Matomu obsahuje jen schéma, host a případný port. Cesta, parametry i fragment se zahazují.
- Rezervační odkazy se měří pojmenovanými CTA událostmi. Tokenové stránky odesílají pouze schválené události se šablonou URL.

## Ověření změn

Před nasazením ověř homepage hero, ceník a detail služby. V požadavcích Matomo zkontroluj přesně jednu událost aktivace, reklamní značky a nepřítomnost citlivých dat v `url`, `urlref` a `_ref`. Na desktopu a mobilu projdi opravu neplatného e-mailu, souhrn a úspěšné odeslání. V testech používej izolovanou databázi a testovací režim doručování. Skutečný dopad na dokončené rezervace vyhodnoť z dat po vydání.
