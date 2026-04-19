# ADR 0016: Admin sekce Nastavení nad explicitním singleton modelem

## Stav
Accepted

## Kontext
Projekt potřeboval produkční admin sekci `Nastavení`, ale bez toho, aby se z ní stal druhý CMS nebo odkladiště všeho, co se nevejde jinam. Audit ukázal:

- veřejné kontaktní údaje byly natvrdo v `src/config/site.ts` a `src/content/public-site.ts`
- globální booking pravidla byla rozesetá v placeholder obsahu a booking/storno logice
- e-mailová vrstva měla technické SMTP nastavení v env, ale chyběly editovatelné provozní hodnoty jako sender name, sender email a admin notifikační adresa
- Prisma už obsahovala generickou tabulku `Setting`, ale bez aplikační vrstvy a bez záruky přehledného UX

## Rozhodnutí
- Sekce `Nastavení` zůstává owner-only na `/admin/nastaveni`.
- Místo generického key-value použití zavádíme explicitní singleton model `SiteSettings`.
- UI je rozdělené jen do tří bloků:
  - `Salon`
  - `Rezervace`
  - `E-maily a notifikace`
- Do adminu přesouváme pouze skutečně globální hodnoty:
  - název salonu, adresa, telefon, kontaktní e-mail, Instagram
  - minimální předstih rezervace, maximální horizont rezervace, storno limit pro self-service storno
  - admin e-mail pro upozornění, sender name, sender email, volitelná textová patička e-mailů
- Technické hodnoty zůstávají mimo admin:
  - `NEXT_PUBLIC_APP_URL`
  - `ADMIN_SESSION_SECRET`
  - SMTP host/port/login/heslo
  - delivery mode workeru

## Důsledky

### Pozitivní
- formuláře jsou krátké, čitelné a dobře validovatelné
- booking flow získává skutečně globální server-side pravidla bez rozbití správy služeb nebo slotů
- veřejné kontakty, FAQ/storno texty a e-mailová komunikace se synchronizují z jednoho zdroje
- owner má jasně oddělené provozní nastavení od technické infrastruktury

### Negativní
- vzniká nová tabulka a bootstrap vrstva pro zajištění existence singleton záznamu
- sender email z adminu může být provozně neplatný vůči SMTP provideru, pokud neodpovídá povolené adrese
- metadata a canonical základ webu zůstávají dočasně na env hodnotách, takže branding je rozdělený mezi veřejné nastavení a technickou URL konfiguraci

## Alternativy
- Použít existující `Setting` key-value tabulku: zamítnuto kvůli riziku nepřehledného chaosu, slabší typové bezpečnosti a horším formulářům.
- Rozdělit konfiguraci do více tabulek (`BookingSettings`, `NotificationSettings`, `SalonSettings`): zamítnuto, protože pro aktuální scope by to přidalo zbytečnou složitost bez reálného přínosu.
- Přesunout i SMTP technické údaje do adminu: zamítnuto kvůli bezpečnosti, deploy coupling a vyššímu riziku produkčních incidentů.
