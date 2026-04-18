# Deployment

Postup nasazení aplikace do produkce.

## Release checklist
1. `npm ci`
2. Ověř správné produkční env proměnné (`DATABASE_URL`, `ADMIN_SESSION_SECRET`, admin bootstrap účty, email delivery, worker)
3. Zálohuj databázi, pokud release obsahuje novou Prisma migraci.
4. `npm run db:generate`
5. `npm run db:migrate`
6. `npm run lint`
7. `npm run build`
8. Aktualizuj `CHANGELOG.md`
9. Ověř aktuálnost dokumentace (`MANUAL.md`, `docs/*`)
10. Projdi ruční QA veřejného webu na mobilu i desktopu:
   - homepage
   - služby a detail služby
   - kontakt
   - FAQ a právní stránky
   - CTA na rezervaci
11. Projdi ruční QA admin částí:
   - login redirect pro `OWNER` a `SALON`
   - dostupnost owner-only sekcí jen pro `OWNER`
   - lite admin navigaci a mobilní čitelnost na `/admin/provoz/*`
   - owner sekci `/admin/email-logy` po každé změně Prisma schématu nebo e-mailové outbox vrstvy
12. Ověř booking a email vrstvu:
   - vytvoření testovací rezervace
   - zápis `EmailLog` ve stavu `PENDING` v background režimu nebo `SENT` v log režimu
   - funkční storno odkaz
   - zpracování email workerem nebo potvrzený `EmailLog` v log režimu

## Nasazení
1. Pull nové verze na server.
2. Instalace závislostí (`npm ci`).
3. Generování Prisma klienta (`npm run db:generate`).
4. Aplikace databázových změn (`npm run db:migrate`).
5. Build (`npm run build`).
6. Restart procesu aplikace.
7. Pokud běžíš v self-hosted režimu bez připraveného SMTP, nech dočasně `EMAIL_DELIVERY_MODE=log`, ať booking flow neblokuje start produkce.
8. Pro produkci spusť zvlášť `npm run email:worker` jako samostatný proces nebo službu.

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
- Před produkční aplikací migrace ověř data, která by mohla mít rezervaci bez přiřazené služby; tato migrace takové řádky záměrně odmítne.
- Pokud v databázi existují duplicitní rezervace stejného klienta do stejného slotu, nová migrace se zastaví a vyžádá jejich ruční vyčištění.
- Pokud nasazuješ jen frontend bez DB změn, `npm run db:migrate` zůstává bezpečný no-op.

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
