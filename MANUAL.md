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
  - owner dashboard na `/admin`
  - provozní dashboard na `/admin/provoz` pro roli `SALON`
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

## Datový Model Rezervací
- `AvailabilitySlot` je hlavní entita dostupnosti a nese časový interval, stav, kapacitu a interní/veřejné poznámky.
- `AvailabilitySlot` má explicitní `serviceRestrictionMode`, takže je zřejmé, zda slot přijímá jakoukoli službu nebo jen vybrané služby.
- `AvailabilitySlotService` umožňuje slot omezit jen na konkrétní služby, když je `serviceRestrictionMode = SELECTED`.
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

## Provozní Poznámky
- `proxy.ts` filtruje nepřihlášené požadavky na `/admin/*`.
- Finální autorizace probíhá server-side v admin layoutu a stránkách.
- Prisma klient používá singleton pattern pro vývoj i produkci.
- Databáze blokuje překrývající se aktivní sloty přes PostgreSQL exclusion constraint.
- Po každé změně Prisma schematu je potřeba spustit alespoň `npm run db:generate`; při změně struktury DB i `npm run db:migrate`.
