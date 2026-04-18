# Changelog

Všechny důležité změny v tomto projektu se zapisují do tohoto souboru.

Formát je inspirovaný Keep a Changelog.

## [Unreleased]

### Added
- Produkční základ projektu pro veřejný web, rezervace a admin sekce.
- Route groups pro `public`, `booking` a `admin`.
- Design tokens a sdílené layout komponenty pro luxusní prezentační web.
- Prisma schema v1 pro admin uživatele, služby, ručně vypisované sloty, klienty, rezervace, historii stavů, e-mailové logy, settings a bezpečné action tokeny.
- Databázová migrace s backfillem klientů, slot-service omezení a převodem `BookingRequest` na plnohodnotný `Booking`.
- Server-side env validace a auth skeleton s rolemi `OWNER` a `SALON`.
- `proxy.ts` ochrana admin cest podle konvencí Next.js 16.
- Architektonická dokumentace v `README.md` a nové ADR.
- Navazující review migrace pro explicitní režim omezení služeb na slotu, reschedule chain a DB ochranu proti překrývajícím se aktivním slotům.
- Veřejný prezentační web pro kosmetický salon s kompletní sadou obsahových stránek, detailů služeb a právních podstránek.
- Centrální obsahová vrstva `src/content/public-site.ts` pro snadnou výměnu placeholder textů, cen a foto briefů.
- Rezervační flow V1 na `/rezervace` se 4 kroky, server action submit handlerem a mobilním wizard UI.
- Veřejná booking service vrstva pro načtení služeb, publikovaných slotů a transakční vytvoření rezervace.
- Příprava storno URL a `EmailLog` payloadu pro potvrzovací e-mail při vytvoření rezervace.
- Placeholder route pro tokenizované storno odkazy na `/rezervace/storno/[token]`.
- PostgreSQL driver adapter setup přes `@prisma/adapter-pg` a `pg` pro Prisma 7 runtime.

### Changed
- Výchozí Next.js demo bylo nahrazeno čistým škálovatelným scaffoldingem pro produkční vývoj.
- `.env.example` nyní pokrývá databázi a bootstrap admin přístupy.
- Lite admin role byla v databázové vrstvě přejmenovaná z `STAFF` na `SALON`.
- `AvailabilitySlot` už není navázaný na jednu službu; omezení služeb je řešené přes M:N vazbu.
- Slot teď explicitně říká, zda bere libovolnou službu nebo jen vybrané služby.
- Hlavní navigace a footer nyní odpovídají IA veřejného webu a posilují cestu k rezervaci i důvěru.
- SEO metadata veřejných stránek jsou sjednocená přes globální metadata base a per-page metadata.
- Rezervační stránka už není statický placeholder; načítá reálné služby a ručně publikované sloty z databáze.

### Fixed
- Návrh datové vrstvy už nespoléhá na zjednodušený booking request model bez auditní historie a bez bezpečných tokenů.
- Datový model lépe chrání proti náhoditému duplicitnímu bookingu stejného klienta do stejného slotu.
- Veřejný web už není omezený na technický placeholder homepage bez struktury pro reálný salonní obsah.
- Veřejný booking zápis nyní znovu ověřuje slot v transakci a lépe chrání proti dvojité rezervaci při souběžném submitu.

### Removed
- Výchozí create-next-app homepage.
