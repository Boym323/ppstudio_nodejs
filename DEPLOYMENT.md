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

Vyhrazený účet `ppstudio` vytváří `systemd-sysusers` bez přihlašovacího shellu. `systemd-tmpfiles` připraví privátní stavový adresář a výchozí upload root; release helper nastaví oprávnění skutečného `MEDIA_STORAGE_ROOT`, release artefaktu a `.env`.

Před prvním hardenovaným releasem odstraň z `.env` staré explicitní `SITE_SETTINGS_SNAPSHOT_PATH=/var/www/ppstudio/site-settings-snapshot.json`, nebo jej změň na `/var/lib/ppstudio/site-settings-snapshot.json`. Při použití nového fallbacku release existující snapshot jednorázově zkopíruje; checkout záměrně neudělí runtime uživateli právo přejmenovávat soubory ve svém kořeni.

## Systemd služby

Soubory:

- [deploy/systemd/ppstudio-web.service](deploy/systemd/ppstudio-web.service#L1)
- [deploy/systemd/ppstudio-email-worker.service](deploy/systemd/ppstudio-email-worker.service#L1)

### `ppstudio-web`

- běží jako neprivilegovaný uživatel a skupina `ppstudio`
- `WorkingDirectory=/var/www/ppstudio/current`
- načítá stabilní `/var/www/ppstudio/.env` i release-local `.release-env`
- startuje `npm run start`
- běží jako `next start` na `PORT=3000`; verzovaná unit aktuálně naslouchá na `0.0.0.0`, proto musí port 3000 chránit síťová vrstva popsaná níže

### `ppstudio-email-worker`

- běží jako neprivilegovaný uživatel a skupina `ppstudio`
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
6. po úspěšném buildu zastaví web i worker a ověří, že žádný z nich neběží jako writer
7. aplikuje `npx prisma migrate deploy` a teprve po úspěchu atomicky přepne `current`
8. spustí web i worker nad stejným releasem
9. nejdřív přes `/api/health/live` tiše vyčká na otevření webového endpointu, potom ověří DB readiness `/api/health` a homepage smoke test
10. při selhání migrace nový release neaktivuje; při selhání startu nebo kontrol vrátí symlink, ale služby ponechá fail-closed zastavené, dokud není ručně potvrzena kompatibilita schématu

### Media Library v2 – staged upgrade

Upgrade Media Library v2 z pre-v2 databáze s existujícími daty nesmí být proveden
jako jediný přímý deploy finálního `main`. `release.sh` provádí `migrate deploy`
před aktivací nového release, proto destruktivní contract migrace vyžaduje, aby
všechny rollback kandidáty už používaly contract-ready runtime.

Pořadí musí být:

1. expand migrace
2. backfill existujících vazeb
3. relational runtime
4. contract-ready runtime bez závislosti na legacy poli `MediaAsset`
5. contract migrace

Po expand migraci a před aktivací relational public runtime vždy spusť backfill.
Bezpečný postup je nejprve ověřit stav dry-runem:

```sh
npm run db:backfill-media-library-v2
```

Poté lze explicitně povolit produkční zápis pouze přes:

```sh
npm run db:backfill-media-library-v2 -- --confirm-production
```

Po zápisu spusť znovu dry-run; musí být idempotní a hlásit 0 změn. Obyčejný
`--confirm` produkční zápis nepovoluje. Relational runtime nesmí být aktivován
před úspěšným backfillem a contract migrace nesmí následovat před contract-ready
runtime.

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

## Důvěryhodná klientská IP a port 3000

Repozitář dokládá Proxmox/LXC a použití Nginx Proxy Manageru, ale neobsahuje jeho konfiguraci ani firewall. Nelze proto určit, zda proxy běží na stejném, nebo jiném hostu. Závaznou podmínkou provozu je, že klient nesmí navázat přímé spojení na Next.js port 3000; jinak může podvrhnout `X-Real-IP` a obejít IP část rate limitů.

- Je-li Nginx/NPM ve stejném síťovém namespace (typicky stejném LXC), změň ve web unitě i její `.example` variantě `Environment=HOSTNAME=127.0.0.1` (případně `::1` pro IPv6) a ověř, že proxy připojuje na loopback. Proxy v jiném LXC je z pohledu aplikace vzdálená.
- Je-li proxy na jiném hostu, ponech bind pouze tehdy, když firewall před aplikací povolí TCP/3000 výhradně ze skutečných IP adres nebo CIDR této proxy a zakáže jej ze všech ostatních zdrojů. Stejné pravidlo nastav pro IPv6, pokud je port dostupný přes IPv6. Nepoužívej zástupné adresy; vycházej z reálného managementu proxy/infrastruktury.
- Princip pravidla je: `allow tcp dport 3000 from <skutečný-proxy-ip-nebo-cidr>` a následně `deny tcp dport 3000 from any`; ekvivalentně pro IPv6. Hodnota v úhlových závorkách musí být při nasazení nahrazena doloženou adresou nebo sítí proxy, ne odhadnutou adresou aplikace ani klientů. Pravidlo patří na síťovou hranici, která skutečně chrání tento LXC/host.
- V produkční proxy musí být pro požadavek na upstream provedeno přepsání (ne pouhé doplnění) hlavičky: `proxy_set_header X-Real-IP $remote_addr;`. Ověř konfiguraci například přes `nginx -T` nebo odpovídající konfiguraci NPM.
- Pro `POST /api/webhooks/resend` nastav na reverse proxy limit request body nejvýše `256k` (v nginx například `client_max_body_size 256k;`). Aplikace stejný limit vynucuje při streamovaném čtení; proxy je první ochranná vrstva.
- Je-li před Nginx/NPM CDN či další proxy, musí Nginx akceptovat `real_ip_header` jen od jejího skutečného allowlistu přes `set_real_ip_from`; teprve potom je `$remote_addr` vhodný pro uvedené přepsání. Aplikace záměrně nikdy nepřebírá `X-Forwarded-For`.

Před uzavřením deploymentu ověř z hostu aplikace skutečný listener (`ss -ltnp`), konfiguraci proxy a firewall v jeho aktivním enforcement pointu. Z jiné než důvěryhodné proxy sítě musí být TCP spojení na port 3000 odmítnuto; přes veřejnou proxy musí požadavek stále fungovat a upstream musí dostat proxy přepsané `X-Real-IP`. Tyto vlastnosti nelze potvrdit unit testem ani jen z tohoto repozitáře.

Verzovaná unit zachovává bind `0.0.0.0:3000`, protože doložená konfigurace neurčuje umístění NPM. To není samostatně bezpečný stav: před restartem hardenovaných unitů musí operátor buď zvolit loopback variantu pro lokální proxy, nebo doložit aktivní firewallový allowlist vzdálené proxy. Bez jedné z těchto podmínek deploy nedokončuj.

## Po deployi ověř

- `systemctl status ppstudio-web`
- `systemctl status ppstudio-email-worker`
- `curl https://.../api/health`
- admin login
- vytvoření testovací rezervace
- stav e-mail workeru
- dostupnost uploadovaných médií
- pokud je aktivní Matomo reporting, i `/api/admin/analytics`

Veřejný readiness endpoint při výpadku databáze vrací HTTP `503` s `DATABASE_UNAVAILABLE`; jinak vrací jen `status=ok`. Stav workeru, fronty, recipient incidentů a release identity je dostupný pouze ownerovi na `/api/health/diagnostics`; detail chyb hledej v `journalctl -u ppstudio-web.service -n 200 --no-pager`.

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
