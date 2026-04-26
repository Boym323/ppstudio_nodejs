# Projektový Manuál

Tento soubor je průběžný uživatelský a provozní manuál projektu.

## Účel
- Popsat, jak projekt spustit, používat, nasadit a spravovat.
- Udržovat informace aktuální při každé významné změně.

## Obsah manuálu
1. Přehled projektu
2. Lokální spuštění
3. Konfigurace prostředí
4. Build a nasazení
5. Provoz a monitoring
6. Řešení problémů (Troubleshooting)

## Pravidla údržby
- Při každé funkční změně aktualizuj relevantní sekce.
- Při změně nasazení vždy aktualizuj sekci Build a nasazení.
- Pokud přibude nová chyba a její fix, doplň ji do Troubleshooting.

## Aktuální Stav Projektu
- Projekt běží na Next.js 16 App Routeru se strukturou oddělenou na public web, booking a admin.
- Veřejný shell (`SiteShell`) inicializuje volitelný Matomo tracking přes `NEXT_PUBLIC_MATOMO_ENABLED`, `NEXT_PUBLIC_MATOMO_URL` a `NEXT_PUBLIC_MATOMO_SITE_ID`; admin route group tracking komponentu nepoužívá.
- Matomo měří pageview veřejných stránek a booking flow včetně klientských App Router navigací, ale neposílá pageview pro `/admin`, `/api`, Next internals ani tokenové self-service route `/rezervace/sprava/*`, `/rezervace/storno/*`, `/rezervace/akce/*`.
- Rezervační flow posílá pouze neosobní eventy `Booking / Service selected`, `Date selected`, `Time selected`, `Contact started` a po úspěchu `Created`; self-service změna termínu posílá bezpečné `Booking / Date selected` a `Booking / Time selected`. Jméno, e-mail, telefon, poznámka ani tokeny se do analytics neposílají.
- V Matomo je potřeba ručně nastavit Goal: název `Booking created`, trigger `custom event`, category `Booking`, action `Created`.
- Server-side dashboard analytics používají `MATOMO_URL`, `MATOMO_SITE_ID` a tajný `MATOMO_AUTH_TOKEN` v `src/lib/analytics/matomo.ts`; token není `NEXT_PUBLIC_*`, nepatří do klientského bundle a při chybě nebo chybějící konfiguraci vrací dashboard nulové fallbacky.
- Admin dashboard může tato data číst přes `/api/admin/analytics`; endpoint je přístupný jen pro přihlášené role `OWNER` a `SALON`, vrací pouze agregované počty bez PII a při interní chybě spadne na bezpečný JSON fallback.
- Pro dashboard je připravená klientská komponenta `src/components/admin/AnalyticsWidget.tsx`; sama řeší `fetch('/api/admin/analytics')`, loading, error i kompaktní zobrazení funnelu bez grafů.
- Widget `Návštěvnost → rezervace` je v admin přehledu záměrně až pod provozními bloky `alerty -> dnešní provoz -> dnešní plán -> rychlé akce`; slouží jako sekundární business přehled, ne jako hlavní osa dashboardu.
- Sekce `Zdroje rezervací` v tomto widgetu kombinuje Matomo kampaně a referrer typy do business názvů `Instagram`, `Firmy`, `Google`, `Přímý vstup` nebo `Ostatní`; konverze jsou v první verzi orientační rozdělení podle podílu návštěv na dokončených `Booking / Created`.
- Když je Matomo reporting rozbitý nebo zamčený, dashboard už neukazuje jen obecné nuly: `/api/admin/analytics` vrací i stav reportingu a widget vypíše provozní hlášku. Rychlá serverová kontrola funguje přes `npm run analytics:check`.
- Aktuální runtime stack podle `package.json`:
  - `next` `16.2.4`
  - `react` `19.2.4`
  - `react-dom` `19.2.4`
  - `prisma` + `@prisma/client` `7.7.0`
- Veřejná část aktuálně pokrývá:
  - homepage
  - služby a detail služby
  - ceník rozdělený podle kategorií přes celou šířku obsahu
  - o mně
  - kontakt
  - FAQ
  - storno podmínky
  - obchodní podmínky
  - GDPR
- Veřejný obsah je centralizovaný v `src/content/public-site.ts`, aby šly texty a hlavní brand copy měnit bez zásahu do layout komponent.
- Stručná komunikace storno pravidla na homepage a ve FAQ má být benefit-first a klientsky srozumitelná: nepoužívej interní názvy typu `storno okno` ani procesní věty o tom, jak jsou pravidla komunikovaná; preferuj krátké formulace typu `Změna nebo zrušení termínu je možné nejpozději 24 hodin předem.` nebo kontextovou variantu se stejným významem.
- `/storno-podminky` už nepoužívá jen generický právní text; stránka má vlastní akční skladbu `hero -> kontaktní box -> rychlý přehled pravidel -> krátké sekce`, aby klientka během pár sekund viděla co dělat a jaké dopady má pozdní storno nebo no-show.
- Copy na `/storno-podminky` je nyní záměrně měkčí: zdůrazňuje včasné oznámení a provozní dopad pozdního zrušení, ale automaticky nekomunikuje storno poplatek; zároveň výslovně odkazuje i na storno link v potvrzení rezervace a 24h reminderu.
- FAQ na `/faq` už není plochý seznam několika otázek; stránka nově používá skladbu `hero s jemným CTA -> pravý kontaktní box -> rychlá sekční navigace -> tematické accordion bloky`.
- FAQ copy je záměrně orientované na rozhodnutí před první návštěvou: řeší výběr služby, průběh první návštěvy, praktické detaily, komfort, organizaci i stručné storno shrnutí s odkazem na samostatnou stránku podmínek.
- Reálné služby z DB dostávají veřejnou copy vrstvu v `src/features/public/lib/public-services.ts`, ale její metadata už nevznikají z lokálních map; čtou se přímo z rozšířeného katalogu služeb a kategorií.
- Ceník na `/cenik` má vlastní modul v `src/features/public/components/pricing-page.tsx` a je rozdělený do jasné kompozice `hero -> category chips -> hlavní sekce -> menší grid sekce -> finální CTA`.
- Katalog služeb a kategorií teď nese i veřejná pricing metadata:
  - služba: `publicIntro`, `seoDescription`, `pricingShortDescription`, `pricingBadge` (název je sjednocený v poli `name` pro web i rezervace)
  - kategorie: `pricingDescription`, `pricingLayout`, `pricingIconKey`, `pricingSortOrder` (název je sjednocený v poli `name`; legacy `publicName` se už nepoužívá)
- Admin sekce `Služby` a `Kategorie služeb` tato metadata umí upravovat bez zásahu do databáze nebo kódu.
- Admin sekce `Služby` už nepoužívá vysoké katalogové karty; seznam je nově seskupený podle kategorií a funguje jako hustší provozní workspace.
- Každá skupina kategorií v adminu ukazuje počet služeb a jde rozbalit/sbalit; samotná služba má kompaktní řádek a sekundární kontext je až v rozbalení nebo v pravém detail draweru.
- Rychlé změny služby se v seznamu nově soustředí do malého menu `⋯` a na desktopu i do drobných inline toggle přepínačů pro aktivitu a veřejnost.
- Ceník už nepoužívá vedlejší blok s poznámkami; detail služby zůstává místem pro doplňující vysvětlení.
- Veřejné stránky drží jednotný šířkový rytmus přes sdílený `Container` (`max-w-7xl`); při úpravách layoutu nepřidávej další globální zúžení sekcí přes `mx-auto max-w-*`.
- Vertikální spacing veřejných sekcí je sjednocený do rytmu `py-10 / sm:py-14 / lg:py-16`; větší rozestupy používej jen pro obsahově výrazné bloky.
- Rezervační vrstva stojí na ručně vypisovaných termínech přes `AvailabilitySlot`, ne na pevné otevírací době.
- Ruční rezervace v adminu nově dovoluje vytvořit klientku i bez e-mailu, což pokrývá rezervace z Instagramu, telefonu nebo osobní domluvy; pokud adresa chybí, klientské potvrzení se záměrně neposílá.
- Pending rezervace lze nově potvrdit nebo zrušit přímo z provozního e-mailu přes bezpečné jednorázové odkazy s mezikrokem potvrzení na veřejné route `/rezervace/akce/[intent]/[token]`.
- Admin sekce `Rezervace` dál zůstává kompaktní řádkový workspace, ale nově má klikací statistiky jako rychlé filtry, nízký toolbar filtrů a seskupení seznamu do bloků `Dnes`, `Zítra`, `Později`, `Dříve`.
- Finální production polish admin sekce `Rezervace` sjednotil horní statistiky do segmented filtru, zvýraznil sekci `Dnes`, posílil pending rezervace a přidal click-to-open řádky s klávesami `Enter`, `↑` a `↓`.
- Pracovní seznam je sticky po dobu scrollu: filtr bar zůstává nahoře, hlavička tabulky drží kontext a akce v řádku vrací okamžitý inline feedback přes loading stav a toast.
- V pracovním seznamu je teď nejvýraznější čas rezervace; uzavřené stavy `Hotovo` a `Zrušená` mají menší vizuální váhu a inline akce se liší podle stavu rezervace.
- Kontakt v řádku rezervace je praktický i na mobilu: telefon používá `tel:`, e-mail `mailto:` a mobilní zobrazení skládá compact card s pořadím `čas -> klientka -> služba -> stav`.
- Po potvrzení rezervace zákaznice dostává v potvrzovacím e-mailu `.ics` přílohu s jednou konkrétní kalendářovou událostí pro potvrzený termín, ne subscription feed.
- Owner může v `/admin/nastaveni` nově zapnout chráněný Apple Calendar subscription feed na `/api/calendar/owner.ics?token=...`; feed je read-only, bere jen potvrzené rezervace a aplikace zůstává jediným source of truth.
- OWNER muze v `/admin/nastaveni` v bloku `Pushover notifikace` nastavit vlastni Pushover User Key, zapnout/vypnout notifikace a zvolit event typy `Nova rezervace`, `Rezervace ceka na potvrzeni`, `Rezervace potvrzena`, `Rezervace zrusena`, `Termin presunut`, `Selhani emailu`, `Selhani reminderu` a `Systemove chyby`. Blok je owner-only; `SALON` nema route ani navigaci do nastaveni a Pushover sluzba pred odeslanim znovu vybira jen aktivni DB uzivatele s roli `OWNER`.
- Pushover aplikacni token je server-only env `PUSHOVER_APP_TOKEN`; globalni vypinac je `PUSHOVER_ENABLED=true`. Chyba Pushover API se pouze loguje a nikdy nesmi rozbit booking, email worker ani reminder flow.
- Pushover kod je rozdeleny na Next.js wrapper `src/lib/notifications/pushover.ts` se `server-only` markerem a worker-safe implementaci `src/lib/notifications/pushover-core.ts`, kterou smi nacitat standalone `email:worker` pres `tsx`.
- Admin detail rezervace nově podporuje samostatnou akci `Přesunout termín`; booking zůstává stejným záznamem, ale změna projde backend validací, auditním logem, resetem reminder návaznosti a volitelným klientským e-mailem `Termín byl změněn`.
- Admin detail rezervace už nefunguje jako dlouhá informační stránka; nově je to rychlý rozhodovací panel se sticky hlavičkou, horním akčním blokem, kompaktním souhrnem v bočním sloupci a sjednoceným blokem poznámek.
- Po otevření detailu je během pár sekund vidět klientka, služba, termín, stav a nejpravděpodobnější další akce; reschedule zůstává oddělený jako samostatný drawer a chování pro `OWNER` i `SALON` je stejné.
- Veřejný manage flow `/rezervace/sprava/[token]` má nově DB integrační coverage nad reálným Prisma wiringem; testy ověřují token access, self-service storno, self-service přesun i hlavní auditní a notifikační side effects bez browser E2E vrstvy.
- Self-service přesun přes `/rezervace/sprava/[token]` po úspěchu záměrně nerevaliduje právě otevřenou veřejnou route; v Next.js 16 by route refresh po server action mohl přemountovat klientský panel a smazat lokální success stav dřív, než se ukáže uživatelce.
- Veřejná stránka změny termínu je UX refaktorovaná do toku `kontext -> aktuální rezervace -> hybridní výběr termínu -> potvrzení -> sekundární storno`: nejbližší termíny jsou nahoře jako rychlé chips, kalendář slouží jako sekundární výběr dne a potvrzení je jediná dominantní CTA.
- Veřejná booking dostupnost už není omezená jen na jeden fyzický `AvailabilitySlot`; pokud na sebe publikované sloty bez mezery navazují a mají stejná veřejná pravidla, katalog je složí do jednoho delšího okna a delší služby se tak mohou rezervovat i přes více sousedních segmentů.
- Uvnitř takto složeného okna systém stále drží správný podkladový `slotId` pro vybraný start času a backend při vytvoření nebo přesunu termínu ověřuje celý souvislý řetězec segmentů bez mezer, blokací a kapacitních kolizí.
- Implementačně je veřejný booking flow po stabilizačním refaktoru rozdělený do menších interních komponent (`progress panel`, `service step`, `term step`, `contact step`, `summary sidebar`), ale chování pro klientku zůstává stejné.
- Admin má dva směry použití:
  - full admin na `/admin/*` pro roli `OWNER`
  - lite admin na `/admin/provoz/*` pro roli `SALON`
- Obě rozhraní sdílejí stejné doménové entity, ale liší se navigací i hustotou UI:
  - `OWNER` vidí strategické a technické sekce navíc
  - `SALON` vidí jen provozní sekce a jednodušší copy bez technických pojmů
- Přesun termínu má pro `OWNER` i `SALON` stejné chování; role mění jen administrativní cestu, ne business logiku reschedule flow.
- Filtrační lišta sekce `Služby` je na desktopu sticky a zůstává během scrollu po ruce; horní statistiky jsou záměrně menší, aby nepřebíraly roli hlavního obsahu.
- Týdenní planner dostupností a veřejná booking service vrstva jsou po stabilizačním refaktoru modulární i v kódu, ale bez změny URL, exportů nebo databázového modelu.
- Prisma schema v1 už pokrývá:
  - admin uživatele a role
  - kategorie služeb a služby včetně samostatné veřejné rezervovatelnosti
  - sloty s omezením na vybrané služby
  - klienty, rezervace a historii stavů
  - e-mailové logy, action tokeny, legacy `Setting`, singleton `SiteSettings` a metadata model `MediaAsset`

## Lokální Spuštění
```bash
npm install
cp .env.example .env
npm run db:generate
npm run dev
```

`npm test` nyní spouští i DB-backed integrační testy (nejsou skipnuté), takže běžná verifikace zahrnuje i booking integrační scénáře.

Browser E2E vrstva používá Playwright a spouští se samostatně:

```bash
npm run test:e2e
```

E2E testy nejdřív vytvoří produkční build, startují lokální `next start` server na samostatném portu, přepínají e-mail delivery do `log` režimu a seedují izolovaná data pro veřejnou rezervaci, storno, přesun termínu a admin potvrzení rezervace. Self-service přesun termínu má v Playwrightu cíleně o něco širší timeout, protože čeká na plný server action roundtrip nad produkčním buildem. Při prvním spuštění na novém stroji může být potřeba doinstalovat Playwright browser přes `npx playwright install chromium`.

GitHub Actions CI používá stejnou verifikační sadu automaticky na pull requestech a pushech do hlavních větví:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Workflow si pro testy startuje PostgreSQL service container a používá bezpečné lokální/testovací env hodnoty bez reálného SMTP odesílání.

Pro cílené spuštění pouze booking DB integračních testů je připravený i samostatný příkaz:

```bash
npm run test:db:booking
```

Aktuálně pokrývá:
- `src/features/booking/lib/booking-rescheduling.integration.test.ts`
- `src/features/booking/lib/booking-management.integration.test.ts`

Pro rychlé unit ověření veřejné správy rezervace a reschedule pravidel jsou v repozitáři i cílené testy bez DB:

```bash
node --import tsx --test src/features/booking/lib/booking-management.test.ts
node --import tsx --test src/features/booking/lib/booking-rescheduling.test.ts
```

Pokud databáze ještě neobsahuje schema nebo přibyly nové migrace:

```bash
npm run db:migrate
```

### Lokální media storage
- Upload root se nastavuje přes `MEDIA_STORAGE_ROOT`.
- Pokud proměnná není vyplněná, aplikace použije výchozí cestu `/var/www/ppstudio/uploads`.
- Uvnitř rootu aplikace odděluje:
  - `public/` pro veřejně čitelná média
  - `temp/` pro budoucí drafty nebo přechodné upload workflow
- Veřejná média se zobrazují přes URL vrstvu `/media/public/<type>/YYYY/MM/<filename>`, ne přímým odkazem na fyzickou cestu.
- Statické assety verzované v repozitáři (`public/brand`) a uploady z adminu jsou dvě rozdílné věci; nové admin obrázky mají jít přes media storage vrstvu.
- Pro JPEG/PNG/WebP uploady nyní vzniká lehká server-side image pipeline přes `sharp`:
  - originál se při zápisu normalizuje přes EXIF auto-rotate a ukládá se jako `{assetId}-original.<ext>`
  - `optimized` varianta se generuje s auto-rotate podle EXIF, max šířkou 1920 px a rozumnou kompresí
  - `thumbnail` varianta se generuje pro admin grid s cílovou šířkou kolem 400 px
  - veřejný web čte `optimizedUrl`, admin grid čte `thumbnailUrl` a starší média bez variant padají zpět na původní `url`

### Lokální vývoj z jiného zařízení v LAN
- Next.js 16 v dev režimu blokuje cross-origin přístup k dev assetům a HMR endpointům, pokud origin výslovně nepovolíš.
- Projekt proto v `next.config.ts` povoluje `allowedDevOrigins` pro lokální host `192.168.0.143` i veřejnou doménu `ppstudio.cz` / `www.ppstudio.cz`, aby šel dev server otevřít i přes Synology reverse proxy nebo z jiného zařízení v síti.
- Po změně `allowedDevOrigins` je potřeba restartovat `npm run dev`.
- Pokud budeš používat jiný hostname nebo IP, doplň ho do `allowedDevOrigins` a změnu zapiš i do dokumentace.

### Import kategorií a služeb
- Import běží přes JSON soubor a upsertuje záznamy podle `slug`.
- Nejrychlejší postup:
```bash
node scripts/import-services.mjs --file scripts/services.import.example.json --dry-run
node scripts/import-services.mjs --file path/to/old-web-services.json
```
- Import očekává strukturu:
  - `categories[]` s poli `name`, `slug`, `description`, `pricingDescription`, `pricingLayout`, `pricingIconKey`, `sortOrder`, `pricingSortOrder`, `isActive`
  - `services[]` s poli `name`, `slug`, `categorySlug`, `publicIntro`, `seoDescription`, `pricingShortDescription`, `pricingBadge`, `durationMinutes`, `priceFromCzk`, `description`, `shortDescription` (legacy, volitelné), `publicName` (legacy, volitelné), `sortOrder`, `isActive`
- Pokud starý web exportuje data v jiném formátu, je potřeba je před importem namapovat do této struktury.
- Pro tvoje aktuální kategorie je připravený vzor v `scripts/old-web-categories.json`.
- Pro tvoje aktuální služby je připravený vzor v `scripts/old-web-services.json`.

### Vyčištění testovacích rezervací a termínů
- Pro rychlý úklid testovacích provozních dat použij:
```bash
npm run db:clear-booking-data
npm run db:clear-booking-data -- --confirm
```
- Skript v první fázi jen vypíše počty rezervací, slotů a navázaných logů. Ke skutečnému smazání je potřeba explicitní `--confirm`.
- Mažou se `Booking`, `AvailabilitySlot`, jejich tokeny, historie, navázané e-mailové a submission logy a nakonec i osiřelé klientky bez aktivní vazby na rezervaci.
- Katalog služeb a kategorií, admin účty, `SiteSettings`, `CalendarFeed` ani `MediaAsset` se nemažou.

## Veřejný Web
- Navigace vede na klíčové konverzní a důvěryhodnostní stránky místo jedné přetížené homepage.
- Detail služby je renderovaný v request-time režimu nad DB katalogem služeb, takže změny z adminu nečekají na nový build.
- `/rezervace` nyní obsahuje produkční V1 flow:
  - výběr kategorie služby a následně konkrétní služby
  - výběr konkrétního času v rámci ručně publikovaného volného okna
  - kontaktní údaje klienta
  - souhrn a potvrzení
- Výběr služby je nově rozdělený na dvě úrovně (`kategorie -> služba`), aby se klientka rozhodovala v kratších blocích a rychleji našla správnou variantu.
- Po výběru služby booking flow automaticky scrolluje na krok s termíny.
- Výběr termínu v kroku 2 teď začíná sekcí `Nejbližší dostupné termíny`; kalendář zůstává hned pod ní jako sekundární cesta pro jiný den.
- Krok 2 nabízí starty po 30 minutách uvnitř dostupného okna a bere v úvahu délku služby i už obsazené intervaly.
- Krok `Vyberte termín` používá větší a výraznější tlačítka časů s menší hustotou na řádek; detail termínu (`konec`, `délka`, případná poznámka) zůstává v souhrnu.
- Kontaktní krok přidává průběžnou inline validaci i helper text, proč je kontakt potřeba.
- Souhrn umožňuje upravit službu, termín i kontakt přímo z pravého panelu bez vracení přes předchozí kroky.
- Na mobilu je booking doplněný o sticky CTA lištu, která podle stavu výběru vede na další akci nebo rovnou na odeslání.
- Po úspěšném odeslání se zobrazí samostatný confirmation flow místo jednoho souhrnného cardu:
  - status blok `Rezervace přijata`
  - jasný stav `Čeká na finální potvrzení` a věta, že termín je předběžně rezervovaný
  - hlavní detail se službou, datem a časem ve formátu s čitelnou pomlčkou, například `09:30 – 10:30`
  - stručný blok `Co bude následovat`
  - uklidňující věta, že termín je nyní rezervovaný a klientka nemusí dělat další kroky
  - samostatný kontakt na studio až pod hlavními informacemi
  - referenční kód se nezobrazuje, dokud pro něj projekt nemá samostatné business pole používané v komunikaci
  - nad confirmation panelem se nezobrazuje intro z aktivního výběru termínu (`Vyberte si termín...`)
  - post-submit screen záměrně nezobrazuje akce `Změnit termín` ani `Zrušit rezervaci`; změny a storno patří do e-mailu nebo detailu rezervace, ne do uzavření flow
- Provozní e-mail o nové rezervaci teď obsahuje tři akce:
  - `Potvrdit rezervaci`
  - `Přesunout termín`
  - `Zrušit rezervaci`
  - `Otevřít v administraci`
- Provozní e-mail je určený pro rychlé mobilní rozhodnutí: nahoře je služba, datum, čas, klientka, e-mail a telefon jen pokud existuje; dlouhé vysvětlení akčních odkazů, technické údaje a duplicitní patička se v této šabloně nezobrazují.
- Emailové approve/reject odkazy neprovedou změnu hned po otevření; vždy nejdřív zobrazí kontrolní obrazovku s přehledem rezervace a až následně potvrzovací CTA.
- Po potvrzení rezervace systém automaticky založí návazný klientský e-mail s výsledkem rezervace a přiloženou `.ics` událostí pro osobní kalendář klientky.
- Booking e-maily mají jednotný klidný design: nahoře `PP Studio`, jasný headline, krátký úvod, karta se službou / datem / časem, místo, relevantní akce, jednorázový kontakt a decentní patička. Čas se zobrazuje jako `09:30 – 10:30`.
- Potvrzovací e-mail po finálním schválení rezervace je záměrně krátký a praktický: potvrzuje rezervaci, ukazuje službu, termín a místo `PP Studio, Sadová 2, 760 01 Zlín`, připomíná přiloženou kalendářovou událost a dole nenápadně nabízí změnu nebo zrušení, pokud jsou v payloadu dostupné bezpečné odkazy.
- Reminder 24 hodin před termínem neobsahuje samostatné CTA `Ozvat se studiu`; kontakt je jednou jako `Napište nám: info@ppstudio.cz` a `Zavolejte: +420 732 856 036`.
- Pending confirmation screen kalendář záměrně nenabízí; `.ics` příloha patří až k e-mailu po přechodu rezervace do `CONFIRMED`.
- Rezervační stránka je renderovaná dynamicky při requestu, takže nově publikované nebo obsazené sloty jsou vidět bez dalšího buildu.
- Hero, sekce `O mně` a základní service copy jsou přepsané do klidnějšího a osobnějšího tónu; u `/o-mne` se vyhýbej defenzivním formulacím o praxi, agresivním slibům a superlativům typu `dokonalý`, `špičkový` nebo `okamžité výsledky`.
- Další jemné úpravy veřejné copy dělej centrálně v obsahové vrstvě `src/content/public-site.ts` nebo v DB copy mapě služeb, ne přímo v route souborech.
- Veřejný footer je záměrně klidný informační blok, ne marketingová patka:
  - na desktopu používá kompaktní 3sloupcové rozložení `brand -> navigace + informace -> kontakt`
  - na mobilu se skládá pod sebe v pořadí `brand -> navigace -> informace -> kontakt`
  - navigace a právní odkazy jsou oddělené do dvou samostatně nadepsaných skupin, ne do jednoho dlouhého seznamu
  - kontakt má vlastní opticky silnější blok s adresou a klikacími odkazy `tel:` a `mailto:`; telefon i e-mail se zobrazují přímo a bez textové obfuscace
  - spodní mikrořádek drží jen copyright a nemá přebírat roli další navigace
- Stránka `/gdpr` už není placeholder kostra; používá právní informační skladbu `hero s kontaktem správce -> obsahová navigace -> tematické sekce`.
- Stránka `/obchodni-podminky` už není pracovní návrh; používá finální právní strukturu `hero s kontaktním blokem poskytovatele -> obsahová navigace -> kompaktní sekce pro rezervace, storno, cenu, průběh služby, odpovědnost, reklamace, poukazy a závěrečná ustanovení`.
- GDPR sekce v `src/content/public-site.ts` teď počítají s jemně bohatším modelem (`id`, odstavce, seznamové body, volitelná poznámka), aby šla stránka rozšířit bez přepisování layoutu.
- Právní sekce v `src/content/public-site.ts` nově umí i volitelný `eyebrow`, takže dlouhé právní stránky drží čitelnou číslovanou hierarchii bez zavádění nové specializované page komponenty.
- Veřejné e-mailové odkazy jsou jemně obfuskované:
  - text se zobrazuje ve tvaru `lokalni-cast [at] domena`
  - skutečný `mailto:` odkaz se skládá až na klientu po načtení stránky
  - pro návštěvnici zůstává chování stejné, ale jednoduché scrapery nevidí čistý e-mail přímo v HTML
- Stránka `/kontakt` má nově silnější orientaci na rychlou akci:
  - hero drží text + CTA vlevo a vyhrazený placeholder prostor pro budoucí fotografii vpravo
  - spodní část kontaktu kombinuje mapový náhled a quick contact blok s telefonem, e-mailem, Instagramem a údajem o provozovateli
  - spodní CTA blok rozlišuje dvě cesty rozhodnutí (rovnou rezervace vs. nejdřív kontakt)
  - na mobilu je dole sticky CTA lišta s rychlou rezervací, voláním a e-mail kontaktem
- Stránka `/o-mne` je nově poskládaná jako scan-friendly landing page:
  - výraznější hero s dvěma CTA a badge služeb
  - stručná sekce „Proč klientky volí PP Studio“ s klidným podnadpisem a třemi konkrétními benefity
  - civilnější příběh, samostatný blok přístupu a klidná sekce o kosmetice FOR LIFE & MADAGA
  - samostatná mřížka certifikací, která funguje i bez finálních admin dat díky placeholder kartám
- Následný polish pass nad `/o-mne` už nemění strukturu; upravuje hlavně proporce hero, vnitřní spacing karet, rytmus sekcí a jemnou textovou hierarchii.
- Finální UI polish ještě mírně navýšil váhu textového hero sloupce, sjednotil benefit boxy do stabilnější výšky a přidal jemné hover stavy pro benefit karty a certifikace.
- Další doladění stránky `O mně` má už být jen přes drobné utility změny, ne přes nové bloky nebo přepis IA.
- Texty a struktura stránky `O mně` jsou centralizované v `aboutContent`; layout počítá s polem `whyChooseMe` včetně volitelného podnadpisu sekce, popisu benefit karet, hero badge, CTA kartou i pozdějším napojením certifikací na admin data bez dalšího přepisu sekcí.
- Homepage copy teď vědomě navazuje na konverzně funkční strukturu starého webu (`služba + lokalita`, rychlé CTA na rezervaci/ceník, sekce pro nejistý výběr služby), ale běží na současném komponentovém základu.
- Homepage hero podporuje i vizuální brand prvky přes obsahový config (`logoImage`, `portraitImage` v `src/content/public-site.ts`); lokální assety jsou v `public/brand/`.
- Homepage hero lze obsahově ladit blíž původnímu webu přes `homepageContent` (`benefits`, `ctaNote`) bez zásahu do routy.
- Hero na homepage je záměrně klidnější: portrét je menší a pravý sloupec nepoužívá doprovodné mini boxy.
- CTA na rezervaci je dostupné v hlavičce, hero sekcích i obsahových blocích.
- Stránka `/studio` představuje prostředí PP Studia před první návštěvou:
  - navigace používá název `Studio`
  - hero má dvě CTA `Rezervovat termín` a `Kontakt` a jako úvodní vizuál bere první publikovanou fotku studia
  - galerie načítá pouze publikované záznamy `MediaType.SALON_PHOTO`
  - bez nahraných fotek se zobrazí klidný placeholder, aby stránka nezůstala prázdná ani rozbitá
  - navazující bloky krátce popisují atmosféru, adresu a finální cestu k rezervaci nebo kontaktu
- Veřejné napojení modulu `Média webu` je nyní centrální:
  - `/o-mne` načítá certifikáty přes `MediaType.CERTIFICATE` a hero portrét primárně přes `MediaType.PORTRAIT_ABOUT`, s fallbackem na legacy `MediaType.PORTRAIT`
  - homepage používá hero portrét primárně přes `MediaType.PORTRAIT_HOME`, s fallbackem na legacy `MediaType.PORTRAIT` a teprve pak na verzovaný brand asset
  - `/kontakt` a `/studio` používají publikované `MediaType.SALON_PHOTO`; `/kontakt` bere první fotku jako hero, `/studio` používá první fotku pro hero a celý publikovaný seznam pro galerii
  - `MediaType.GENERAL` má připravený public read model pro budoucí hero, CTA a bannerové bloky, ale zatím není připojený do konkrétní stránky
- Certifikáty, fotky prostor, reference a další budoucí obsahové obrázky mají sdílený základ přes `MediaAsset` a lokální upload storage.

## Přihlášení Do Adminu
- Admin login je dostupný na `/admin/prihlaseni`.
- Login route `POST /api/auth/login` má nově server-side rate limit (okno 10 minut) nad hashovanou IP a hashovaným e-mailem, aby omezila brute-force pokusy.
- Při překročení limitu se login ukončí bezpečným přesměrováním na `/admin/prihlaseni?error=rate_limited` bez založení session.
- Databázové účty vytvořené přes owner sekci `Uživatelé / role` se přihlašují vlastním heslem nastaveným přes pozvánku.
- Pro systémový fallback přihlášení stále existují bootstrap hodnoty:
  - `ADMIN_OWNER_EMAIL`
  - `ADMIN_OWNER_PASSWORD`
  - `ADMIN_STAFF_EMAIL`
  - `ADMIN_STAFF_PASSWORD`
- Env proměnné `ADMIN_STAFF_*` bootstrapují systémový účet role `SALON`.
- Session je ukládaná do `httpOnly` cookie a podepisovaná pomocí `ADMIN_SESSION_SECRET`.
- Po přihlášení aplikace přesměruje uživatele na domovskou admin cestu podle role:
  - `OWNER` -> `/admin`
  - `SALON` -> `/admin/provoz`

## Admin Sekce a Role
- Sekce dostupné pro obě role:
  - Přehled
  - Rezervace
  - Volné termíny
  - Klienti
- Mobilní admin navigace používá vlastní drawer; při jeho otevření se horní lišta dočasně schová, aby se menu nepřekrývalo s vlastním obsahem.
- Owner sekce `Nastavení` nově obsahuje i blok `Kalendář`:
  - zapnutí feedu
  - zkopírování subscription URL
  - rotaci tokenu
  - vypnutí feedu
  - stručný návod pro Apple Kalendář / iCloud subscription
- ICS feed je určený jen jako přehled pro majitelku:
  - ukazuje pouze rezervace ve stavu `CONFIRMED`
  - neumožňuje editaci ani obousměrnou synchronizaci
  - po rotaci nebo vypnutí starý odkaz přestane fungovat
- Sekce `Přehled` na `/admin` a `/admin/provoz` je nyní operativní dashboard dne:
  - layout je rozdělený na hlavní pracovní plochu a pravý sidebar; levý navigační sidebar zůstává součástí shellu
  - nahoře je sjednocený blok `Dnešní provoz`, který v jednom cardu spojuje datum, dominantní počet dnešních rezervací, další klientku a hlavní CTA `Otevřít dnešní plán / Přidat termín / Detail rezervace`
  - součástí hero bloku je i kompaktní sekce `Dnešní úkoly`, která shrnuje pending potvrzení, další klientku, dnešní volná okna a chybné e-maily
  - pokud existují čekající potvrzení, dashboard je ukáže jako výrazný akční alert nad dnešním plánem; bez pending stavu zůstávají alerty menší a sekundární
  - `Dnešní plán` je hlavní pracovní sekce: používá mini timeline s výrazným časem vlevo, odlišením `Rezervace / Volné okno`, hover/focus stavy, click-to-open řádky a rychlé akce přímo v každé položce
  - rychlé akce rezervací používají stejné existující admin server actions jako seznam rezervací (`Potvrdit`, `Zrušit`, `Otevřít`) a po úspěchu ukazují lehký toast
  - pravý sidebar je zjednodušený jen na `Nejbližší volné sloty` a `Rychlé akce`; primární CTA je vždy `Vytvořit rezervaci`
  - spodní KPI už neopakují počet dnešních rezervací; zůstávají jen sekundární metriky `Dnes volná okna`, `Týdenní obsazenost`, `Týden volné sloty`, `Chybné e-maily`
  - na mobilu dashboard přepíná do jednoho svislého proudu: hero, alerty, timeline, rychlé akce a až potom méně důležité KPI
  - overview používá server-rendered Suspense fallback se skeletonem, takže při načítání nepůsobí jako prázdná stránka
- Sekce `Rezervace` je nyní přepracovaná jako kompaktní pracovní seznam na `/admin/rezervace` a `/admin/provoz/rezervace`:
  - místo vysokých karet používá hustý řádkový grid se sloupci `Rezervace`, `Čas`, `Status`, `Zdroj`, `Kontakt`, `Akce`
  - každá rezervace drží klientku + službu a datum + čas ve dvou krátkých řádcích bez zbytečné výšky
  - na mobilu se každá položka skládá do dvousloupcové karty s názvem přes celou šířku, přehlednými metadaty a plnošířkovým footerem pro akce
  - horní statistiky jsou zmenšené do jedné souhrnné řady místo velkých karet
  - hlavička seznamu zůstává sticky při scrollu, takže jsou sloupce stále čitelné
  - přímo v řádku jsou rychlé akce `Potvrdit`, `Zrušit` a `Otevřít`; na menších šířkách fungují jako plný footer pod řádkem a od `lg` výše mají úsporný vlastní sloupec s kompaktnější kapslí
  - sloupec `Status` je centrovaný jako samostatný grid item, aby badge seděly přesně pod hlavičku
  - `Zrušená` rezervace má ve sloupci `Status` jen lehce červený tón pro rychlé rozpoznání
  - stav se zobrazuje přes barevné badge, aby bylo na první pohled vidět, co čeká, co je hotové a co je zrušené
  - sloupec `Zdroj` kombinuje provozní původ rezervace (`Web`, `Telefon`, ...) a akviziční zdroj (`Google`, `Facebook`, `Instagram`, `Firmy.cz/Seznam`, `Direct`, `Other`), pokud je dostupný
  - toolbar nově obsahuje CTA `Přidat rezervaci`, které pro `OWNER` i `SALON` otevírá pravý drawer pro plnohodnotné ruční vytvoření rezervace
  - ruční rezervace stále vzniká jako běžný `Booking`; používá stejnou doménovou create logiku jako veřejný booking a ukládá jen doplňková metadata `source`, `isManual`, `manualOverride`, `createdByUserId`
  - drawer umí vyhledat nebo propojit existující klientku podle jména, telefonu i e-mailu, případně rovnou založit novou
  - termín lze založit buď ze slotů respektujících veřejnou dostupnost, nebo ručně přes datum a čas; pokud ruční čas neleží ve veřejné dostupnosti, systém upozorní na interní výjimku a uloží ji auditovaně
  - sticky footer nabízí `Vytvořit rezervaci` a `Vytvořit a poslat potvrzení`; při odeslání e-mailu se používá stejné email/log/ICS flow jako u běžných rezervací
- Sekce `Klienti` je nyní produkčně použitelná pro obě role na `/admin/klienti`, `/admin/provoz/klienti` a v detailu na `/admin/klienti/[clientId]`, `/admin/provoz/klienti/[clientId]`:
  - seznam podporuje hledání přes jméno, e-mail, telefon i interní poznámku
  - filtry umí omezit aktivní/neaktivní profily a přepnout řazení podle poslední návštěvy, počtu rezervací, jména nebo vytvoření
  - detail klientky ukazuje kontakty, poslední a budoucí termín, nejčastější službu a posledních 10 rezervací
  - interní poznámka se upravuje přímo v detailu klientky a po uložení se propisuje do obou admin oblastí
- Sekce `Uživatelé / role` je nyní vyhrazená jen pro `OWNER` na `/admin/uzivatele`:
  - obrazovka je rozdělená na hlavní blok `Uživatelé` a vedlejší read-only blok `Role a oprávnění`
  - systém používá pouze dvě role `OWNER` a `SALON`; neexistuje žádná role `ADMIN`
  - každý přístup ukazuje jméno, e-mail, roli, stav účtu, krátký helper text a dostupné akce
  - stavy účtu jsou `Aktivní`, `Pozvánka čeká`, `Deaktivovaný` a `Systémový účet`
  - systémové přístupy z env se v UI zobrazují pouze jako `Systémový účet` a zůstávají read-only bez technických detailů
  - owner může u databázových účtů založit pozvánku, upravit jméno a e-mail, přepnout roli, deaktivovat nebo znovu aktivovat účet a otevřít detail
  - akce `Pozvat uživatele` i `Znovu poslat pozvánku` odesílají reálný e-mail přes SMTP vrstvu
  - pozvánka vede na route `/admin/pozvanka/[token]`, kde si uživatel nastaví heslo a dokončí aktivaci přístupu
  - pokud SMTP dočasně selže, přístup se i tak uloží a UI zobrazí, že e-mail nebylo možné doručit

## Média a obrázky
- Lokální filesystem adapter je v `src/lib/media/*`.
- Sdílená feature service pro budoucí owner/salon upload workflow je v `src/features/media/lib/media-library.ts`.
- Metadata se ukládají do tabulky `MediaAsset`, zatímco binární soubor zůstává na filesystemu.
- Podporované typy jsou aktuálně obrázky `jpg`, `jpeg`, `png`, `webp`.
- Maximální velikost souboru je 8 MB.
- Každý upload dostane krátký generovaný identifikátor a ukládá se jako `{id}-original.<ext>`, `{id}-optimized.<ext>` a `{id}-thumbnail.<ext>` bez použití původního názvu souboru.
- Relativní storage path má tvar `certificates/2026/04/<id>-original.<ext>`; další typy používají kořeny `spaces/`, `portraits/`, `portraits-home/`, `portraits-about/` nebo `general/`.
- Publikace je řízená jen přes `MediaAsset.isPublished`; nové uploady se nepřesouvají mezi `public/private`.
- Modul `Média webu` má první produkční napojení:
  - admin upload, editaci a mazání přes `/admin/media` a `/admin/provoz/media`
  - typy `CERTIFICATE`, `SALON_PHOTO`, `PORTRAIT_HOME`, `PORTRAIT_ABOUT`, `PORTRAIT` (legacy fallback) a `GENERAL`
  - admin UI je záměrně kompaktní pracovní nástroj: krátký header, 4 rychlé statistiky, upload panel s dropzónou, tabs s počty a hustší grid karet
  - každá karta média ukazuje náhled, titulek nebo soubor, typ, publish stav, rozměry, velikost a zřetelné `Použití` + `Sekce`
  - publish/unpublish jde přímo z karty bez otevírání editace; detailní změny zůstávají v kompaktním dialogu
  - prázdná knihovna i prázdné filtry mají vlastní CTA zpět na upload panel
  - veřejné zobrazení certifikátů v sekci `Certifikace` na stránce `/o-mne`
  - veřejné zobrazení publikovaných fotek studia na stránce `/studio`
  - backend napojený na `createMedia()`, `listMedia()`, `updateMedia()` a `deleteMedia()`
  - stránka `/o-mne` bere pouze `MediaType.CERTIFICATE` a `isPublished = true`
  - stránka `/studio` bere pouze `MediaType.SALON_PHOTO` a `isPublished = true`

## Provoz a zálohy
- Zálohuj databázi i upload root; jedna bez druhé nestačí pro úplnou obnovu médií.
- Při deployi se upload root nemaže ani nepřegenerovává, protože není součástí build artefaktů.
- Pokud upload začne selhávat, první kontrola má být:
  - existence cesty z `MEDIA_STORAGE_ROOT`
  - práva procesu k zápisu
  - dostupnost veřejné URL `/media/public/*` nebo legacy `/media/*`
  - Služby
  - Kategorie služeb
- Sekce `Služby` je nyní provozně použitelná pro obě role na `/admin/sluzby` a `/admin/provoz/sluzby`:
  - seznam nově funguje jako rychlá pracovní plocha: fulltext, filtr stavu, veřejné rezervace, kategorie a řazení
  - v kartách jsou rychlé akce `aktivovat/deaktivovat`, `veřejná/interní`, `duplikovat` a jednoduché posuny v pořadí
  - každá karta ukazuje provozní kontext, stavové badge a upozornění na problematické stavy
  - formulář podporuje `Uložit` i `Uložit a zavřít` a novou službu lze založit přes jasné CTA `Nová služba`
  - při přepnutí mezi službami se detail vždy přenačte podle skutečně vybrané položky (nepřebírá hodnoty z předchozí karty)
  - v detailu služby je jediný obsahový blok `Veřejná prezentace`; pole `Veřejný úvod` je zdrojem textu pro web i rezervační krok výběru služby, takže se stejný text neudržuje duplicitně
  - detail se otevírá jako pravý overlay drawer (desktop i mobil), takže seznam zůstává viditelný v pozadí a obsluha neztrácí kontext
  - skutečná změna ceny v detailu služby zapisuje audit do `ServicePriceChangeLog`, takže lze dohledat původní i novou cenu, čas a admin aktéra
  - detail služby zároveň ukazuje sekci `Historie ceny` s posledními auditními změnami, takže není nutné kvůli běžnému dohledání chodit přímo do databáze
  - veřejný booking flow bere službu jen pokud je `isActive = true`, `isPubliclyBookable = true` a její kategorie je aktivní
- Sekce `Kategorie služeb` je nyní produkčně použitelná pro obě role na `/admin/kategorie-sluzeb` a `/admin/provoz/kategorie-sluzeb`:
  - horní přehled používá kompaktní souhrnnou lištu místo vysokých stat karet
  - seznam kategorií je hustší a víc provozně orientovaný: název, pořadí, kontext služeb, stav badge, toggle a akce jsou na jednom řádku
  - detail se otevírá jako pravý overlay drawer (desktop i mobil), takže je možné rychle procházet kategorie bez skákání mezi stránkami
  - nahoře jsou 4 stat karty (`Aktivní`, `Kategorie se službami`, `Prázdné`, `Potřebují pozornost`) a filtry s chipy `Prázdné`, `Bez veřejné služby`, `S upozorněním`
  - seznam ukazuje název, pořadí, aktivitu, počet všech služeb i kontext aktivních a veřejných služeb
  - problémové kategorie mají zvýrazněný warning stav a jemně odlišený border
  - přímo v seznamu jsou rychlé akce `aktivovat/deaktivovat`, `otevřít detail`, `zobrazit služby` a posuny v pořadí
  - přepnutí aktivního stavu a posun v pořadí probíhá okamžitě optimistic UI přes server action bez reloadu
  - editor umožňuje upravit název, volitelný popis, pořadí a aktivní stav; kategorie už nemá samostatný `Veřejný název`, web i ceník vždy používají `Název kategorie`
  - detail dál nabízí CTA `Vytvořit službu` a `Otevřít služby této kategorie`
  - novou kategorii lze založit přes jasné CTA `+ Nová kategorie`; editace i create běží ve stejném pravém drawer flow
  - mazání je povolené jen pro prázdné kategorie bez služeb; jinak je doporučené kategorii pouze vypnout
  - změna pořadí nebo aktivity se promítá do adminu, veřejných výpisů `/sluzby` a `/cenik` i do veřejného booking flow
- Sekce jen pro `OWNER`:
  - Uživatelé / role
  - Email logy
  - Nastavení
- Sekce `Nastavení` je nyní produkčně použitelná pro `OWNER` na `/admin/nastaveni`:
  - blok `Salon` spravuje název salonu, adresu, telefon, kontaktní e-mail a Instagram
  - blok `Rezervace` drží jen skutečně globální booking pravidla: minimální předstih, horizont dopředu a storno limit pro self-service storno
  - blok `E-maily a notifikace` spravuje admin notifikační e-mail, sender name, sender email a krátkou patičku potvrzovacích e-mailů
  - formuláře mají jednotný footer se stavem ukládání, kratší popisky a mobilní rozložení, aby šly snadno používat i na telefonu
  - nahoře je malý orientační blok, který rychle vysvětlí, co do které části patří
  - technické SMTP údaje, app URL a session secret zůstávají správně mimo admin v env
- Tón admin obrazovek je záměrně jednotný: klidný, krátký a ne-technický, aby se v něm obsluha zbytečně neztrácela.
- Lite provozní menu je záměrně kratší a drží jen to, co recepce a tým potřebují nejčastěji:
  - Přehled
  - Dnešní rezervace
  - Termíny
  - Klientky
  - Nabídka
  - Kategorie služeb
- Levý sidebar zůstává i po redesignu dashboardu záměrně úzký; když budeš upravovat shell spacing, priorita je ponechat co nejvíc šířky pro operativní obsah, ne pro dekorativní chrome.
- Detail rezervace je nyní dostupný jak pro `OWNER`, tak pro `SALON`:
  - `OWNER` na `/admin/rezervace/[bookingId]`
  - `SALON` na `/admin/provoz/rezervace/[bookingId]`
  - nahoře používá kompaktní sticky header s návratem do seznamu, termínem, badge stavu, zdrojem a rychlými kontaktními akcemi
  - pod hlavičkou je jeden kompaktní souhrn místo více podobných boxů se stejnými daty
  - hlavní blok `Akce s rezervací` drží dostupné změny stavu a krátký stavový kontext bez dlouhých odstavců
  - poznámky jsou rozdělené na klientskou a interní; interní poznámku lze uložit samostatně i bez změny statusu
  - historie změn zůstává dole jako hustší časová osa se stavem, aktérem, časem a dostupným zdrojem změny
- Správa slotů je nyní produkčně použitelná pro obě role:
  - týdenní planner na `/admin/volne-terminy` a `/admin/provoz/volne-terminy`
  - route `novy`, `detail` a `upravit` zůstávají zachované, ale vrací zpět do planneru ve správném týdnu
- Slot workflow podporuje:
  - plánování po týdnech s hlavní plochou po dnech a 30min buňkách v pracovním okně `06:00-20:00`
  - kliknutím výběr konkrétního bloku a tažením přidání nebo odebrání dostupnosti přímo v mřížce
  - automatické sloučení sousedních půlhodin do souvislých intervalů `AvailabilitySlot`
  - pravý akční inspektor dne s denním souhrnem, rychlými akcemi a detailem výběru z gridu
  - denní rychlé akce `zkopírovat den`, `nastavit den jako zavřeno`, `obnovit den z publikovaného stavu`
  - spodní sticky bar pro `Zahodit` a `Publikovat změny`
  - týdenní rychlé akce `zkopírovat týden na další` a lokální šablonu týdne uloženou v zařízení
  - zobrazení rezervací, omezených intervalů, neaktivních slotů a minulého času
  - server-side ochranu proti zásahu do rezervací, omezených slotů a překryvům

## Stav Sekce Volné Termíny
- K datu `19. dubna 2026` je sekce `/admin/volne-terminy*` a `/admin/provoz/volne-terminy*` znovu aktivní jako týdenní planner.
- Hlavní práce probíhá jen přes týdenní kalendář; samostatný formulář pro běžnou úpravu dostupnosti už není potřeba.
- Aktuální podoba adminu dává prioritu mřížce týdne; levý sidebar je užší a mobil používá drawer pro navigaci.
- Pravý panel funguje jako akční inspektor; na mobilu se otevírá jako spodní sheet, aby grid zůstal hlavní pracovní plochou.
- 30min mřížka slouží jen jako editace v admin UI. Do databáze se ukládají souvislé intervaly `startsAt`-`endsAt`, aby zůstala kompatibilita s veřejným booking flow i delšími službami.
- Neuložené změny se drží lokálně jako koncept týdne pro dané zařízení a týden; do databáze se propíšou až přes akci `Publikovat změny`.
- Planner přímo neupravuje sloty, které už obsahují rezervace, omezení služeb, poznámky nebo jinou kapacitu než `1`; takové intervaly jsou v kalendáři vidět jako omezené a zůstávají chráněné.
- Za „obsahují rezervace“ se počítají i historické vazby (`CANCELLED`, `COMPLETED`, `NO_SHOW`), protože slot s navázaným booking záznamem nejde mazat přes FK `Booking.slotId -> AvailabilitySlot.id`.
- Výchozí týden v planneru je počítaný nad lokálním datem `Europe/Prague`, takže týden vždy začíná pondělím i kolem časových posunů.
- Při bootstrap přihlášení (`ADMIN_OWNER_*`, `ADMIN_STAFF_*`) se autor změny dostupnosti ukládá jen pokud existuje odpovídající záznam v tabulce `AdminUser`; jinak se použije `createdByUserId = null`, aby změna nespadla na FK.
- Z detailu rezervace lze bezpečně změnit stav pouze v povolených krocích:
  - `PENDING -> CONFIRMED`
  - `CONFIRMED -> COMPLETED`
  - `PENDING/CONFIRMED -> CANCELLED`
  - `CONFIRMED -> NO_SHOW`
- Volba akce v bloku `Změna stavu` je řešená přes klikací karty místo selectu; aktivní karta je barevně zvýrazněná podle typu akce (potvrzení zeleně, zrušení červeně), aby obsluha hned viděla, co je vybrané.
- Blok `Změna stavu` nově předvybírá nejčastější další krok a pod výběrem ukazuje krátké shrnutí dopadu akce, takže je menší riziko chybného uložení ve spěchu.
- Každá změna stavu z detailu zapisuje položku do `BookingStatusHistory` včetně admin aktéra, důvodu a poznámky.
- Aby se owner sekce `Email logy` neopírala o ručně zastaralý Prisma klient, `npm run dev` i `npm run build` si nyní předem samy spouštějí `prisma generate`.
- Ochrana není řešená jen skrytím položek v menu:
  - `proxy.ts` dál blokuje nepřihlášené vstupy
  - server-side guard helpery kontrolují oprávnění každé admin route
  - nedovolený vstup se přesměruje na domovskou admin stránku role nebo skončí `notFound` pro neplatnou sekci
- Owner a salon route soubory nyní používají sdílené factory wrappery (`src/features/admin/lib/admin-route-factories.tsx`), takže URL i oprávnění zůstávají stejné, ale logika není duplikovaná.
- Admin shell byl vizuálně zpevněný pro provozní použití:
  - širší sidebar na desktopu a sticky navigace při scrollu
  - hlavní obsah má ochranu proti horizontálnímu přetečení (`min-w-0`, `overflow-x-clip`)
  - hlavičky a metriky v admin kartách mají responzivní velikosti pro menší šířky

## Datový Model Rezervací
- `AvailabilitySlot` je hlavní entita dostupnosti a nese časový interval, stav, kapacitu a interní/veřejné poznámky.
- Admin CRUD slotů nepoužívá pevnou otevírací dobu; každý slot se zakládá ručně jako samostatný časový interval.
- `AvailabilitySlot` má explicitní `serviceRestrictionMode`, takže je zřejmé, zda slot přijímá jakoukoli službu nebo jen vybrané služby.
- `AvailabilitySlotService` umožňuje slot omezit jen na konkrétní služby, když je `serviceRestrictionMode = SELECTED`.
- Server-side slot validace navíc hlídá:
  - `endsAt > startsAt`
  - kapacitu minimálně `1`
  - kolizi s jiným aktivním slotem ještě před zápisem
  - zákaz snížení kapacity pod počet aktivních rezervací
  - zákaz výběru služeb, které by rozbily už navázané aktivní rezervace
- Kategorie a služby jsou samostatné DB entity, které se dnes plní přes import nebo admin správu, ne přes hardcoded seed.
- `Service.isPubliclyBookable` odděluje interně aktivní službu od služby skutečně nabízené ve veřejné rezervaci.
- `Booking` drží snapshot klienta, služby i času, takže pozdější změny ceníku nebo názvů služeb nepoškodí historická data.
- `Booking` drží metadata posledního přesunu (`rescheduledAt`, `rescheduleCount`) a reminder queue stav (`reminder24hQueuedAt`, `reminder24hSentAt`); historický self-relation chain zůstává jen jako legacy pole a nové reschedule flow ho nepoužívá.
- `BookingRescheduleLog` je samostatná auditní tabulka pro přesuny termínu s původním a novým intervalem, aktérem a volitelným důvodem změny.
- `Booking.reminder24hSentAt` drží informaci, že klientský 24h reminder už byl úspěšně uzavřený; `Booking.reminder24hQueuedAt` zase brání duplicitnímu enqueue stejného reminderu pro aktuální termín.
- `Booking` nově ukládá i akviziční metadata (`acquisitionSource`, `acquisitionReferrerHost`, `acquisitionUtmSource`, `acquisitionUtmMedium`, `acquisitionUtmCampaign`) odvozená z `utm_*` a referrer hostu.
- `BookingStatusHistory` slouží jako audit změn stavu a rozlišuje akci uživatele, klienta nebo systému.
- `ServicePriceChangeLog` je samostatná auditní tabulka pro změny `Service.priceFromCzk`; ukládá starou a novou cenu, aktéra a čas změny.
- Admin detail rezervace zobrazuje historii změn jako provozní timeline, takže salon i owner vidí, kdo a kdy stav upravil.
- `BookingActionToken` ukládá pouze hash tokenu pro storno a přesun termínu, nikdy ne surovou hodnotu tokenu.
- Klientský manage flow `/rezervace/sprava/[token]` přijímá jen hashovaný token typu `RESCHEDULE`; bez validního tokenu neukáže žádná data rezervace.
- `EmailLog` umožňuje trasovat odeslané i neúspěšné e-maily navázané na klienta, rezervaci a případný token.
- Owner-only sekce `Email logy` nyní funguje jako business-first přehled `Komunikace se zákaznicemi`:
  - nahoře ukazuje health stav `OK / Warning / Error` podle failed, retry, pending fronty a poslední relevantní chyby
  - krátké metriky shrnují `Dnes odesláno`, `Za posledních 7 dní`, `Čeká na odeslání`, `Selhalo` a `Poslední odeslání`
  - hlavní sekce `Poslední emaily` propojuje typ zprávy, stav, příjemce, vazbu na rezervaci, časy, pokusy a rychlé akce `Otevřít rezervaci / Detail emailu / Zkusit znovu`
  - tracking sloupce `Otevřeno` a `Kliknuto` jsou připravené jako UI placeholder bez falešných dat
  - původní pending/retry/error fronty zůstávají níž v debug bloku `Technický stav fronty`
- Detail konkrétního e-mailu na `/admin/email-logy/[emailLogId]` je nově business-first:
  - nahoře ukazuje výrazný header s názvem emailu, jedním finálním stavem `Odesláno / Čeká / Retry / Selhalo`, příjemcem, klientkou, rezervací a klíčovým časem `Odesláno / Poslední pokus`
  - hned pod headerem drží rychlé akce `Zpět na přehled`, `Otevřít rezervaci`, případně `Zkusit znovu` nebo `Uvolnit zaseknutý job`
  - pravý sloupec tvoří kompaktní souhrn `Typ emailu / Šablona / Příjemce / Provider / Poslední pokus / Odesláno / Počet pokusů`
  - levý sloupec drží navázané entity `Rezervace / Klientka / Token akce`; token je defaultně maskovaný a plně se ukáže až po kliknutí na `Zobrazit`
  - payload, provider metadata a raw debug data jsou až dole v rozbalovacím bloku `Technické detaily`, defaultně zavřeném, s dalším rozbalením `Zobrazit citlivá data`
  - pokud existuje chyba, detail ukáže nejdřív stručný čitelný popis a až pak rozbalitelný technický detail chyby
- Po úspěšné akci se na detailu objeví krátká potvrzovací hláška, aby bylo zřejmé, že operace proběhla.
- Veřejný booking flow po odeslání:
  - veřejný web `/`, `/sluzby`, `/cenik` a detail služby nyní čerpá z databáze v request-time
  - admin změny se do něj promítnou bez rebuildů
  - globální booking pravidla čte ze `SiteSettings`, ne z natvrdo zapsaných konstant
  - znovu validuje službu a termín server-side
  - naváže nebo vytvoří klienta podle e-mailu
  - vytvoří rezervaci se stavem `PENDING` (čeká na schválení) a se snapshotem služby a času
  - k veřejné rezervaci uloží i akviziční zdroj z cookie trackeru (`ppstudio-booking-acq`)
  - zapíše audit změny stavu
  - připraví storno token a e-mailový log s informací o přijetí rezervace
  - uloží e-mail jako `PENDING` v background režimu nebo `SENT` v log režimu
- Confirmation screen a klientské booking e-maily sdílejí stejnou obsahovou hierarchii:
  - jasný stav rezervace
  - dominantní karta `služba / datum / čas`
  - místo `PP Studio, Sadová 2, 760 01 Zlín`
  - akce mimo informační copy a bez dominantního storna
  - kontakt až jako spodní podpůrná sekce, pouze jednou
- 24h reminder e-mail je úsporný: služba, datum, čas, místo, sekce `Potřebujete změnu?`, sekundární akce `Změnit termín` / `Zrušit rezervaci` a jednorázový kontakt.
- Referenční kód rezervace už se v klientské komunikaci nezobrazuje; pro změnu nebo storno se používají konkrétní tokenizované odkazy a textové shrnutí služby s termínem.
- Pokud se termín mezitím obsadí, služba přestane být aktivní nebo slot přestane odpovídat délce služby, uživatel dostane konkrétnější chybu místo obecného selhání.
- Veřejný submit je lehce rate-limitený podle IP a e-mailu; opakované pokusy v krátkém čase skončí blokací s user-friendly hláškou.
- Krok 2 už skrývá i sloty, které jsou pro vybranou službu příliš krátké.
- Server při odeslání rezervace navíc kontroluje i zvolený `startsAt`, takže klientka nemůže odeslat čas mimo hranice slotu ani čas kolidující s už existující rezervací.
- Pokud rezervace obsadí jen část delšího slotu s kapacitou `1`, systém slot interně rozdělí na rezervovaný úsek a samostatné volné zbytky, takže v admin planneru lze s volnými částmi dál pracovat po blocích.
- `/rezervace/storno/[token]` je produkční self-service storno stránka:
  - ověří hash tokenu server-side
  - zobrazí bezpečný potvrzovací krok
  - po potvrzení zruší rezervaci a zapíše audit, ale jen pokud rezervace ještě splňuje globální storno limit ze settings
  - uloží storno potvrzení do `EmailLog` pro worker nebo do `SENT` v log režimu
- `/rezervace/sprava/[token]` je produkční self-service změna termínu:
  - ověří hash tokenu typu `RESCHEDULE` server-side
  - ukáže službu, aktuální datum, čas ve formátu `13:30 – 14:00` a stav rezervace
  - nabídne jen veřejně dostupné nové časy pro stejnou službu a délku
  - primárně zobrazuje nejbližší dostupné dny jako větší klikatelné chips a sekundárně kalendář se zvýrazněnými dny s dostupností
  - po výběru dne zobrazí jen sloty pro tento den a po výběru času plynule posune klientku na potvrzení
  - storno je až na konci stránky jako slabý textový odkaz, aby nekonkurovalo změně termínu
  - online změnu zablokuje při zrušené/uzavřené rezervaci, neplatném tokenu nebo méně než `bookingCancellationHours` před termínem
  - po potvrzení volá stejné `rescheduleBooking(...)` jako admin detail a do historie zapisuje `changedByClient = true`

## Řešení Problémů (Troubleshooting)
- Pokud se rezervace přesune, ale klientce nepřijde e-mail o změně termínu:
  - zkontrolujte v admin sekci `Email logy`, jestli vznikl záznam `BOOKING_RESCHEDULED`
  - pokud log nevznikl, hledejte v server logu chybu `Booking reschedule notification enqueue failed`
  - samotný přesun termínu i auditní historie zůstávají uložené, protože e-mail se zakládá až po úspěšném commitnutí změny rezervace
- Pokud po přesunu nevzniká nový 24h reminder:
  - ověřte, že booking má po přesunu `reminder24hQueuedAt = null` a `reminder24hSentAt = null`
  - spusťte `npm run email:worker:once`
  - zkontrolujte, že nový termín leží v reminder okně `25h-26h` od aktuálního času
- Pokud worker selhává na chybě `Invalid input: expected string, received undefined` s cestou `manageReservationUrl`:
  - jde typicky o starší `EmailLog.payload`, který pole `manageReservationUrl` ještě neobsahuje
  - aktuální renderer je backward-compatible a e-mail odešle i bez tohoto pole, jen bez CTA `Změnit termín`
  - pokud chyba přetrvává, restartujte worker a ověřte, že běží nová verze aplikace
- Pokud se v adminu změnila cena služby a potřebujete dohledat, kdo zásah provedl:
  - ověřte, že je nasazená migrace `20260424103000_service_price_change_log_v1`
  - hledejte záznam v `ServicePriceChangeLog` podle `serviceId` a času změny
  - historické rezervace zůstanou konzistentní, protože `Booking` dál drží vlastní `servicePriceFromCzk` snapshot
- Pokud `/admin/sluzby` v devu vrací odpověď velmi pomalu a browser hází `ChunkLoadError` na Turbopack chunks:
  - ověřte, že list view bez `serviceId` nenačítá detail služby
  - ověřte, že seznam služeb načítá jen sloupce potřebné pro list
  - ověřte, že stavové metriky běží přes jeden agregační dotaz (`groupBy`) místo více samostatných `count`
- Chyba `Route "... " used params.slug. params is a Promise` v Next.js 16 znamená, že route používá starý synchronní přístup k dynamickým parametrům.
- Oprava:
  - v `page.tsx` a `generateMetadata` typuj `params` jako `Promise<{ ... }>`
  - nejdřív proveď `const { slug } = await params` (nebo odpovídající pole)
  - až potom parametr použij v DB dotazech nebo renderu
- Referenční implementace v projektu: [`src/app/(public)/sluzby/[slug]/page.tsx`](/var/www/ppstudio/src/app/(public)/sluzby/[slug]/page.tsx).

## Provozní Poznámky
- `proxy.ts` filtruje nepřihlášené požadavky na `/admin/*`.
- Finální autorizace probíhá server-side v admin layoutu a stránkách.
- Prisma klient používá singleton pattern pro vývoj i produkci.
- Databáze blokuje překrývající se aktivní sloty přes PostgreSQL exclusion constraint.
- Sloty s historickými rezervacemi nemažeme ani když už nejsou aktivní; pro zachování auditní stopy se místo toho archivují.
- Po každé změně Prisma schematu je potřeba spustit alespoň `npm run db:generate`; při změně struktury DB i `npm run db:migrate`.
- Technické SEO minimum je nyní pokryté přes globální metadata, `robots.ts` a `sitemap.ts`.
- Produkční `robots.txt` pouští crawl celého veřejného webu přes `Allow: /`; neveřejné admin a tokenové routy zůstávají blokované, aby se neindexovaly citlivé odkazy.
- Root metadata branding (`applicationName`, title template a OpenGraph `siteName`) se načítá z `SiteSettings.salonName`; canonical URL base zůstává technicky na `NEXT_PUBLIC_APP_URL`.
- Veřejné čtení `SiteSettings` už při renderu nezapisuje do DB; pokud singleton dočasně chybí nebo DB read selže, veřejný web a e-mailové šablony použijí bezpečné defaulty a bootstrap zápis zůstává jen v owner admin sekci `Nastavení`.
- Rezervační část má vlastní error boundary a loading fallback, takže výpadek booking vrstvy nepoškodí celý web.
- Background e-mail worker lze spustit přes `npm run email:worker` jako samostatný proces; pro jednorázové dohnání fronty je k dispozici `npm run email:worker:once`.
- Stejný `email:worker` nově každých 5 minut i skenuje potvrzené rezervace v okně `25h-26h` před termínem a zapisuje jeden reminder `EmailLog` typu `BOOKING_REMINDER`.
- Po přesunu termínu resetuje doménová akce `rescheduleBooking(...)` oba reminder markery, takže se starý reminder neposílá pro původní termín a nový čas může znovu projít standardním enqueue flow.
- Před produkční aplikací migrací je k dispozici `npm run db:check-migrations`, který odhalí otevřené failed/incomplete záznamy v `_prisma_migrations`.
- Pro systemd provoz použij [`deploy/systemd/ppstudio-web.service`](/var/www/ppstudio/deploy/systemd/ppstudio-web.service) pro hlavní app a [`deploy/systemd/ppstudio-email-worker.service`](/var/www/ppstudio/deploy/systemd/ppstudio-email-worker.service) pro worker.
- Systemd `.example` šablony s poznámkami k `User`/`Group` jsou v [`deploy/systemd/ppstudio-web.service.example`](/var/www/ppstudio/deploy/systemd/ppstudio-web.service.example) a [`deploy/systemd/ppstudio-email-worker.service.example`](/var/www/ppstudio/deploy/systemd/ppstudio-email-worker.service.example).
- Jednorázová instalace obou units je připravená v [`deploy/deploy.sh`](/var/www/ppstudio/deploy/deploy.sh).
- Pro Docker Compose provoz použij [`deploy/docker-compose.email-worker.yml`](/var/www/ppstudio/deploy/docker-compose.email-worker.yml).

## Týdenní Planner Dostupností
- Desktop používá klasický týdenní grid se 7 dny a 30min řádky v rozsahu `06:00-20:00`.
- Mobil drží týdenní režim přes přehled sedmi dnů a jeden editační panel vybraného dne.
- Základní význam barev:
  - zelená = běžná dostupnost
  - růžová = rezervace
  - písková = omezený interval, který nejde měnit přímo z planneru
  - šedá = neaktivní slot
  - tmavší podklad = minulý čas
- Kliknutí nebo tažení přes prázdné buňky dostupnost přidá.
- Kliknutí nebo tažení přes zelené buňky dostupnost odebere nebo zkrátí.
- Při ukládání se sousední půlhodiny automaticky sloučí do co nejmenšího počtu souvislých intervalů.
- Planner nikdy nepřepisuje rezervace ani technicky složitější sloty; pokud by změna zasáhla do chráněného úseku, vrátí srozumitelnou chybu.
