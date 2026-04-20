# Environment Variables

Dokumentace proměnných prostředí pro lokální vývoj i produkci.

## Pravidla
- Tajné hodnoty nikdy neukládej do repozitáře.
- Každá nová proměnná musí mít popis a příklad v `.env.example`.
- Runtime proměnné používané aplikací se validují při startu přes `src/config/env.ts`.
- CLI-only proměnné pro Prisma, například `SHADOW_DATABASE_URL`, načítá `prisma.config.ts` a nevalidují se při startu Next.js serveru.

## Přehled
- `NODE_ENV`: režim běhu (`development`, `production`).
- `NEXT_PUBLIC_APP_NAME`: veřejný název značky.
- `NEXT_PUBLIC_APP_URL`: veřejná URL aplikace, používá se i pro metadata a canonical základ webu.
- `DATABASE_URL`: PostgreSQL connection string pro Prisma.
- `SHADOW_DATABASE_URL`: pomocná databáze pro `prisma migrate dev` (lokální vývoj).
- `ADMIN_SESSION_SECRET`: klíč pro podpis admin session cookie.
- `ADMIN_OWNER_EMAIL`: bootstrap email pro owner admin účet.
- `ADMIN_OWNER_PASSWORD`: bootstrap heslo pro owner admin účet.
- `ADMIN_STAFF_EMAIL`: bootstrap email pro lite admin účet (role `SALON`).
- `ADMIN_STAFF_PASSWORD`: bootstrap heslo pro lite admin účet (role `SALON`).
- `EMAIL_DELIVERY_MODE`: režim e-mailové delivery (`log`, `background`).
- `SMTP_HOST`: SMTP hostname pro produkční odesílání.
- `SMTP_PORT`: SMTP port.
- `SMTP_SECURE`: `true` pro implicitní TLS, jinak `false`.
- `SMTP_USER`: SMTP login.
- `SMTP_PASSWORD`: SMTP heslo nebo app password.
- `SMTP_FROM_EMAIL`: adresa odesílatele.
- `SMTP_FROM_NAME`: jméno odesílatele zobrazované klientovi.
- `SMTP_REPLY_TO`: volitelná reply-to adresa.
- `MEDIA_STORAGE_ROOT`: volitelná absolutní cesta k lokálnímu root adresáři pro nahraná média; pokud chybí, aplikace použije `../ppstudio-uploads` vedle repozitáře.

## Poznámky
- Bootstrap admin přístupy slouží jako startovní vrstva projektu a měly by být později nahrazené databázovým managementem uživatelů.
- V produkci používej silná hesla a unikátní `ADMIN_SESSION_SECRET`.
- Veřejný obsah salonu není řízený env proměnnými; texty a placeholdery jsou centralizované v `src/content/public-site.ts`.
- Bootstrap přístupy se zobrazují i v owner sekci `Uživatelé / role`, aby šlo při provozu snadno dohledat aktivní zdroje přístupu.
- Pokud je `EMAIL_DELIVERY_MODE=background`, jsou `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` a `SMTP_FROM_EMAIL` povinné už při startu aplikace.
- Pokud je `EMAIL_DELIVERY_MODE=background`, admin pole `emailSenderEmail` v sekci `Nastavení` musí odpovídat `SMTP_FROM_EMAIL`; jinak aplikace změnu odmítne, aby se předešlo selhání doručování.
- `EMAIL_DELIVERY_MODE=log` je vhodný pro lokální vývoj, testovací rollout a safe-mode při produkčním incidentu s SMTP.
- Po změně `prisma/schema.prisma` už `npm run dev` a `npm run build` automaticky obnoví generovaný Prisma klient, ale při ruční práci s CLI je stále bezpečné spustit i `npm run db:generate`.
- Slot admin CRUD nezavádí žádné nové env proměnné; spoléhá na stávající session, databázi a bootstrap admin účty.
- Refaktor veřejného výběru časů v `/rezervace` také nezavádí žádné nové env proměnné; jde čistě o klientskou UI vrstvu nad existujícím booking catalogem.
- Admin sekce `Služby` také nepřidává nové env proměnné; používá stávající databázi, session a Prisma klient.
- Admin sekce `Kategorie služeb` také nepřidává nové env proměnné; používá stejnou databázi, session a Prisma klient jako zbytek adminu.
- Admin sekce `Nastavení` také nepřidává nové env proměnné; kontaktní údaje, booking pravidla a e-mailový branding ukládá do DB modelu `SiteSettings`.
- Do admin sekce `Nastavení` záměrně nepatří technické hodnoty jako `NEXT_PUBLIC_APP_URL`, `ADMIN_SESSION_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` nebo `SMTP_PASSWORD`.
- `MEDIA_STORAGE_ROOT` je infrastrukturní proměnná, ne business nastavení. Nepatří do adminu a má se spravovat na úrovni serveru nebo deploy konfigurace.
- Doporučená produkční cesta je mimo repo i mimo `.next`, například `/var/www/ppstudio-uploads`.
- Aplikace uvnitř storage rootu sama odděluje `public/`, `private/` a připravený `temp/` prostor pro budoucí drafty nebo přechodné uploady; veřejné soubory pak servíruje přes URL vrstvu `/media/*`.
- Refaktor owner/salon admin route wrapperů na sdílené factory funkce nezavádí žádné nové env proměnné.
- Povolené LAN originy pro Next.js dev server nejsou env proměnné; udržují se přímo v `next.config.ts` přes `allowedDevOrigins` a po změně vyžadují restart `npm run dev`.

## Poznámka k týdennímu planneru slotů
- Týdenní planner dostupností nepřidává žádné nové env proměnné.
- Přímá editace v 30min gridu, copy day/week i lokální šablona týdne používají stejné existující základy:
  - `DATABASE_URL`
  - `ADMIN_SESSION_SECRET`
  - bootstrap admin účty pro `OWNER` a `SALON`
