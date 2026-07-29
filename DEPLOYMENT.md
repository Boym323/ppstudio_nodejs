# Deployment

Tento dokument je stručný provozní přehled deploye pro aktuální prostředí PP Studio. Detailní release checklist zůstává v [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Produkční topologie

Aktuální nasazení počítá s:

- Proxmox hostem
- Debian LXC kontejnerem
- pracovním checkoutem v `/var/www/ppstudio` a aktivním releasem přes symlink `/var/www/ppstudio/current`
- PostgreSQL databází
- dvěma systemd službami:
  - `ppstudio-web`
  - `ppstudio-email-worker`

Web a worker běží odděleně, ale sdílí:

- stejný aktivní release v `current`
- stejný `.env`
- stejnou databázi
- stejný upload root

## Systemd služby

Soubory:

- [deploy/systemd/ppstudio-web.service](deploy/systemd/ppstudio-web.service#L1)
- [deploy/systemd/ppstudio-email-worker.service](deploy/systemd/ppstudio-email-worker.service#L1)

### `ppstudio-web`

- `WorkingDirectory=/var/www/ppstudio/current`
- načítá stabilní `/var/www/ppstudio/.env` i release-local `.release-env`
- startuje `npm run start`
- běží jako `next start` na `PORT=3000`

### `ppstudio-email-worker`

- `WorkingDirectory=/var/www/ppstudio/current`
- načítá stabilní `/var/www/ppstudio/.env` i release-local `.release-env`
- startuje `npm run email:worker`

## Doporučený release postup

Script:

- [deploy/release.sh](deploy/release.sh#L1)

Dělá:

1. načte `.env`
2. zvaliduje `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
3. odvodí `NEXT_DEPLOYMENT_ID`, `DEPLOYMENT_VERSION`, `GIT_HASH` z git commitu
4. vytvoří staging workspace vedle repozitáře
5. ve stagingu provede:
   - `npm ci --include=dev`
   - `npm run db:generate`
   - `npm run db:check-migrations`
   - `npm run lint`
   - `npm run build`
6. teprve po úspěšném buildu aplikuje `npx prisma migrate deploy`; každá budoucí databázová migrace musí bez výjimky dodržet postup expand/contract a zůstat kompatibilní s předchozím releasem
7. vytvoří runtime `.release-env`, uloží celý release do `releases/` a atomicky přepne `current`
8. krátce zastaví a znovu spustí web i worker nad stejným releasem
9. nejdřív tiše vyčká na otevření webového endpointu, potom ověří `/api/health`, očekávané deployment ID a homepage smoke test
10. při selhání startu nebo kontrol vrátí předchozí runtime release; databázové migrace se automaticky nevracejí, proto rollback musí vždy fungovat se schématem po aplikované migraci

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

Pro administrační API neloguj query string. V access logu proxy používej cestu bez parametrů (např. `$uri` místo `$request_uri` v Nginxu); chrání to před únikem citlivých hodnot i při chybném klientském requestu.

## Po deployi ověř

- `systemctl status ppstudio-web`
- `systemctl status ppstudio-email-worker`
- `curl https://.../api/health`
- admin login
- vytvoření testovací rezervace
- stav e-mail workeru
- dostupnost uploadovaných médií
- pokud je aktivní Matomo reporting, i `/api/admin/analytics`

Health endpoint při výpadku databáze vrací HTTP `503` s `DATABASE_UNAVAILABLE`. Selhání pouze doplňkových e-mailových metrik vrací HTTP `200`, `status=warning` a `EMAIL_HEALTH_UNAVAILABLE`; detail hledej v `journalctl -u ppstudio-web.service -n 200 --no-pager`.

## Rollback

Nejrychlejší rollback možnosti:

1. nechat release script vrátit předchozí symlink `current`, pokud rollback spustil automaticky
2. ručně obnovit předchozí LXC snapshot
3. obnovit DB dump, pokud problém způsobilá migrace změnila data

Pozor:

- rollback aplikace bez rollbacku migrace nemusí stačit; při produkčním incidentu preferuj dopřednou kompatibilní opravu migrace
- rollback DB bez rollbacku uploadů nebo souborů může rozbít média

## Související dokumenty

- [ENVIRONMENT.md](ENVIRONMENT.md)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
