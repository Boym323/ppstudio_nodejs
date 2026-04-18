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

### Changed
- Výchozí Next.js demo bylo nahrazeno čistým škálovatelným scaffoldingem pro produkční vývoj.
- `.env.example` nyní pokrývá databázi a bootstrap admin přístupy.
- Lite admin role byla v databázové vrstvě přejmenovaná z `STAFF` na `SALON`.
- `AvailabilitySlot` už není navázaný na jednu službu; omezení služeb je řešené přes M:N vazbu.
- Slot teď explicitně říká, zda bere libovolnou službu nebo jen vybrané služby.

### Fixed
- Návrh datové vrstvy už nespoléhá na zjednodušený booking request model bez auditní historie a bez bezpečných tokenů.
- Datový model lépe chrání proti náhoditému duplicitnímu bookingu stejného klienta do stejného slotu.

### Removed
- Výchozí create-next-app homepage.
