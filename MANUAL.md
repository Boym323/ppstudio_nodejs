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
- Ochrana není řešená jen skrytím položek v menu:
  - `proxy.ts` dál blokuje nepřihlášené vstupy
  - server-side guard helpery kontrolují oprávnění každé admin route
  - nedovolený vstup se přesměruje na domovskou admin stránku role nebo skončí `notFound` pro neplatnou sekci

## Datový Model Rezervací
- `AvailabilitySlot` je hlavní entita dostupnosti a nese časový interval, stav, kapacitu a interní/veřejné poznámky.
- `AvailabilitySlot` má explicitní `serviceRestrictionMode`, takže je zřejmé, zda slot přijímá jakoukoli službu nebo jen vybrané služby.
- `AvailabilitySlotService` umožňuje slot omezit jen na konkrétní služby, když je `serviceRestrictionMode = SELECTED`.
- Kategorie a služby jsou samostatné DB entity, které se dnes plní přes import nebo admin správu, ne přes hardcoded seed.
- `Booking` drží snapshot klienta, služby i času, takže pozdější změny ceníku nebo názvů služeb nepoškodí historická data.
- `Booking` navíc drží vazbu na předchozí rezervaci při reschedule a nepovoluje duplicitní booking stejného klienta do stejného slotu.
- `BookingStatusHistory` slouží jako audit změn stavu a rozlišuje akci uživatele, klienta nebo systému.
- `BookingActionToken` ukládá pouze hash tokenu pro storno a přesun termínu, nikdy ne surovou hodnotu tokenu.
- `EmailLog` umožňuje trasovat odeslané i neúspěšné e-maily navázané na klienta, rezervaci a případný token.
- Veřejný booking flow po potvrzení:
  - znovu validuje službu a termín server-side
  - naváže nebo vytvoří klienta podle e-mailu
  - vytvoří rezervaci se snapshotem služby a času
  - zapíše audit změny stavu
  - připraví storno token a e-mailový log pro potvrzení
- Pokud se termín mezitím obsadí, služba přestane být aktivní nebo slot přestane odpovídat délce služby, uživatel dostane konkrétnější chybu místo obecného selhání.
- Veřejný submit je lehce rate-limitený podle IP a e-mailu; opakované pokusy v krátkém čase skončí blokací s user-friendly hláškou.
- Krok 2 už skrývá i sloty, které jsou pro vybranou službu příliš krátké.

## Provozní Poznámky
- `proxy.ts` filtruje nepřihlášené požadavky na `/admin/*`.
- Finální autorizace probíhá server-side v admin layoutu a stránkách.
- Prisma klient používá singleton pattern pro vývoj i produkci.
- Databáze blokuje překrývající se aktivní sloty přes PostgreSQL exclusion constraint.
- Po každé změně Prisma schematu je potřeba spustit alespoň `npm run db:generate`; při změně struktury DB i `npm run db:migrate`.
