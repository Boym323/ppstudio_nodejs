# Deployment

Postup nasazení aplikace do produkce.

## Release checklist
1. `npm ci`
2. Ověř správné produkční env proměnné (`DATABASE_URL`, `ADMIN_SESSION_SECRET`, admin bootstrap účty, email delivery, worker, `MEDIA_STORAGE_ROOT`)
3. Ověř existenci a práva k upload rootu; web proces musí umět zapisovat do `MEDIA_STORAGE_ROOT` nebo do výchozí cesty `/var/www/ppstudio/uploads`.
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
   - `/o-mne`:
     - výrazný hero s oběma CTA
     - čitelnost badge služeb na mobilu
     - rozumný crop hlavní fotografie nebo elegantní fallback placeholder
     - CTA kartu v sekci „Co vás u mě čeká“
     - sekci certifikací s reálnými daty i bez nich
     - finální tmavý CTA blok
   - služby a detail služby
   - kontakt
   - FAQ a právní stránky
     - `/obchodni-podminky`: hero CTA, blok poskytovatele a obsahová navigace
     - `/studio`: hero, galerie publikovaných fotek studia z modulu `Média webu`, fallback bez fotek a finální CTA
   - CTA na rezervaci
14. Projdi ruční QA admin částí:
   - login redirect pro `OWNER` a `SALON`
   - opakované chybné přihlášení na `/admin/prihlaseni` po překročení limitu vrátí `error=rate_limited` a nepovolí session
   - dostupnost owner-only sekcí jen pro `OWNER`
   - stejné chování owner/salon párových route po refaktoru factory wrapperů (overview, section, booking detail, slot list/create/detail/edit)
   - lite admin navigaci a mobilní čitelnost na `/admin/provoz/*`
   - overview dashboard na `/admin` a `/admin/provoz`:
     - horní blok `Dnešní provoz` ukazuje datum, dominantní počet dnešních rezervací, další klientku a CTA `Otevřít dnešní plán / Přidat termín / Detail rezervace`
     - blok `Dnešní úkoly` odpovídá aktuálním datům pro pending potvrzení, další klientku, dnešní volná okna a chybné e-maily
     - pending potvrzení se při nenulovém stavu zobrazí jako výrazný alert nad dnešním plánem; bez pending stavu se dashboard nechová agresivně
     - `Dnešní plán` kombinuje rezervace a volná okna bez rozbitých časů nebo duplicit a řádky reagují na hover, click-to-open i inline akce
     - rychlé akce rezervací v timeline fungují (`Potvrdit`, `Zrušit`, `Otevřít`) a po úspěchu ukážou toast
     - pravý sidebar ukazuje jen nejbližší skutečně volné sloty pro dnes a zítra a samostatný blok `Rychlé akce`
     - `Vytvořit rezervaci` je v pravém panelu nejvýraznější CTA a ostatní akce zůstávají sekundární
     - spodní KPI neopakují počet dnešních rezervací; zobrazují jen sekundární provozní metriky
   - sekci `Kategorie služeb` na `/admin/kategorie-sluzeb` a `/admin/provoz/kategorie-sluzeb`:
     - pravý overlay drawer detailu na desktopu i mobilu
     - vytvoření nové kategorie přes CTA
     - kombinaci search / stav / řazení / chip filtrů
     - změnu pořadí
     - přepnutí aktivní / neaktivní
     - optimistic reakci seznamu bez reloadu stránky
     - warning stavy `prázdná`, `bez veřejné služby`, `neaktivní s aktivními službami`
     - mobilní otevření detailu a návrat zpět na seznam
     - blokaci mazání kategorie se službami
     - smazání prázdné kategorie
   - sekci `Služby` na `/admin/sluzby` a `/admin/provoz/sluzby`:
     - vytvoření nové služby přes CTA
     - filtr podle kategorie
     - rychlé akce `aktivovat / deaktivovat`, `veřejná / interní`, `duplikovat`, `posunout`
     - warning stavy v kartách seznamu
     - otevření detailu služby do pravého overlay draweru a jeho zavření zpět na stejný filtrovaný seznam
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
     - blok `Kalendář`: zapnutí feedu, zkopírování URL, rotaci tokenu a vypnutí feedu
     - po rotaci kalendáře starý subscription odkaz vrací 404 a nový vrací `text/calendar; charset=utf-8`
     - propsání kontaktů do footeru a `/kontakt`
     - propsání storno limitu do `/faq` a `/storno-podminky`
     - na `/storno-podminky` správné kontakty v hero boxu `Jak zrušit rezervaci` a správné hodnoty v kartách hlavních pravidel
     - propsání booking limitů do `/rezervace`
   - owner sekci `/admin/uzivatele`:
     - seznam přístupů ukazuje jen role `OWNER` a `SALON`
     - systémové účty jsou read-only a zobrazují se jako `Systémový účet`
     - založení nové pozvánky vytvoří účet se stavem `Pozvánka čeká`
     - pozvánka dorazí na e-mail a odkaz vede na `/admin/pozvanka/[token]`
     - aktivace pozvánky dovolí nastavit heslo a následně přihlášení přes `/admin/prihlaseni`
     - akce `Přepnout na OWNER/SALON`, `Deaktivovat` a `Znovu aktivovat` se ihned propšou do seznamu
  - modul `Média webu` na `/admin/media` a `/admin/provoz/media`:
     - veřejná stránka `/studio` zobrazí jen publikované fotky typu `SALON_PHOTO`
     - upload podporovaného obrázku s výběrem typu
     - pro JPEG/PNG/WebP vzniká při uploadu originál s EXIF normalizací a k němu `optimized` + `thumbnail` varianta přes `sharp`
     - editace titulku, alt textu, typu a publish/unpublish
     - tabs filtrů `Vše / Certifikáty / Prostory / Portrét Homepage / Portrét O mně / Portrét Legacy / Obecné` se správnými počty
     - quick publish/unpublish přímo na kartě média bez nutnosti otevírat editaci
     - smazání média
     - propsání publikovaných certifikátů na `/o-mne`
     - oddělený portrét pro homepage (`PORTRAIT_HOME`) a `/o-mne` (`PORTRAIT_ABOUT`) s fallbackem na legacy `PORTRAIT`
15. Ověř booking, email a media vrstvu:
  - vytvoření testovací rezervace
  - propsání nové rezervace nebo změny slotu do overview dashboardu bez potřeby buildu nebo manuálního refresh flow navíc
  - `/admin/rezervace` a `/admin/provoz/rezervace`: kompaktní řádkový seznam, sticky header a inline akce `Potvrdit` / `Zrušit`
  - `/admin/rezervace` a `/admin/provoz/rezervace`: segmented filtr statistik bez duplicitního CTA, toolbar `hledat / stav / zdroj / datum`, seskupení `Dnes / Zítra / Později / Dříve`, pending-first prioritu, click-to-open řádky, klávesy `Enter / ↑ / ↓`, tlumené řádky `Hotovo` a `Zrušená` a mobilní compact cards
  - detail rezervace:
    - sticky header drží klientku, službu, termín, stav, zdroj a rychlé akce i při scrollu
    - akční panel je hned pod headerem a podle stavu nabízí správný další krok (`Potvrdit`, `Hotovo`, `Zrušit`, `Nedorazila`)
    - potvrď, že `Přesunout termín` zůstává oddělené CTA do draweru, ne součást běžného chooseru
    - pravý summary card ukazuje kompaktně kontakt, službu, termín, zdroj, přesuny a auditní metadata
    - poznámky jsou v jednom bloku (`Poznámka od klientky` + editovatelná interní poznámka)
    - historie ukazuje nejdřív posledních 5 položek a umí rozbalit celý audit
    - otevření draweru `Přesunout termín`
    - výběr nového času ze slotů i ručně
    - vznik auditního záznamu v historii detailu
    - korektní warning při interní výjimce mimo veřejnou dostupnost
    - založení `BOOKING_RESCHEDULED` v email logu při zapnutém oznámení
  - pravý drawer `Přidat rezervaci` v `/admin/rezervace` i `/admin/provoz/rezervace`:
    - vyhledání existující klientky podle jména / telefonu / e-mailu
    - založení nové klientky
    - výběr služby a propsání délky/ceny
    - slotový výběr i ruční datum/čas
    - warning při interní výjimce mimo veřejnou dostupnost
    - vytvoření rezervace ve stavech `CONFIRMED` i `PENDING`
    - volitelné odeslání potvrzovacího e-mailu a `.ics` přílohy
  - přepnutí kategorie nebo služby v kroku 1 `/rezervace` a reset nevalidního vybraného času
  - sekci `Nejbližší dostupné termíny` a jednoklikový přechod na kontakt
  - změnu dne v kalendářním fallbacku kroku 2 `/rezervace` a reset nevalidního vybraného času
  - větší grid časů na mobilu i desktopu včetně disabled stavů a návratu zpět ze souhrnu
  - sticky CTA lištu na mobilu a editaci jednotlivých bloků přímo ze souhrnu
  - po stabilizačním refaktoru také rychlou smoke kontrolu veřejného booking flow a týdenního planneru, protože jejich implementace je nově rozdělená do více interních modulů se stejným chováním
  - zápis `EmailLog` ve stavu `PENDING` v background režimu nebo `SENT` v log režimu
  - funkční storno odkaz
  - provozní email akce `Schválit rezervaci` / `Zrušit rezervaci`:
    - otevření confirmation screen na `/rezervace/akce/[intent]/[token]`
    - korektní result screen po potvrzení
    - jednorázové použití odkazu
    - bezpečný stav po opětovném otevření stejného odkazu
    - korektní klientský email po schválení i zrušení
  - klientský potvrzovací e-mail po `CONFIRMED`:
    - obsahuje přílohu `pp-studio-rezervace.ics`
    - příloha obsahuje jeden `VEVENT` s `TZID=Europe/Prague`
    - potvrzovací email se korektně doručí i s attachmentem přes SMTP
  - doručení admin notifikačního e-mailu na `notificationAdminEmail`
  - zpracování email workerem nebo potvrzený `EmailLog` v log režimu
  - načtení testovacího veřejného media URL `/media/public/<kind>/...` nebo legacy `/media/<kind>/...`
  - otevření `/api/calendar/owner.ics?token=...`:
    - validní `VCALENDAR` hlavička
    - `Content-Type: text/calendar; charset=utf-8`
    - ve feedu jsou jen `CONFIRMED` rezervace
    - po zrušení nebo přepnutí rezervace mimo `CONFIRMED` event zmizí při dalším fetchi

## Nasazení
1. Pull nové verze na server.
2. Instalace závislostí (`npm ci`).
3. Generování Prisma klienta (`npm run db:generate`).
4. Kontrola historie migrací (`npm run db:check-migrations`).
5. Aplikace databázových změn (`npx prisma migrate deploy`).
6. Build (`npm run build`).
7. Připrav nebo ověř existenci upload rootu `/var/www/ppstudio/uploads` včetně práv pro web proces.
8. Restart procesu aplikace.
9. Pokud běžíš v self-hosted režimu bez připraveného SMTP, nech dočasně `EMAIL_DELIVERY_MODE=log`, ať booking flow neblokuje start produkce.
10. Pro produkci spusť zvlášť `npm run email:worker` jako samostatný proces nebo službu.
11. Po nasazení reminder změny ověř, že worker běží nepřetržitě; bez něj se reminder joby neenqueueují ani nedoručují.
12. Po nasazení reschedule změny ověř, že přesun resetuje `reminder24hQueuedAt` a `reminder24hSentAt`, aby se reminder správně navázal na nový termín.

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
- Migrace `20260421113000_public_pricing_metadata` rozšiřuje katalog služeb a kategorií o veřejná pricing metadata; po deployi ověř `/cenik`, `/sluzby`, detail služby a admin formuláře `Služby` + `Kategorie služeb`.
- Migrace `20260422120000_admin_users_invited_at` přidává `AdminUser.invitedAt`; po deployi ověř owner sekci `/admin/uzivatele`, stav `Pozvánka čeká` a existující DB účty bez vyplněného `invitedAt`.
- Migrace `20260422170000_admin_invite_token_v1` přidává tabulku `AdminUserInviteToken`; po deployi ověř jednorázové použití pozvánky, expiraci a revokaci starších tokenů při novém odeslání.
- Migrace `20260422201500_booking_email_actions_v1` rozšiřuje enum `BookingActionTokenType` o `APPROVE` a `REJECT`; po deployi ověř vytvoření nových tokenů při veřejné rezervaci a funkčnost email route `/rezervace/akce/[intent]/[token]`.
- Migrace `20260422230500_manual_booking_admin_v1` přidává `Booking.isManual`, `Booking.manualOverride` a převádí `BookingSource` na nové provozní hodnoty; po deployi ověř `/admin/rezervace`, `/admin/provoz/rezervace`, ruční vytvoření rezervace a správné labely zdroje v listu i detailu.
- Migrace `20260423113000_booking_reschedule_logs_v1` přidává `Booking.reminder24hQueuedAt`, `Booking.rescheduleCount` a tabulku `BookingRescheduleLog`; po deployi ověř detail rezervace, auditní historii přesunu a nové reminder markery po změně termínu.
- Migrace `20260424103000_service_price_change_log_v1` přidává tabulku `ServicePriceChangeLog`; po deployi ověř editaci ceny v `/admin/sluzby` nebo `/admin/provoz/sluzby` a vznik auditního záznamu se starou i novou cenou.
- Klientský self-service manage/reschedule flow nevyžaduje novou migraci; po deployi ale ověř `/rezervace/sprava/[token]`, confirmation CTA `Změnit termín`, reminder CTA `Změnit termín` a zápis `changedByClient = true` do `BookingRescheduleLog`.
- Migrace `20260422194500_booking_calendar_event_v1` rozšiřuje enum `BookingActionTokenType` o `CALENDAR`; po deployi ověř, že schema je aktuální. Klientský kalendář už ale potvrzovací email posílá jako `.ics` přílohu, ne jako klikací link.
- Migrace `20260422193000_calendar_feed_v1` přidává tabulku `CalendarFeed`; po deployi ověř owner sekci `/admin/nastaveni`, zapnutí feedu a úspěšný fetch `/api/calendar/owner.ics?token=...`.
- Pokud je databáze v divergentním stavu a `prisma migrate dev` by nabízelo reset, neprováděj ho naslepo. Pro tuto migraci lze bezpečně použít `npx prisma db execute --file prisma/migrations/20260421113000_public_pricing_metadata/migration.sql` a až potom ověřit build.
- Migrace `20260419140000_site_settings_singleton` přidává tabulku `SiteSettings`; po deployi ověř, že se `/admin/nastaveni` otevře bez chyby a že owner workflow `Nastavení` bezpečně založí výchozí singleton záznam i na prázdné DB.
- Migrace `20260419230000_media_storage_v1` přidává tabulku `MediaAsset` a enumy pro lokální media storage; po deployi ověř zápis souboru do upload rootu a načtení přes `/media/public/*` nebo legacy `/media/*`.
- Admin workflow kategorií služeb nevyžaduje novou DB migraci; navazuje na existující model `ServiceCategory`.
- Přepracované admin workflow služeb a kategorií nevyžaduje novou DB migraci; změna je čistě v read modelech, server actions a UI vrstvách.
- Nový layout sekce `Kategorie služeb` také nevyžaduje novou DB migraci; změna zůstává čistě v komponentách, read modelu a server actions nad existujícím `ServiceCategory`.
- Stabilizační refaktor `booking-public`, `booking-flow` a `admin-slots` také nevyžaduje novou DB migraci; změna je čistě strukturální a zachovává stejné veřejné exporty i databázové chování.
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
- `email:worker` nově zajišťuje dvě věci: enqueue 24h reminderů i samotné doručování `EmailLog`. Pokud worker stojí, stojí obě části flow.
- Pokud worker stojí, klientský self-service přesun sice změní termín v DB, ale potvrzovací e-mail o změně zůstane jen ve frontě nebo se nedoručí; smoke test po deployi má vždy ověřit i vznik `BOOKING_RESCHEDULED`.
- Pokud SMTP dočasně nefunguje, přepni na `EMAIL_DELIVERY_MODE=log`; booking a storno zůstanou funkční a e-mailové pokusy se dál auditují.
- Když worker hlásí TLS chybu typu `wrong version number`, zkontroluj, že `SMTP_SECURE` odpovídá portu. Pro Resend a podobné providery je nejbezpečnější `SMTP_SECURE=auto`.
- Reverzní proxy by měla korektně předávat `x-forwarded-for`, aby submission audit a rate limiting pracovaly smysluplně.
- I když `npm run build` dnes předem volá `prisma generate`, v release checklistu necháváme explicitní `npm run db:generate`, protože chrání i jiné skripty a ruční servisní zásahy.
- `allowedDevOrigins` je čistě development nastavení pro `next dev`; produkční deploy ani `next start` na něm nestojí. Pokud někdo řeší vzdálené testování přes LAN nebo přes Synology reverse proxy na `ppstudio.cz`, upravuje se `next.config.ts`, ne produkční env.
- Upload root není build artefakt. Při deployi se nemaže a má být zálohovaný samostatně od repozitáře i databáze.
- Veřejná média se publikují přes `/media/public/*` a legacy `/media/*`, takže reverse proxy nemusí mapovat fyzickou cestu upload adresáře přímo do document rootu.

## Dodatečná QA pro týdenní planner
- Ověř všechny route varianty:
  - `/admin/volne-terminy`
  - `/admin/volne-terminy/novy`
  - `/admin/volne-terminy/[slotId]`
  - `/admin/volne-terminy/[slotId]/upravit`
  - a stejné cesty pod `/admin/provoz/volne-terminy/*`
- Ověř, že planner renderuje týdenní kalendář a že guardy rolí fungují stejně jako dřív.
- Ověř, že kliknutí do gridu vybírá blok pro pravý inspektor a že teprve tažení nebo akce z inspektoru mění koncept.
- Ověř přidání dostupnosti tažením, odebrání zeleného intervalu a copy day/week.
- Ověř sticky action bar `Zahodit / Uložit koncept / Publikovat změny` včetně obnovení uloženého konceptu po refreshi stejného týdne.
- Ověř, že pokus o zásah do rezervace skončí čitelnou chybou bez změny dat.
