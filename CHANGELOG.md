# Changelog

Všechny důležité změny v tomto projektu se zapisují do tohoto souboru.

Formát je inspirovaný Keep a Changelog.

## [Unreleased]

### Added
- Produkční admin sekci `Kategorie služeb` pro `OWNER` i `SALON` s responzivním seznamem, filtrováním, výběrem kategorie a krátkou editací nad reálnými Prisma daty.
- Server action a Zod validační vrstvu pro bezpečnou editaci názvu, volitelného popisu, pořadí a aktivního stavu kategorie.
- Bezpečné mazání pouze pro prázdné kategorie bez navázaných služeb.
- ADR 0015 pro admin workflow kategorií služeb a bezpečné chování vazby kategorie -> služby.
- Produkční admin sekci `Služby` pro `OWNER` i `SALON` s responzivním seznamem, filtrováním, výběrem služby a jednoduchou editací nad reálnými Prisma daty.
- Server action a Zod validační vrstvu pro bezpečnou editaci názvu, popisů, délky, ceny, kategorie, pořadí a publikačních přepínačů služby.
- Nové pole `Service.isPubliclyBookable`, které odděluje interně aktivní službu od služby skutečně nabízené ve veřejném booking flow.
- ADR 0014 pro admin katalog služeb a oddělení veřejné rezervovatelnosti od obecné aktivity služby.
- `allowedDevOrigins` konfiguraci v `next.config.ts` pro dev přístup z LAN hosta `192.168.0.143`, aby Next.js neblokoval `/_next/webpack-hmr` a další dev-only assety při testování z jiného zařízení.
- Sdílené admin route factory funkce v `src/features/admin/lib/admin-route-factories.tsx` pro owner/salon overview, section, booking detail a slot route varianty.
- Sdílený admin shell layout wrapper `src/features/admin/components/admin-shell-layout.tsx` používaný napříč admin layout soubory.
- Nový týdenní planner dostupností pro `OWNER` i `SALON` nad 30min gridem s přímou editací kliknutím nebo tažením.
- Serverovou merge/split vrstvu, která skládá půlhodinové editace do souvislých intervalů `AvailabilitySlot` kompatibilních s public booking flow.
- Denní rychlé akce `zkopírovat den` a `nastavit den jako zavřeno`, týdenní akci `zkopírovat týden na další` a jednoduchou lokální šablonu týdne.
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
- Týdenní planner dostupností pro `OWNER` i `SALON` nyní zobrazuje rezervace, omezené intervaly, neaktivní sloty i minulý čas v jednom klidném kalendáři.

### Changed
- Domovská stránka teď v levé části hlavičky pod `PP Studio` zobrazuje doplněk `COSMETICS & LAMINATIONS`.
- Sekce `Kategorie služeb` už není jen read-only přehled v `admin-data`; route `/admin/kategorie-sluzeb` a `/admin/provoz/kategorie-sluzeb` renderuje samostatný pracovní workflow se seznamem a editací.
- Admin sekce `Služby` prošla druhým kolem UX zjednodušení: oddělený toolbar, čitelnější formulář po sekcích, kompaktnější seznam a lepší mobilní čitelnost bez změny business logiky.
- Veřejný booking katalog a server-side potvrzení rezervace nově vyžadují u služby nejen `isActive`, ale i `isPubliclyBookable`, takže admin může službu ponechat aktivní pro interní provoz a současně ji skrýt z veřejného bookingu.
- Veřejné stránky `/sluzby`, `/cenik` a detail služby jsou nově napojené na DB request-time read model, takže admin změny služeb se projeví bez rebuildů.
- Úvodní stránka teď používá stejný DB katalog pro featured služby, aby odkazy na detail služby zůstaly konzistentní.
- Sekce `Služby` už není jen read-only přehled v `admin-data`; route `/admin/sluzby` a `/admin/provoz/sluzby` renderuje samostatný pracovní workflow se seznamem a editací.
- Rezervační planner v adminu nyní používá pracovní okno `06:00-20:00` místo celého dne (`00:00-24:00`): mřížka má 28 půlhodinových buněk a serverové validace/cell mapování byly sjednocené na stejný rozsah.
- Admin shell layout byl vizuálně stabilizovaný pro desktop i mobil: širší sidebar na `lg+`, sticky pozice navigace, ochrana proti horizontálnímu přetékání a `min-w-0` pro hlavní obsah.
- Admin page shell dostal responzivní typografii (nadpisy/stats) a jemnější spacing, aby se sekce nelámaly na menších šířkách.
- Owner a salon route soubory v `src/app/(admin)/admin/*` a `src/app/(admin)/admin/provoz/*` byly zredukované na tenké wrappery, které pouze předávají `area` do sdílené factory logiky při zachování stejných URL a oprávnění.
- Route varianty sekce `volne-terminy` (`list`, `novy`, `detail`, `upravit`) teď vedou do stejného týdenního planneru; detail/edit URL se přesměrují do správného týdne.
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
- Sekce `Volné termíny` se posunula z reset placeholderu na produkční týdenní planner bez samostatného formulářového workflow pro běžnou obsluhu.
- Ukládání dostupnosti nově chrání rezervace a složitější sloty server-side a zapisuje jen minimální sadu souvislých intervalů bez zbytečné fragmentace.
- Druhé kolo planneru zjednodušilo mobilní workflow na kompaktní výběr dne, přesunulo sekundární akce do klidnějšího bloku a rozdělilo velkou klientskou komponentu na menší UI části.
- Dokumentace byla srovnaná s aktuálním kódem: týdenní planner, `EMAIL_DELIVERY_MODE=background` a produkční migrace přes `prisma migrate deploy`.

### Fixed
- Hlavička veřejného webu už v browseru nespouští validaci serverových env proměnných; brand text je teď lokální a subtitle na domovce zůstává zachovaný.
- Opravené označování `Minulý čas` v admin planneru: budoucí dny už nejsou chybně blokované podle aktuální hodiny dneška.
- Planner UI nyní používá pevný počet 28 řádků pro pracovní okno `06:00-20:00`, takže se mřížka nerozjíždí ani při rozjetých datech nebo zastaralém client payloadu.
- Planner grid už negeneruje extra řádky bez časových popisků; výška mřížky se nyní primárně řídí `timeLabels` (pracovní okno), a ne nekonzistentní délkou buněk v payloadu.
- Opravené Next.js 16 `use server` chyby: server action soubory už exportují pouze `async` funkce; initial action state objekty byly přesunuté do samostatných modulů pro client komponenty.
- Root layout nově obsahuje `data-scroll-behavior=\"smooth\"`, takže při zapnutém `scroll-behavior: smooth` na `<html>` už nevzniká runtime warning při route přechodech.
- Planner grid už negeneruje přesažené prázdné řádky při rozjezdu mezi počtem `timeLabels` a počtem buněk v datech dne; vykreslení je nyní svázané s reálným počtem dostupných buněk.
- Planner kalendář už nemůže zmizet při nekonzistenci dat z klienta/serveru; počet vykreslených řádků se bere bezpečně z dostupného maxima (`timeLabels` vs. `cells`) místo průniku.
- Výpočet začátku týdne v planneru už nepoužívá UTC den týdne, ale lokální kalendářní den (Praha), takže týden se znovu otevírá správně od pondělí místo posunu na úterý.
- Ukládání změn dostupnosti už nepadá na FK `createdByUserId` při bootstrap přihlášení: server action nyní mapuje session na reálného `AdminUser` podle e-mailu a když záznam neexistuje, uloží slot s `createdByUserId = null`.
- Cross-origin blokaci Next.js dev serveru při otevření aplikace z LAN adresy `192.168.0.143`, která rozbíjela HMR přes `/_next/webpack-hmr`.
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
- Reset komponenta `src/features/admin/components/admin-slots-reset-page.tsx`.
- Původní implementace planneru, formulářů a slot detail/edit workflow byla z feature vrstvy odstraněná:
  - `src/features/admin/components/admin-slots-page.tsx`
  - `src/features/admin/components/admin-slot-form.tsx`
  - `src/features/admin/components/admin-slot-planner-forms.tsx`
  - `src/features/admin/components/admin-slot-detail-page.tsx`
  - `src/features/admin/actions/slot-actions.ts`
  - `src/features/admin/lib/admin-slot-repository.ts`
