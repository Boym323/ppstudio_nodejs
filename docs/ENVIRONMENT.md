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

## Poznámky
- Bootstrap admin přístupy slouží jako startovní vrstva projektu a měly by být později nahrazené databázovým managementem uživatelů.
- V produkci používej silná hesla a unikátní `ADMIN_SESSION_SECRET`.
- Veřejný obsah salonu není řízený env proměnnými; texty a placeholdery jsou centralizované v `src/content/public-site.ts`.
- Bootstrap přístupy se zobrazují i v owner sekci `Uživatelé / role`, aby šlo při provozu snadno dohledat aktivní zdroje přístupu.
- Pokud je `EMAIL_DELIVERY_MODE=background`, jsou `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` a `SMTP_FROM_EMAIL` povinné už při startu aplikace.
- `EMAIL_DELIVERY_MODE=log` je vhodný pro lokální vývoj, testovací rollout a safe-mode při produkčním incidentu s SMTP.
- Po změně `prisma/schema.prisma` už `npm run dev` a `npm run build` automaticky obnoví generovaný Prisma klient, ale při ruční práci s CLI je stále bezpečné spustit i `npm run db:generate`.
- Slot admin CRUD nezavádí žádné nové env proměnné; spoléhá na stávající session, databázi a bootstrap admin účty.
- Refaktor owner/salon admin route wrapperů na sdílené factory funkce nezavádí žádné nové env proměnné.
- Povolené LAN originy pro Next.js dev server nejsou env proměnné; udržují se přímo v `next.config.ts` přes `allowedDevOrigins` a po změně vyžadují restart `npm run dev`.

## Poznámka k týdennímu planneru slotů
- Týdenní planner dostupností nepřidává žádné nové env proměnné.
- Přímá editace v 30min gridu, copy day/week i lokální šablona týdne používají stejné existující základy:
  - `DATABASE_URL`
  - `ADMIN_SESSION_SECRET`
  - bootstrap admin účty pro `OWNER` a `SALON`
