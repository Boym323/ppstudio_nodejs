# Deployment

Postup nasazení aplikace do produkce.

## Release checklist
1. `npm ci`
2. Ověř správné produkční env proměnné (`DATABASE_URL`, `ADMIN_SESSION_SECRET`, admin bootstrap účty, email delivery, worker, `MEDIA_STORAGE_ROOT`)
3. Ověř existenci a práva k upload rootu; web proces musí umět zapisovat do `MEDIA_STORAGE_ROOT` nebo do výchozí cesty `../ppstudio-uploads`.
4. Zálohuj databázi, pokud release obsahuje novou Prisma migraci.
5. Zálohuj nebo snapshotuj upload root, pokud release mění práci s médii nebo cleanup logiku.
6. `npm run db:generate`
7. `npm run db:check-migrations`
8. `npx prisma migrate deploy`
9. `npm run lint`
10. `npm run build`
11. Aktualizuj `CHANGELOG.md`
12. Ověř aktuálnost dokumentace (`MANUAL.md`, `docs/*`)
13. Projdi ruční QA veřejného webu na mobilu i desktopu:
   - homepage
   - služby a detail služby
   - kontakt
   - FAQ a právní stránky
   - CTA na rezervaci
14. Projdi ruční QA admin částí:
   - login redirect pro `OWNER` a `SALON`
   - dostupnost owner-only sekcí jen pro `OWNER`
   - stejné chování owner/salon párových route po refaktoru factory wrapperů (overview, section, booking detail, slot list/create/detail/edit)
   - lite admin navigaci a mobilní čitelnost na `/admin/provoz/*`
   - sekci `Kategorie služeb` na `/admin/kategorie-sluzeb` a `/admin/provoz/kategorie-sluzeb`:
     - vytvoření nové kategorie přes CTA
     - změnu pořadí
     - přepnutí aktivní / neaktivní
     - warning stavy `prázdná`, `bez veřejné služby`, `neaktivní s aktivními službami`
     - mobilní otevření detailu a návrat zpět na seznam
     - blokaci mazání kategorie se službami
     - smazání prázdné kategorie
   - sekci `Služby` na `/admin/sluzby` a `/admin/provoz/sluzby`:
     - vytvoření nové služby přes CTA
     - filtr podle kategorie
     - rychlé akce `aktivovat / deaktivovat`, `veřejná / interní`, `duplikovat`, `posunout`
     - warning stavy v kartách seznamu
     - mobilní otevření detailu a návrat zpět na seznam
   - slot workflow na `/admin/volne-terminy*` a `/admin/provoz/volne-terminy*`:
     - přepínání týdnů a zachování vybraného dne
     - zachování vybraného slotu po rychlé úpravě nebo změně stavu
     - filtr stavu v planneru
     - vytvoření slotu
     - vytvoření série slotů
     - otevření denního pracovního panelu z karty dne
     - inline změnu stavu z day workspace
     - rychlou úpravu času bez kolize
     - blokaci a archivaci
     - zákaz smazání slotu s navázanou rezervací
   - owner sekci `/admin/email-logy` po každé změně Prisma schématu nebo e-mailové outbox vrstvy
   - owner sekci `/admin/nastaveni`:
     - uložení všech tří bloků
     - propsání kontaktů do footeru a `/kontakt`
     - propsání storno limitu do `/faq` a `/storno-podminky`
     - propsání booking limitů do `/rezervace`
   - certifikátový modul na `/admin/certifikaty` a `/admin/provoz/certifikaty`:
     - upload podporovaného obrázku
     - smazání certifikátu
     - propsání změn na `/o-mne`
15. Ověř booking, email a media vrstvu:
  - vytvoření testovací rezervace
  - změnu dne v kroku 2 `/rezervace` a reset nevalidního vybraného času
  - kompaktní grid časů na mobilu i desktopu včetně disabled stavů a návratu zpět ze souhrnu
  - zápis `EmailLog` ve stavu `PENDING` v background režimu nebo `SENT` v log režimu
  - funkční storno odkaz
  - doručení admin notifikačního e-mailu na `notificationAdminEmail`
  - zpracování email workerem nebo potvrzený `EmailLog` v log režimu
  - načtení testovacího veřejného media URL `/media/<kind>/...`

## Nasazení
1. Pull nové verze na server.
2. Instalace závislostí (`npm ci`).
3. Generování Prisma klienta (`npm run db:generate`).
4. Kontrola historie migrací (`npm run db:check-migrations`).
5. Aplikace databázových změn (`npx prisma migrate deploy`).
6. Build (`npm run build`).
7. Připrav nebo ověř existenci upload rootu mimo repo, například `/var/www/ppstudio-uploads`, včetně práv pro web proces.
8. Restart procesu aplikace.
9. Pokud běžíš v self-hosted režimu bez připraveného SMTP, nech dočasně `EMAIL_DELIVERY_MODE=log`, ať booking flow neblokuje start produkce.
10. Pro produkci spusť zvlášť `npm run email:worker` jako samostatný proces nebo službu.

### Systemd
- Doporučený web unit je v [`deploy/systemd/ppstudio-web.service`](/var/www/ppstudio/deploy/systemd/ppstudio-web.service).
- Doporučený worker unit je v [`deploy/systemd/ppstudio-email-worker.service`](/var/www/ppstudio/deploy/systemd/ppstudio-email-worker.service).
- Šablony s poznámkami k `User`/`Group` jsou v [`deploy/systemd/ppstudio-web.service.example`](/var/www/ppstudio/deploy/systemd/ppstudio-web.service.example) a [`deploy/systemd/ppstudio-email-worker.service.example`](/var/www/ppstudio/deploy/systemd/ppstudio-email-worker.service.example).
- Jednoduchý instalační helper je v [`deploy/deploy.sh`](/var/www/ppstudio/deploy/deploy.sh).
- Kopíruj je do `/etc/systemd/system/`, potom spusť:
```bash
systemctl daemon-reload
systemctl enable --now ppstudio-web
systemctl enable --now ppstudio-email-worker
```
- Units očekávají `.env` v `/var/www/ppstudio/.env` a `npm` dostupné v PATH.
- Pro jednorázovou instalaci a zapnutí obou služeb můžeš použít:
```bash
sudo /var/www/ppstudio/deploy/deploy.sh
```

### Docker Compose
- Pro container deployment je připravený [`deploy/docker-compose.email-worker.yml`](/var/www/ppstudio/deploy/docker-compose.email-worker.yml).
- Službu používej vedle hlavního Next.js procesu, ne jako jeho náhradu.
- Před startem zajisti, že image `ppstudio:latest` už obsahuje build aplikace a že `env_file` ukazuje na správný `.env`.

## Poznámky k DB migracím
- Migrace `20260418184500_schema_v1_booking_core` převádí legacy `BookingRequest` na `Booking` a backfilluje nové tabulky.
- Migrace `20260418193000_booking_model_review_fixes` přidává explicitní slot restriction mode a DB constraint proti překrývajícím se aktivním slotům.
- Migrace `20260418220000_email_outbox_worker` doplňuje sloupce pro outbox, claimování a retry e-mailových jobů.
- Migrace `20260419103000_service_public_bookability` přidává sloupec `Service.isPubliclyBookable`; po deployi ověř, že `/rezervace`, `/sluzby` a `/cenik` zobrazují jen správné služby a že admin sekce `Služby` funguje v owner i salon oblasti.
- Migrace `20260419140000_site_settings_singleton` přidává tabulku `SiteSettings`; po deployi ověř, že se `/admin/nastaveni` otevře bez chyby a že první render bezpečně založí výchozí singleton záznam.
- Migrace `20260419230000_media_storage_v1` přidává tabulku `MediaAsset` a enumy pro lokální media storage; po deployi ověř zápis souboru do upload rootu a načtení přes `/media/*`.
- Admin workflow kategorií služeb nevyžaduje novou DB migraci; navazuje na existující model `ServiceCategory`.
- Přepracované admin workflow služeb a kategorií nevyžaduje novou DB migraci; změna je čistě v read modelech, server actions a UI vrstvách.
- Před produkční aplikací migrace ověř data, která by mohla mít rezervaci bez přiřazené služby; tato migrace takové řádky záměrně odmítne.
- Pokud v databázi existují duplicitní rezervace stejného klienta do stejného slotu, nová migrace se zastaví a vyžádá jejich ruční vyčištění.
- Pokud nasazuješ jen frontend bez DB změn, `npx prisma migrate deploy` zůstává bezpečný no-op.
- `npm run db:migrate` v tomto repozitáři mapuje na `prisma migrate dev` a je určený pro lokální vývoj, ne pro produkční server.
- Produkční release flow proto používá `npm run db:check-migrations` a `npx prisma migrate deploy`.

## Rollback
1. Návrat na předchozí commit/release tag.
2. `npm ci && npm run db:generate && npm run build`
3. Pokud release obsahoval migraci, ověř kompatibilitu rollbacku s databází.
4. U datově transformačních migrací rollback neprováděj naslepo; nejdřív ověř, zda starší aplikace umí pracovat s novým schématem.
5. Restart procesu.
6. Ověření funkčnosti.

## Self-hosted poznámky
- Aplikace nevyžaduje externí queue; e-maily se ve v1 ukládají do PostgreSQL outboxu a worker je vytahuje na pozadí.
- Pro menší self-hosted provoz stačí běžný SMTP účet s app passwordem, běžící worker a monitoring `EmailLog` v owner adminu.
- Pokud SMTP dočasně nefunguje, přepni na `EMAIL_DELIVERY_MODE=log`; booking a storno zůstanou funkční a e-mailové pokusy se dál auditují.
- Reverzní proxy by měla korektně předávat `x-forwarded-for`, aby submission audit a rate limiting pracovaly smysluplně.
- I když `npm run build` dnes předem volá `prisma generate`, v release checklistu necháváme explicitní `npm run db:generate`, protože chrání i jiné skripty a ruční servisní zásahy.
- `allowedDevOrigins` je čistě development nastavení pro `next dev`; produkční deploy ani `next start` na něm nestojí. Pokud někdo řeší vzdálené testování přes LAN, upravuje se `next.config.ts`, ne produkční env.
- Upload root není build artefakt. Při deployi se nemaže a má být zálohovaný samostatně od repozitáře i databáze.
- Veřejná média se publikují přes `/media/*`, takže reverse proxy nemusí mapovat fyzickou cestu upload adresáře přímo do document rootu.

## Dodatečná QA pro týdenní planner
- Ověř všechny route varianty:
  - `/admin/volne-terminy`
  - `/admin/volne-terminy/novy`
  - `/admin/volne-terminy/[slotId]`
  - `/admin/volne-terminy/[slotId]/upravit`
  - a stejné cesty pod `/admin/provoz/volne-terminy/*`
- Ověř, že planner renderuje týdenní kalendář a že guardy rolí fungují stejně jako dřív.
- Ověř přidání dostupnosti kliknutím i tažením, odebrání zeleného intervalu a copy day/week.
- Ověř, že pokus o zásah do rezervace skončí čitelnou chybou bez změny dat.
