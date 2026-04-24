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
- `SMTP_SECURE`: `auto` pro volbu podle portu, `true` pro implicitní TLS, `false` pro explicitní STARTTLS nebo plain transport podle provideru.
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
- Provozní identita veřejného webu (jméno provozovatelky a IČ používané na `/kontakt` a `/obchodni-podminky`) aktuálně také není env konfigurace; je součástí sdíleného public profile helperu v `src/lib/site-settings.ts`.
- Admin login rate limit nepřidává novou env proměnnou; limity jsou zatím fixované v `src/lib/auth/admin-login-rate-limit.ts` (okno 10 minut, IP limit 20, e-mail fail limit 6).
- Hero fotografie pro `/o-mne` je aktuálně ručně verzovaný asset v `public/brand`; finální přepnutí na jiný soubor nevyžaduje novou env proměnnou, jen úpravu `aboutContent.profile.image`.
- Bootstrap přístupy se v owner sekci `Uživatelé / role` zobrazují lidským jazykem jako `Systémový účet`; UI záměrně neukazuje `env`, `bootstrap` ani jiné technické implementační detaily jako hlavní obsah.
- Pokud je `EMAIL_DELIVERY_MODE=background`, jsou `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` a `SMTP_FROM_EMAIL` povinné už při startu aplikace.
- Pokud je `EMAIL_DELIVERY_MODE=background`, admin pole `emailSenderEmail` v sekci `Nastavení` musí odpovídat `SMTP_FROM_EMAIL`; jinak aplikace změnu odmítne, aby se předešlo selhání doručování.
- `NEXT_PUBLIC_APP_URL` je kritická i pro provozní approve/reject odkazy v e-mailu; pokud míří na špatný host nebo schéma, owner email akce povedou na neplatnou URL.
- `NEXT_PUBLIC_APP_URL` je stejně kritická i pro klientský self-service manage link `/rezervace/sprava/[token]`; pokud míří na špatný host nebo schéma, confirmation screen, potvrzovací e-mail i reminder povedou na neplatnou URL.
- `NEXT_PUBLIC_APP_URL` je stejně kritická i pro zákaznický `.ics` odkaz `/api/bookings/calendar/[token].ics`; pokud míří na špatný host nebo schéma, CTA `Přidat do kalendáře` v potvrzovacím e-mailu povede na neplatnou URL.
- `NEXT_PUBLIC_APP_URL` je stejně kritická i pro owner ICS subscription feed; z této hodnoty se skládá kopírovatelný Apple Calendar odkaz v adminu.
- Nový approve/reject email flow nepřidává žádnou novou env proměnnou; využívá existující `NEXT_PUBLIC_APP_URL`, `ADMIN_SESSION_SECRET` a e-mailovou konfiguraci.
- Zákaznický `.ics` event také nepřidává novou env proměnnou; používá stejné `NEXT_PUBLIC_APP_URL` a hashovaný `BookingActionToken`.
- Kalendářový feed také nepřidává novou env proměnnou; bezpečnost stojí na existujících `NEXT_PUBLIC_APP_URL` a `ADMIN_SESSION_SECRET`.
- Pokud měníš `ADMIN_SESSION_SECRET`, zneplatníš tím existující admin session a zároveň i starší odvozené ICS subscription URL. Po takové změně je potřeba v `/admin/nastaveni` feed znovu zkontrolovat a případně rotovat.
- Změna `ADMIN_SESSION_SECRET` sama o sobě nezneplatní už vydané zákaznické calendar tokeny, protože ty jsou ukládané jako hash v `BookingActionToken`; pokud je chceš po bezpečnostním incidentu stáhnout, revokují se přes změnu stavu rezervace nebo ruční zásah do tokenů.
- Pro SMTP produkci je doporučené `SMTP_SECURE=auto`; port `465`/`2465` se přepne na implicit TLS, `587`/`2587` na STARTTLS.
- `EMAIL_DELIVERY_MODE=log` je vhodný pro lokální vývoj, testovací rollout a safe-mode při produkčním incidentu s SMTP.
- Po změně `prisma/schema.prisma` už `npm run dev` a `npm run build` automaticky obnoví generovaný Prisma klient, ale při ruční práci s CLI je stále bezpečné spustit i `npm run db:generate`.
- Slot admin CRUD nezavádí žádné nové env proměnné; spoléhá na stávající session, databázi a bootstrap admin účty.
- Ruční vytvoření rezervace v adminu také nepřidává nové env proměnné; používá stejné `NEXT_PUBLIC_APP_URL`, `ADMIN_SESSION_SECRET`, DB schéma a e-mailovou konfiguraci jako veřejný booking.
- Přepnutí `BookingSource` na nové provozní enum hodnoty (`WEB`, `PHONE`, `INSTAGRAM`, `IN_PERSON`, `OTHER`) je čistě databázová a aplikační změna, ne nová env konfigurace.
- Refaktor veřejného výběru časů v `/rezervace` také nezavádí žádné nové env proměnné; jde čistě o klientskou UI vrstvu nad existujícím booking catalogem.
- Admin sekce `Služby` také nepřidává nové env proměnné; používá stávající databázi, session a Prisma klient.
- Přepracované admin workflow `Služby` a `Kategorie služeb` také nepřidává nové env proměnné; create, quick actions, mobilní detail i varování běží čistě nad existující databází, session a Prisma klientem.
- Operativní redesign admin overview dashboardu také nepřidává nové env proměnné; nové metriky a timeline berou data jen ze stávajících modelů `Booking`, `AvailabilitySlot`, `Client`, `ServiceCategory`, `Service` a `EmailLog`.
- Admin sekce `Nastavení` také nepřidává nové env proměnné; kontaktní údaje, booking pravidla a e-mailový branding ukládá do DB modelu `SiteSettings`.
- Přestavba sekce `Uživatelé / role` ani invite aktivace nepřidává nové env proměnné; používá existující `ADMIN_SESSION_SECRET` (hash tokenů) a `NEXT_PUBLIC_APP_URL` (link v pozvánce), plus DB pole `AdminUser.invitedAt` a tabulku `AdminUserInviteToken`.
- Reminder systém 24 hodin před termínem nepřidává novou env proměnnou; používá existující `EMAIL_DELIVERY_MODE`, `NEXT_PUBLIC_APP_URL` a SMTP konfiguraci stejného `email:worker`.
- Admin reschedule flow také nepřidává novou env proměnnou; používá stejné `NEXT_PUBLIC_APP_URL`, `ADMIN_SESSION_SECRET`, DB schéma a email worker jako ostatní booking workflow.
- Klientský self-service přesun termínu také nepřidává novou env proměnnou; stojí na stejném `NEXT_PUBLIC_APP_URL`, hashovaných `BookingActionToken`, DB schématu a e-mailovém workeru.
- Do admin sekce `Nastavení` záměrně nepatří technické hodnoty jako `NEXT_PUBLIC_APP_URL`, `ADMIN_SESSION_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` nebo `SMTP_PASSWORD`.
- `MEDIA_STORAGE_ROOT` je infrastrukturní proměnná, ne business nastavení. Nepatří do adminu a má se spravovat na úrovni serveru nebo deploy konfigurace.
- Doporučená produkční cesta je mimo repo i mimo `.next`, například `/var/www/ppstudio-uploads`.
- Aplikace uvnitř storage rootu sama odděluje `public/`, `private/` a připravený `temp/` prostor pro budoucí drafty nebo přechodné uploady; veřejné soubory pak servíruje přes URL vrstvu `/media/*`.
- Refaktor owner/salon admin route wrapperů na sdílené factory funkce nezavádí žádné nové env proměnné.
- Povolené LAN originy pro Next.js dev server nejsou env proměnné; udržují se přímo v `next.config.ts` přes `allowedDevOrigins` a po změně vyžadují restart `npm run dev`.

## Poznámka k týdennímu planneru slotů
- Týdenní planner dostupností nepřidává žádné nové env proměnné.
- Přímá editace v 30min gridu, lokální koncept týdne, copy day/week i lokální šablona týdne používají stejné existující základy:
  - `DATABASE_URL`
  - `ADMIN_SESSION_SECRET`
  - bootstrap admin účty pro `OWNER` a `SALON`
- Koncept týdne i týdenní šablona se ukládají do `localStorage` v browseru; nejsou to env proměnné ani sdílená serverová konfigurace.
