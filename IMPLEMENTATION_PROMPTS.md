# Prompty pro novou implementaci

Každý prompt spusť samostatně a dokonči jeho kontrolu před pokračováním dalším bodem. Pořadí je zvolené tak, aby se změny daly snadno izolovat a ladit.

## 1. Bezpečné měření Matomo URL

Zpřísni sanitizaci URL odesílaných do Matomo. Zachovávej pouze výslovně povolené parametry kampaní a rezervace, ověřuj bezpečný formát `service` a `source` a odstraňuj hodnoty připomínající osobní údaje nebo kódy poukazů. Zachovej původní navigační URL pro rezervační formulář. Doplň cílené testy.

## 2. Připsání zdroje rezervace

Oprav určování `source` při přechodu do rezervace tak, aby vycházelo ze stránky a kontextu CTA, nikoli z přítomnosti předvybrané služby nebo UTM parametrů. Pokryj homepage, detail/katalog služeb, ceník, voucher, kontakt, studio, FAQ a ostatní vstupy. Doplň testy.

## 3. Měření rezervačních CTA

Přidej měření kliknutí na rezervační CTA přes stávající českou taxonomii Matomo. Zachovej stávající navigaci a obsluhu `onClick`. Zahrň hlavičku a mobilní navigaci, rezervační lištu, ověření poukazu a návrat ze storna. Nepřidávej CTA na homepage, do patičky ani na karty služeb.

## 4. Správné agregace v analytickém dashboardu

Uprav dashboard Matomo tak, aby pageviewy rezervace byly samostatně od návštěv s událostmi. Událostní metriky počítej z `nb_visits`, nikoli `nb_events`; zobraz „Rezervace zahájena“ a jasně uveď, že jde o nezávislé agregáty, ne sekvenční funnel. Zachovej goal metriky jako autoritativní konverze. Doplň testy.

## 5. Doporučené časy v rezervačním formuláři

V rezervačním formuláři umožni filtrovat doporučené dostupné časy podle pražského času: dopoledne před 12:00, odpoledne 12:00–16:59 a večer od 17:00. Umožni zobrazit další termíny a ukaž prázdný stav filtru. Nulový výsledek filtru nesmí být měřen jako nedostupnost služby. Doplň cílené testy.

## 6. Měření skutečně nedostupné služby

Pokud vybraná služba nemá žádný skutečně dostupný termín, odešli jednou pro daný výběr neosobní Matomo událost s veřejným slugem služby. Událost neposílej během obnovy formuláře nebo katalogu ani při prázdném výsledku časového filtru. Doplň testy.

## 7. Stabilní vykreslení rezervačního formuláře

Zajisti stejný výchozí počet doporučených termínů při serverovém a prvním klientském vykreslení. Přechodná zpráva o obnově konceptu nesmí při hydrataci posouvat formulář; případnou zprávu zobraz za formulářem. Ověř cíleným regresním testem.

## 8. Předvýběr termínu předaného z odkazu

Umožni předat do rezervace termín přes validovaný `startsAt` spolu s vybranou službou. Po načtení čerstvé dostupnosti termín znovu ověř. Je-li obsazený nebo neplatný, upozorni klientku a nabídni výběr jiného času. Zachovej přednost explicitního termínu před uloženým konceptem. Doplň cílené testy.

## 9. Náhradní cesta při nulové dostupnosti

Když pro vybranou službu nejsou publikované volné termíny, nabídni kontaktování studia a změnu služby. Nezaměňuj nedostupnost jedné služby za globální nedostupnost. Ověř chování cíleným testem veřejného rezervačního toku.

## 10. Validace e-mailu v rezervaci

Ověř, že neplatný e-mail zabrání přechodu k souhrnu a vytvoření rezervace, zobrazí českou validační chybu a ponechá klientku v kontaktním kroku. Použij pouze syntetická data a testovací transport.

## 11. Texty metadat veřejných stránek

Uprav titulky a popisy ceníku, katalogu služeb a kontaktu tak, aby přirozeně uváděly PP Studio ve Zlíně. Zachovej canonical URL, sitemap a stávající pravidla pro citlivé rezervační cesty.

## 12. Závěrečná integrace a dokumentace

Po dokončení jednotlivých částí zkontroluj jejich vzájemnou kompatibilitu, changelog a relevantní dokumentaci. Spusť jen nejmenší kontroly potřebné pro právě dokončenou oblast; integrační/E2E testy používej pouze proti izolované testovací databázi. Produkci nenasazuj.
