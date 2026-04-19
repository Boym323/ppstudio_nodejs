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
- Role-aware admin IA s oddělenou navigací a routami pro full admin (`/admin/*`) a lite admin (`/admin/provoz/*`).
- Přehledové admin sekce nad reálnými Prisma daty pro rezervace, sloty, klienty, služby, kategorie, uživatele, email logy a nastavení.
- Serverové guard helpery pro admin area a sekce, včetně role-based redirectů a `notFound` ochrany neplatných cest.
- Produkční email delivery vrstva s režimy `log` a `background`, renderováním šablon a SMTP providerem v background režimu nad `EmailLog`.
- Skutečné veřejné storno rezervace přes tokenizovaný odkaz, potvrzovací krok a audit změny stavu.
- Metadata routes pro `robots.txt` a `sitemap.xml`.
- Booking error boundary, loading fallback a základní unit testy pro e-mailové šablony.
- ADR 0008 pro rozhodnutí kolem e-mailů a veřejného storna.
- Systemd units pro hlavní Next.js app a background e-mail worker.
- Deployment notes pro systemd a Docker Compose provoz workeru.
- Owner-only admin obrazovka pro pending/retrying emaily a poslední chyby workeru.
- Owner-only detail email logu s payloadem, chybou, ručním retry a uvolněním zaseknutého jobu.
- První produkční detail rezervace v adminu pro `OWNER` i `SALON`, včetně napojení ze seznamů a dashboardu.
- Produkční admin CRUD pro `AvailabilitySlot` v owner i salon oblasti, včetně seznamu, filtrů, detailu, vytvoření, editace, blokace a bezpečného mazání.
- Týdenní planner dostupností pro `OWNER` i `SALON`, včetně denních karet, sekundárního detailu dne, batch create a návratu zpět do stejného týdne po akci.
- UX vylepšení slot adminu: chytřejší create formulář, jednodušší create flow pro roli `SALON` a jasnější error/success feedback po akcích.

### Changed
- Výchozí Next.js demo bylo nahrazeno čistým škálovatelným scaffoldingem pro produkční vývoj.
- `.env.example` nyní pokrývá databázi a bootstrap admin přístupy.
- Lite admin role byla v databázové vrstvě přejmenovaná z `STAFF` na `SALON`.
- `AvailabilitySlot` už není navázaný na jednu službu; omezení služeb je řešené přes M:N vazbu.
- Slot teď explicitně říká, zda bere libovolnou službu nebo jen vybrané služby.
- Hlavní navigace a footer nyní odpovídají IA veřejného webu a posilují cestu k rezervaci i důvěru.
- SEO metadata veřejných stránek jsou sjednocená přes globální metadata base a per-page metadata.
- Rezervační stránka už není statický placeholder; načítá reálné služby a ručně publikované sloty z databáze.
- Veřejné booking flow má přesnější server-side validaci, retry při serializable konfliktech a konkrétnější chybové stavy pro stale službu, stale slot i duplicitní rezervaci stejného klienta.
- Veřejný booking submit má lehký rate limit, auditní log pokusů a blokací a krok 2 už schovává sloty kratší než vybraná služba.
- Admin UI už není jen dvojice placeholder dashboardů; `OWNER` a `SALON` mají odlišné rozhraní, navigaci a úroveň detailu.
- Přesměrování po loginu i při nedostatečném oprávnění se teď řídí centrální helper funkcí podle role.
- `SALON` rozhraní má kratší menu, méně technický jazyk a rychlé akce pro přidání termínu a práci s rezervací.
- Rezervační flow už po úspěšném commitu rovnou zpracovává potvrzovací e-mail a ve UI rozlišuje, zda delivery proběhla nebo selhala.
- Placeholder storno route byla nahrazená produkčním flow nad `BookingActionToken`.
- Root metadata byla rozšířená o základní SEO signály pro nasazení v1.
- Admin rezervace už nejsou jen read-only seznam; detail nyní umožňuje server-side změnu stavu s důvodem, interní poznámkou a auditní historií.
- Sekce `Volné termíny` už není jen read-only přehled; statické route `/admin/volne-terminy*` a `/admin/provoz/volne-terminy*` teď přebírají plné provozní workflow pro sloty.
- Slot create formulář má nyní provozní defaulty a rychlé přepínače délky; výběr služeb se ukazuje jen při režimu `SELECTED`.
- Dokumentace byla srovnaná s aktuálním kódem: týdenní planner, `EMAIL_DELIVERY_MODE=background` a produkční migrace přes `prisma migrate deploy`.

### Fixed
- Návrh datové vrstvy už nespoléhá na zjednodušený booking request model bez auditní historie a bez bezpečných tokenů.
- Datový model lépe chrání proti náhoditému duplicitnímu bookingu stejného klienta do stejného slotu.
- Veřejný web už není omezený na technický placeholder homepage bez struktury pro reálný salonní obsah.
- Veřejný booking zápis nyní znovu ověřuje slot v transakci a lépe chrání proti dvojité rezervaci při souběžném submitu.
- Storno odkaz už není slepý placeholder bez skutečné server-side akce.
- E-mailová komunikace kolem rezervací má auditovatelný stav `SENT` / `FAILED` místo pouhého připraveného payloadu.
- Admin `Email logy` už se nerozbije na zastaralém generovaném Prisma klientu; `dev` i `build` si předem automaticky generují aktuální client.
- Lite admin navigace znovu ukazuje všechny sdílené provozní sekce, takže dostupné routy odpovídají menu.
- Dynamické admin sekce `/admin/[section]`, `/admin/provoz/[section]` a `/admin/email-logy/[emailLogId]` už se renderují v admin shellu i při přímém otevření URL, takže se neresetuje vzhled na veřejný theme background.
- Slot formuláře a server actions nyní zachytí nekonzistence dřív, než spadnou na DB constraintu: časové pořadí, překryvy, podstřelenou kapacitu i neplatné omezení služeb.
- Slot status/delete akce nově vrací chybový flash kontext, takže obsluha hned vidí, proč akce neprošla.

### Removed
- Výchozí create-next-app homepage.
