# 0090 Email template SiteSettings contact v1

## Kontext

Booking a voucher e-maily historicky obsahovaly pevně zapsané kontaktní údaje PP Studia přímo v šablonách. Projekt už ale má `SiteSettings`, `getPublicSalonProfile()` a `getEmailBrandingSettings()`, které jsou zdrojem pravdy pro veřejný salon kontakt a e-mailový branding.

## Rozhodnutí

Klientské booking e-maily budou pro název, adresu, telefon a e-mail používat data ze `SiteSettings` přes existující public/branding helpery. Mapový odkaz se bude skládat jako Google Maps query z aktuálního názvu a adresy. Pevné údaje PP Studia zůstanou pouze jako fallback při chybějícím nastavení nebo nedostupné DB.

`EmailLog`, worker, `templateKey` názvy ani payload kontrakty se kvůli této změně nemění. HTML šablony dál ručně escapují uživatelské hodnoty a zachovávají text/plain varianty. Náhledy se generují dev skriptem `npm run email:previews` do `tmp/email-previews`.

## Alternativy

- Přidat `mapUrl` do `SiteSettings`: odloženo, protože by šlo o DB/model změnu kvůli jedinému odkazu a aktuální adresa stačí pro stabilní Google Maps query.
- Přepsat e-mailový systém do samostatných komponent: odmítnuto jako zbytečně rizikové pro existující outbox a worker workflow.
- Přidat dev-only route pro náhledy: odmítnuto ve prospěch skriptu bez zásahu do Next.js routingu a bez nové knihovny.

## Důsledky

- Změna kontaktu v admin nastavení se projeví i v klientských e-mailech.
- Fallbacky zůstávají pro bezpečný provoz při DB chybě.
- Náhledy jsou statické HTML soubory a nejsou zdrojem pravdy pro frontu ani doručování.

## Stav

schváleno
