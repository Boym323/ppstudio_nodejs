# Deployment

Tento dokument je stručný provozní přehled deploye pro aktuální prostředí PP Studio. Detailní release checklist zůstává v [docs/DEPLOYMENT.md](/var/www/ppstudio/docs/DEPLOYMENT.md).

## Produkční topologie

Aktuální nasazení počítá s:

- Proxmox hostem
- Debian LXC kontejnerem
- checkoutem v `/var/www/ppstudio`
- PostgreSQL databází
- dvěma systemd službami:
  - `ppstudio-web`
  - `ppstudio-email-worker`

Web a worker běží odděleně, ale sdílí:

- stejný checkout
- stejný `.env`
- stejnou databázi
- stejný upload root

## Systemd služby

Soubory:

- [deploy/systemd/ppstudio-web.service](/var/www/ppstudio/deploy/systemd/ppstudio-web.service:1)
- [deploy/systemd/ppstudio-email-worker.service](/var/www/ppstudio/deploy/systemd/ppstudio-email-worker.service:1)

### `ppstudio-web`

- `WorkingDirectory=/var/www/ppstudio`
- načítá `.env` i volitelný `.release-env`
- startuje `npm run start`
- běží jako `next start` na `PORT=3000`

### `ppstudio-email-worker`

- `WorkingDirectory=/var/www/ppstudio`
- načítá `.env`
- startuje `npm run email:worker`

## Doporučený release postup

Script:

- [deploy/release.sh](/var/www/ppstudio/deploy/release.sh:1)

Dělá:

1. načte `.env`
2. zvaliduje `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
3. odvodí `NEXT_DEPLOYMENT_ID`, `DEPLOYMENT_VERSION`, `GIT_HASH` z git commitu
4. vytvoří staging workspace vedle repozitáře
5. ve stagingu provede:
   - `npm ci --include=dev`
   - `npm run db:generate`
   - `npm run db:check-migrations`
   - `npx prisma migrate deploy`
   - `npm run lint`
   - `npm run build`
6. zapíše runtime `.release-env`
7. krátce zastaví web i worker
8. atomicky přepne `node_modules` a `.next`
9. spustí nové služby
10. při chybě vrátí předchozí artefakty

## Proxmox/LXC specifika

### Co hlídat na LXC

- správnou verzi Node.js v kontejneru, ne jen na hostu
- zapisovatelný `MEDIA_STORAGE_ROOT`
- systemd funkční uvnitř kontejneru
- dostatečnou RAM pro `next build`, `sharp` a Prisma
- korektní čas a timezone

### Doporučené snapshoty

Před releasem:

- snapshot LXC kontejneru
- dump PostgreSQL
- snapshot nebo backup upload rootu

To je nejbezpečnější rollback kombinace pro:

- neúspěšnou migraci
- rozbitý build
- regresi v práci s médii

## Reverzní proxy a origin

Produkce musí předávat konzistentní:

- `Host`
- `X-Forwarded-Host`
- `X-Forwarded-Proto`

Důvod:

- admin login/logout používá explicitní origin kontrolu
- e-mailové a ICS odkazy se skládají z `NEXT_PUBLIC_APP_URL`
- canonical/SEO metadata se opírají o veřejný origin

## Po deployi ověř

- `systemctl status ppstudio-web`
- `systemctl status ppstudio-email-worker`
- `curl https://.../api/health`
- admin login
- vytvoření testovací rezervace
- stav e-mail workeru
- dostupnost uploadovaných médií
- pokud je aktivní Matomo reporting, i `/api/admin/analytics`

## Rollback

Nejrychlejší rollback možnosti:

1. vrátit předchozí artefakty, pokud release script rollback spustil automaticky
2. ručně obnovit předchozí LXC snapshot
3. obnovit DB dump, pokud problém způsobilá migrace změnila data

Pozor:

- rollback aplikace bez rollbacku migrace nemusí stačit
- rollback DB bez rollbacku uploadů nebo souborů může rozbít média

## Související dokumenty

- [ENVIRONMENT.md](/var/www/ppstudio/ENVIRONMENT.md)
- [TROUBLESHOOTING.md](/var/www/ppstudio/TROUBLESHOOTING.md)
- [docs/DEPLOYMENT.md](/var/www/ppstudio/docs/DEPLOYMENT.md)
