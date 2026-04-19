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
- Veřejná část aktuálně pokrývá:
  - homepage
  - služby a detail služby
  - ceník
  - o salonu
  - kontakt
  - FAQ
  - storno podmínky
  - obchodní podmínky
  - GDPR
- Veřejný obsah je centralizovaný v `src/content/public-site.ts`, aby šly texty, ceny a foto briefy měnit bez zásahu do layout komponent.
- Rezervační vrstva stojí na ručně vypisovaných termínech přes `AvailabilitySlot`, ne na pevné otevírací době.
- Admin má dva směry použití:
  - full admin na `/admin/*` pro roli `OWNER`
  - lite admin na `/admin/provoz/*` pro roli `SALON`
- Obě rozhraní sdílejí stejné doménové entity, ale liší se navigací i hustotou UI:
  - `OWNER` vidí strategické a technické sekce navíc
  - `SALON` vidí jen provozní sekce a jednodušší copy bez technických pojmů
- Prisma schema v1 už pokrývá:
  - admin uživatele a role
  - kategorie služeb a služby včetně samostatné veřejné rezervovatelnosti
  - sloty s omezením na vybrané služby
  - klienty, rezervace a historii stavů
  - e-mailové logy, action tokeny a settings

## Lokální Spuštění
```bash
npm install
cp .env.example .env
npm run db:generate
npm run dev
```

Pokud databáze ještě neobsahuje schema nebo přibyly nové migrace:

```bash
npm run db:migrate
```

### Lokální vývoj z jiného zařízení v LAN
- Next.js 16 v dev režimu blokuje cross-origin přístup k dev assetům a HMR endpointům, pokud origin výslovně nepovolíš.
- Projekt proto v `next.config.ts` povoluje `allowedDevOrigins` pro lokální host `192.168.0.143`, aby šel dev server otevřít i z jiného zařízení v domácí nebo interní síti.
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
  - `categories[]` s poli `name`, `slug`, `description`, `sortOrder`, `isActive`
  - `services[]` s poli `name`, `slug`, `categorySlug`, `durationMinutes`, `priceFromCzk`, `description`, `shortDescription`, `sortOrder`, `isActive`
- Pokud starý web exportuje data v jiném formátu, je potřeba je před importem namapovat do této struktury.
- Pro tvoje aktuální kategorie je připravený vzor v `scripts/old-web-categories.json`.
- Pro tvoje aktuální služby je připravený vzor v `scripts/old-web-services.json`.

## Veřejný Web
- Navigace vede na klíčové konverzní a důvěryhodnostní stránky místo jedné přetížené homepage.
- Detail služby je staticky generovaný z centrálního katalogu služeb.
- `/rezervace` nyní obsahuje produkční V1 flow:
  - výběr služby
  - výběr ručně publikovaného termínu
  - kontaktní údaje klienta
  - souhrn a potvrzení
- Rezervační stránka je renderovaná dynamicky při requestu, takže nově publikované nebo obsazené sloty jsou vidět bez dalšího buildu.
- Placeholder obsah je záměrně označený a má být před spuštěním nahrazen:
  - finálním copywritingem
  - reálnými cenami a délkami služeb
  - autentickými kontakty
  - vlastními fotografiemi majitelky, interiéru a procedur
- CTA na rezervaci je dostupné v hlavičce, hero sekcích i obsahových blocích.

## Přihlášení Do Adminu
- Admin login je dostupný na `/admin/prihlaseni`.
- Pro bootstrap přihlášení se používají hodnoty:
  - `ADMIN_OWNER_EMAIL`
  - `ADMIN_OWNER_PASSWORD`
  - `ADMIN_STAFF_EMAIL`
  - `ADMIN_STAFF_PASSWORD`
- Env proměnné `ADMIN_STAFF_*` zatím bootstrapují lite admin účet, který se v databázi mapuje na roli `SALON`.
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
  - Služby
  - Kategorie služeb
- Sekce `Služby` je nyní provozně použitelná pro obě role na `/admin/sluzby` a `/admin/provoz/sluzby`:
  - responzivní seznam ukazuje název, kategorii, délku, cenu, aktivitu, veřejnou rezervovatelnost a pořadí
  - jednoduchý editor umožňuje upravit název, popisy, délku, cenu, kategorii, pořadí a oba publikační přepínače
  - veřejný booking flow bere službu jen pokud je `isActive = true`, `isPubliclyBookable = true` a její kategorie je aktivní
- Sekce `Kategorie služeb` je nyní produkčně použitelná pro obě role na `/admin/kategorie-sluzeb` a `/admin/provoz/kategorie-sluzeb`:
  - seznam ukazuje název, pořadí, aktivitu a počet navázaných služeb
  - editor umožňuje upravit název, volitelný popis, pořadí a aktivní stav
  - mazání je povolené jen pro prázdné kategorie bez služeb; jinak je doporučené kategorii pouze vypnout
  - změna pořadí nebo aktivity se promítá do adminu, veřejných výpisů `/sluzby` a `/cenik` i do veřejného booking flow
- Sekce jen pro `OWNER`:
  - Uživatelé / role
  - Email logy
  - Nastavení
- Lite provozní menu je záměrně kratší a drží jen to, co recepce a tým potřebují nejčastěji:
  - Přehled
  - Dnešní rezervace
  - Termíny
  - Klientky
  - Nabídka
  - Kategorie služeb
- Detail rezervace je nyní dostupný jak pro `OWNER`, tak pro `SALON`:
  - `OWNER` na `/admin/rezervace/[bookingId]`
  - `SALON` na `/admin/provoz/rezervace/[bookingId]`
- Správa slotů je nyní produkčně použitelná pro obě role:
  - týdenní planner na `/admin/volne-terminy` a `/admin/provoz/volne-terminy`
  - route `novy`, `detail` a `upravit` zůstávají zachované, ale vrací zpět do planneru ve správném týdnu
- Slot workflow podporuje:
  - plánování po týdnech s hlavní plochou po dnech a 30min buňkách v pracovním okně `06:00-20:00`
  - přidání i odebrání dostupnosti kliknutím nebo tažením přímo v mřížce
  - automatické sloučení sousedních půlhodin do souvislých intervalů `AvailabilitySlot`
  - denní rychlé akce `zkopírovat den`, `nastavit den jako zavřeno`
  - týdenní rychlé akce `zkopírovat týden na další` a lokální šablonu týdne uloženou v zařízení
  - zobrazení rezervací, omezených intervalů, neaktivních slotů a minulého času
  - server-side ochranu proti zásahu do rezervací, omezených slotů a překryvům

## Stav Sekce Volné Termíny
- K datu `19. dubna 2026` je sekce `/admin/volne-terminy*` a `/admin/provoz/volne-terminy*` znovu aktivní jako týdenní planner.
- Hlavní práce probíhá jen přes týdenní kalendář; samostatný formulář pro běžnou úpravu dostupnosti už není potřeba.
- 30min mřížka slouží jen jako editace v admin UI. Do databáze se ukládají souvislé intervaly `startsAt`-`endsAt`, aby zůstala kompatibilita s veřejným booking flow i delšími službami.
- Planner přímo neupravuje sloty, které už obsahují rezervace, omezení služeb, poznámky nebo jinou kapacitu než `1`; takové intervaly jsou v kalendáři vidět jako omezené a zůstávají chráněné.
- Výchozí týden v planneru je počítaný nad lokálním datem `Europe/Prague`, takže týden vždy začíná pondělím i kolem časových posunů.
- Při bootstrap přihlášení (`ADMIN_OWNER_*`, `ADMIN_STAFF_*`) se autor změny dostupnosti ukládá jen pokud existuje odpovídající záznam v tabulce `AdminUser`; jinak se použije `createdByUserId = null`, aby změna nespadla na FK.
- Z detailu rezervace lze bezpečně změnit stav pouze v povolených krocích:
  - `PENDING -> CONFIRMED`
  - `CONFIRMED -> COMPLETED`
  - `PENDING/CONFIRMED -> CANCELLED`
  - `CONFIRMED -> NO_SHOW`
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
- `Booking` navíc drží vazbu na předchozí rezervaci při reschedule a nepovoluje duplicitní booking stejného klienta do stejného slotu.
- `BookingStatusHistory` slouží jako audit změn stavu a rozlišuje akci uživatele, klienta nebo systému.
- Admin detail rezervace zobrazuje historii změn jako provozní timeline, takže salon i owner vidí, kdo a kdy stav upravil.
- `BookingActionToken` ukládá pouze hash tokenu pro storno a přesun termínu, nikdy ne surovou hodnotu tokenu.
- `EmailLog` umožňuje trasovat odeslané i neúspěšné e-maily navázané na klienta, rezervaci a případný token.
- Owner-only sekce `Email logy` je provozní observability obrazovka pro pending frontu, retry pokusy a poslední chyby workeru.
- Detail konkrétního e-mailu na `/admin/email-logy/[emailLogId]` ukazuje payload, poslední chybu, vazby na rezervaci a klientku a nabízí ruční retry nebo uvolnění zaseknutého jobu.
- Po úspěšné akci se na detailu objeví krátká potvrzovací hláška, aby bylo zřejmé, že operace proběhla.
- Veřejný booking flow po potvrzení:
  - veřejný web `/`, `/sluzby`, `/cenik` a detail služby nyní čerpá z databáze v request-time
  - admin změny se do něj promítnou bez rebuildů
  - znovu validuje službu a termín server-side
  - naváže nebo vytvoří klienta podle e-mailu
  - vytvoří rezervaci se snapshotem služby a času
  - zapíše audit změny stavu
  - připraví storno token a e-mailový log pro potvrzení
  - uloží e-mail jako `PENDING` v background režimu nebo `SENT` v log režimu
- Pokud se termín mezitím obsadí, služba přestane být aktivní nebo slot přestane odpovídat délce služby, uživatel dostane konkrétnější chybu místo obecného selhání.
- Veřejný submit je lehce rate-limitený podle IP a e-mailu; opakované pokusy v krátkém čase skončí blokací s user-friendly hláškou.
- Krok 2 už skrývá i sloty, které jsou pro vybranou službu příliš krátké.
- `/rezervace/storno/[token]` je produkční self-service storno stránka:
  - ověří hash tokenu server-side
  - zobrazí bezpečný potvrzovací krok
  - po potvrzení zruší rezervaci a zapíše audit
  - uloží storno potvrzení do `EmailLog` pro worker nebo do `SENT` v log režimu

## Provozní Poznámky
- `proxy.ts` filtruje nepřihlášené požadavky na `/admin/*`.
- Finální autorizace probíhá server-side v admin layoutu a stránkách.
- Prisma klient používá singleton pattern pro vývoj i produkci.
- Databáze blokuje překrývající se aktivní sloty přes PostgreSQL exclusion constraint.
- Sloty s historickými rezervacemi nemažeme ani když už nejsou aktivní; pro zachování auditní stopy se místo toho archivují.
- Po každé změně Prisma schematu je potřeba spustit alespoň `npm run db:generate`; při změně struktury DB i `npm run db:migrate`.
- Technické SEO minimum je nyní pokryté přes globální metadata, `robots.ts` a `sitemap.ts`.
- Rezervační část má vlastní error boundary a loading fallback, takže výpadek booking vrstvy nepoškodí celý web.
- Background e-mail worker lze spustit přes `npm run email:worker` jako samostatný proces; pro jednorázové dohnání fronty je k dispozici `npm run email:worker:once`.
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
