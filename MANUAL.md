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
  - kategorie služeb a služby
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
  - seznam a filtry na `/admin/volne-terminy` a `/admin/provoz/volne-terminy`
  - vytvoření na `/admin/volne-terminy/novy` a `/admin/provoz/volne-terminy/novy`
  - detail a editace na `/admin/volne-terminy/[slotId]` a `/admin/provoz/volne-terminy/[slotId]`
- Slot workflow podporuje:
  - filtrování podle dne a stavu slotu
  - rychlé filtry `dnešek`, `zítřek`, `tento týden`
  - vytvoření a editaci slotu
  - přepnutí stavu mezi `DRAFT`, `PUBLISHED`, `CANCELLED` a `ARCHIVED`
  - blokaci slotu bez smazání historie
  - smazání jen tehdy, když slot nemá žádnou navázanou rezervaci
- Formulář slotu nově obsahuje provozní UX pomůcky:
  - chytré defaulty času (zaokrouhlené na nejbližších 15 minut)
  - rychlé přepínače délky (`+30`, `+60`, `+90`, `+120 min`)
  - výběr služeb se zobrazuje jen v režimu `Jen vybrané služby`
- Pro roli `SALON` je vytvoření slotu zjednodušené:
  - nový slot se zakládá rovnou jako publikovaný
  - interní poznámka se ve formuláři nezobrazuje
  - stránka zdůrazňuje rychlé provozní filtry a minimální počet kroků
- Chybové a potvrzovací hlášky:
  - seznam i detail slotu teď rozlišují úspěšné i chybové flash zprávy
  - neúspěšná změna stavu nebo smazání už nekončí tichým redirectem bez kontextu
- Detail slotu ukazuje:
  - zda je slot volný nebo obsazený
  - kolik rezervací je aktivních proti kapacitě
  - omezení na konkrétní služby
  - navázané rezervace a důvod, proč nejde slot smazat
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

## Týdenní Planner Slotů V1
- Hlavní workflow pro správu dostupností je nově týdenní přehled na `/admin/volne-terminy` a `/admin/provoz/volne-terminy`.
- Týden je hlavní plánovací jednotka:
  - každý den má vlastní kartu
  - z karty je jedním tapem dostupné `Přidat slot`, `Přidat sérii` a `Detail dne`
  - den je barevně a textově označen jako `Prázdný den`, `Aktivní den`, `Omezený den` nebo `Zrušený den`
- Denní detail je sekundární vrstva v pravém panelu na desktopu a ve stacked bloku na mobilu.
- Denní detail slouží pro:
  - rychlou změnu stavu slotu
  - rychlou úpravu času a kapacity
  - přechod do plné editace pro `allowed services`, `publicNote` a `internalNote`
- Rychlé vložení jednoho slotu z týdne vytváří jednoduchý slot bez omezení služeb a bez poznámek; detail se doplňuje až podle potřeby.
- Dávkové vložení více slotů zakládá sérii jednoduchých slotů v jednom dni.
- Server sérii odmítne, pokud:
  - některý slot koliduje s existujícím aktivním slotem
  - série přesahuje do dalšího dne
  - kapacita nebo délka slotu nedává smysl
- Mobilní režim nepoužívá širokou tabulku:
  - dny jsou řazené vertikálně pod sebe
  - detail dne je pod přehledem
  - rychlé akce jsou dostupné jako velká tlačítka a anchor odkazy
