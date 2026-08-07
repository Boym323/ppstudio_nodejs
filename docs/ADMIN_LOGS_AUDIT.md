# Audit administrační sekce Události a logy

Datum auditu: 7. 8. 2026  
Stav po implementaci P1: 7. 8. 2026  
Routy: `/admin/logy`, `/admin/provoz/logy`

## Shrnutí

Sekce používá skutečná doménová data, ne syntetický centrální log. Pro současný objem PP Studio je tento přístup přiměřený. Před auditem ale `BookingSubmissionLog` nerozlišoval booking od security a voucher událostí, běžná selhání zvyšovala závažnost a `Pozornost` pokrývala jen e-mailovou frontu. Tyto jednoznačné chyby i navazující P1 mezery jsou opravené. Nové změny účtů, voucherů, služeb a nastavení používají čtyři malé doménové immutable logy; nevznikl univerzální `AuditLog` ani event sourcing.

OWNER a SALON jsou odděleni na routách i při normalizaci view. SALON nemůže otevřít `system`; dotaz pro SALON nenačítá `BookingSubmissionLog` a technická pole `ipHash`, `emailHash`, `userAgent` ani `metadata` se do žádného UI read modelu nevybírají. SALON nadále vidí adresáta a stručnou chybu e-mailu, protože jde o provozní informaci potřebnou k identifikaci nedoručené komunikace; detail, retry/release a technický systémový pohled jsou owner-only.

## Zdroje a zápisy

| Zdroj | Co zaznamenává | Hlavní zapisovači | Co zobrazuje sekce | Současná retence | PII | Viditelnost |
| --- | --- | --- | --- | --- | --- | --- |
| `EmailLog` | frontu, pokusy, výsledek doručení, provider/tracking | booking notifikace, potvrzení a zrušení, přesuny, reminders, vouchery, admin resend, worker a webhook | pohledy E-maily a Pozornost; předmět, adresát, stručná chyba, stav; akce jen OWNER | bez automatického mazání | ano: e-mail, payload a raw tracking | seznam OWNER i SALON; detail a zásahy OWNER |
| `BookingStatusHistory` | změny stavu rezervace a další booking audit přes `reason`/`metadata` | public/manual booking, admin status, e-mailové approve/reject, klientské storno, platby, změna služby/poznámky/ceny | Události: vytvoření, potvrzení, zrušení, dokončení, no-show a doplňkové důvody | bez automatického mazání; FK cascade při smazání bookingu | ano: poznámky a nepřímý kontext klientky | OWNER i SALON |
| `BookingRescheduleLog` | termín před/po přesunu, autora a důvod | `booking-rescheduling.ts` pro klientský i admin přesun | Události: Rezervace přesunuta | bez automatického mazání; FK cascade při smazání bookingu | nepřímo přes booking, důvod může být citlivý | OWNER i SALON |
| `Voucher` | aktuální stav voucheru; není to neměnný log | `voucher-management.ts`, `voucher-operations.ts`, redemption doména | Události používají vytvoření voucheru (`createdAt`) | bez automatického mazání | ano: kupující, e-mail, příjemce, zpráva/poznámka | OWNER i SALON; list logů posílá jen kód voucheru |
| `VoucherChangeLog` | provozní editaci a storno, autora a bezpečné before/after | `voucher-operations.ts` | Události: Voucher upraven/zrušen | bez automatického mazání; FK `Restrict` | hodnoty PII a obsah poznámky se nekopírují, ukládá se jen příznak změny | OWNER i SALON |
| `VoucherRedemption` | jednotlivé čerpání, částku/službu, booking a autora | `voucher-redemption.ts` | Události: Voucher uplatněn | bez automatického mazání; voucher nelze smazat přes `Restrict` | nepřímo přes booking/voucher, volná poznámka | OWNER i SALON |
| `AvailabilityAuditEvent` | neměnný stav dostupnosti před/po, sloty, autora, operaci a undo vazbu | `admin-slots/mutations.ts` | Události: ADD, REMOVE a UNDO; renderer umí i starší enumy CLEAR/COPY_WEEK/APPLY_TEMPLATE/SYNC_DRAFT | bez automatického mazání | bez klientského PII; jméno admina a interní slot ID | OWNER i SALON; odkaz se tvoří podle aktuální role |
| `ServiceChangeLog` | rezervovatelnost, aktivitu, délku, kategorii, veřejný název/SEO titul a typy změněného veřejného obsahu | `service-actions.ts`, `service-change-operations.ts` | Události: Služba upravena | bez automatického mazání; FK `Restrict` | bez klientského PII | OWNER i SALON |
| `SiteSettingsChangeLog` | salonní údaje, booking policy a e-mailová nastavení s before/after | `settings-actions.ts`, `site-settings-audit.ts` | Události: změna nastavení | bez automatického mazání; FK `Restrict` | owner-only provozní kontakty; obsah e-mailové patičky se nekopíruje | pouze OWNER |
| `AdminUserAuditEvent` | vytvoření a profil účtu, role, aktivaci/deaktivaci a znovuvydání pozvánky | `admin-user-actions.ts`, owner protection a invite helper | OWNER Systém: změny admin účtů | bez automatického mazání; FK `Restrict` | admin jméno/e-mail jen u owner-only profilového auditu; nikdy heslo, hash ani token | pouze OWNER, serverově |
| `BookingSubmissionLog` | veřejný booking submit i security/rate-limit události | public booking action, admin login, aktivace pozvánky, public voucher verification, offline owner recovery | OWNER Systém; posledních 24 h závažných serverových chyb také OWNER Pozornost | bez automatického mazání | ano: hash IP/e-mailu, user-agent, metadata; tato pole UI nenačítá | pouze OWNER |

Skutečné prefixy `BookingSubmissionLog` jsou:

- `ADMIN_LOGIN_*`: `SUCCESS`, `INVALID_PAYLOAD`, `INVALID_CREDENTIALS`, `RATE_LIMITED`;
- `ADMIN_INVITE_ACTIVATION_*`: `SUCCESS`, `INVALID`, `ALREADY_USED`, `EXPIRED`, `USER_INACTIVE`, `RATE_LIMITED`;
- `ADMIN_RECOVERY_OWNER_RESTORED`;
- `PUBLIC_VOUCHER_VERIFY_{PUBLIC_PAGE|PUBLIC_BOOKING}_{SUCCESS|NOT_FOUND_OR_INVALID|RATE_LIMITED|UNKNOWN_ERROR}`;
- bez prefixu: veřejný booking (`SUCCESS` bez failure code, `RATE_LIMITED`, `VALIDATION_ERROR`, doménové `SERVICE_UNAVAILABLE`, `SLOT_*`, `VOUCHER_INVALID`, `BOOKING_CONFLICT`, `TEMPORARY_FAILURE`, `SCHEMA_MISMATCH`, `UNEXPECTED_ERROR`).

## Co je vyřešeno dobře

- Routy vynucují roli serverově; skrytí záložky není jediná ochrana.
- Zdroje se filtrují a omezují před odesláním do klienta a globální řazení má stabilní tie-break přes source-prefixed ID.
- Počty pro stránkování používají stejné `where` jako kandidátní dotazy.
- E-mailový attention scope korektně rozlišuje FAILED, retry a processing lock starší než 10 minut.
- Dostupnost má neměnný before/after audit včetně autora a undo vazby.
- Většina změn rezervace včetně stavů, přesunu, služby, plateb a nyní i individuální ceny má auditní stopu.
- UI nenačítá citlivé fingerprinty ani raw metadata submission logů.
- Nové doménové audity ukládají pouze změněné bezpečné klíče, nevznikají při no-op uložení a zapisují se ve stejné transakci jako změna.
- Role/deaktivace účtu, reissue pozvánky, voucher edit/storno, změna služby a SiteSettings se nemohou commitnout bez příslušného auditu.

## Význam pohledů a severity

`Pozornost` má obsahovat jen stav, který může vyžadovat zásah:

- failed e-mail;
- e-mail čekající na retry;
- processing lock starší než 10 minut;
- pro OWNER serverové selhání veřejného bookingu `TEMPORARY_FAILURE`, `SCHEMA_MISMATCH`, `UNEXPECTED_ERROR` za posledních 24 hodin;
- pro OWNER interní chyba veřejného ověření voucheru `*_UNKNOWN_ERROR` za posledních 24 hodin.

Do `Pozornost` nepatří jednorázové neplatné heslo, neplatná/expirující pozvánka, běžná formulářová validace, neplatný voucher, booking conflict ani rate-limit blokace. Pro detekci skutečného abuse by bylo nutné agregované pravidlo (například mnoho blokací z jednoho hashe v okně), ne zvýraznění každého řádku.

Severity po úpravě:

- `error`: jen výše uvedené serverové submission chyby a definitivně failed e-mail;
- `warning`: no-show, retry a stuck e-mail;
- `success`: potvrzení/dokončení rezervace, uplatnění voucheru, odeslaný e-mail a skutečně úspěšný public booking submit;
- `info`: běžné vytvoření/zrušení/přesun rezervace, vytvoření voucheru, dostupnost a očekávané security/validation/rate-limit události.

Panel byl přejmenován z „Technický stav služeb“ na „E-mailová fronta“, protože shrnuje výhradně e-mail worker.

## Audit trail: pokrytí a mezery

| Oblast | Stav |
| --- | --- |
| Rezervace: vytvoření a stavové přechody | auditováno v `BookingStatusHistory` |
| Rezervace: přesun | auditováno v `BookingRescheduleLog` |
| Rezervace: služba, interní poznámka | auditováno v `BookingStatusHistory` s metadata |
| Rezervace: přímá platba create/update/void a voucher při dokončení | auditováno v `BookingStatusHistory`; vlastní finanční záznamy zůstávají v `BookingPayment`/`VoucherRedemption` |
| Rezervace: individuální cena | během auditu doplněn atomický before/after záznam do `BookingStatusHistory` |
| Dostupnost: současné add/remove/undo | plně auditováno v `AvailabilityAuditEvent` |
| Dostupnost: clear/copy/template/sync | enum a prezentace existují, ale v aktuálním planneru pro ně nebyl nalezen aktivní zapisovač; pokud se funkce vrátí, musí zapisovat stejný audit |
| Voucher: vytvoření | dohledatelné z neměnného `createdAt` a `createdByUserId`, ale celý řádek je dále měnitelný |
| Voucher: uplatnění | samostatný `VoucherRedemption` |
| Voucher: úprava a storno | auditováno v `VoucherChangeLog`; expirace a stav jsou přesné, PII/poznámky jen jako příznak změny |
| Admin login, invite activation, recovery | auditováno v `BookingSubmissionLog` |
| Admin uživatelé/role/aktivace účtu a resend invite | auditováno v `AdminUserAuditEvent`; samostatná revoke akce v UI neexistuje, deaktivace atomicky revokuje aktivní pozvánky |
| Session revoke/reset/logout | sessions jsou stateless cookie tokeny; centrální revoke operace ani její audit nejsou implementovány |
| Cena služby | auditováno v `ServicePriceChangeLog` |
| Viditelnost/rezervovatelnost a ostatní změny služby | auditováno v `ServiceChangeLog`; čistá změna ceny zůstává pouze v `ServicePriceChangeLog` |
| Site settings a booking pravidla | auditováno v `SiteSettingsChangeLog`; filesystem snapshot nadále slouží jen jako fallback |

## Search a indexy

Search se aplikuje před `take`, je omezen na 120 znaků a pole odpovídají konkrétnímu zdroji. Nápověda je nyní specifická pro view. Rozdíly jsou záměrné: e-mailový hash nelze hledat zadáním e-mailu a security fingerprinty nejsou UI search pole; voucher umí hledat purchaser e-mail, ale tento e-mail nezobrazuje v log listu.

Všechny textové podmínky používají case-insensitive `contains`, tedy typicky `%dotaz%`. B-tree indexy jim nepomohou a relační OR může být při velkém objemu drahý. Při současném objemu není důvod zavádět fulltext ani trigram indexy. Pokud p95 hledání překročí přibližně 300 ms, první krok má být vyžadovat užší datum/zdroj; až potom posoudit `pg_trgm` jen pro nejpoužívanější pole.

Pro starší hlavní chronologické dotazy chybí samostatné indexy na globální časovou osu. Nové change logy mají přirozený `(createdAt, id)` a entity/time index. Doporučené pořadí pro starší tabulky (až podle růstu/EXPLAIN):

1. `BookingStatusHistory(createdAt, id)` a `BookingRescheduleLog(createdAt, id)`;
2. `EmailLog(createdAt, id)` a `BookingSubmissionLog(createdAt, id)` pro view bez status filtru;
3. `Voucher(createdAt, id)` a `VoucherRedemption(redeemedAt, id)`.

Stávající `EmailLog(status, createdAt)`, `BookingSubmissionLog(outcome, createdAt)` a `AvailabilityAuditEvent(createdAt)` již odpovídají status/attention dotazům. Index pouze na `failureCode` nemá pro současné prefix/contains hledání dostatečný přínos.

## Výkon a stránkování

Naměřený vývojový objem v době auditu (PostgreSQL statistiky): 594 `EmailLog`, 576 `BookingStatusHistory`, 348 `BookingSubmissionLog`, 24 přesunů, 10 availability auditů, 7 voucherů a 0 redemption řádků. Jde přibližně o 1,6 tisíce řádků ve všech zdrojích dohromady.

Počet DB dotazů po implementaci pro OWNER:

- E-maily: 7 (find + count + 5 health countů);
- Systém se submission a admin auditem: 9;
- Pozornost: 10 (e-mail a critical submission find/count + 6 health countů);
- Události se všemi zdroji: 21 (8 find + 8 count + 5 health countů); vyšší počet odpovídá čtyřem novým doménovým zdrojům.

SALON nespouští submission ani admin/settings audit. Mimo `Pozornost` už nespouští žádný z pěti e-mail health countů, protože technický panel nevidí. V `Pozornost` počítá jen tři skutečně zobrazené hodnoty failed/retry/stuck; dva queue county jsou přeskočené.

Dotaz nyní nejprve zjistí přesné totals, vypočítá `pageCount`, clampne požadovanou stránku a teprve poté určí `offset + 51` kandidátů na aktivní zdroj:

| Stránka | Kandidátů na zdroj | Teoretické maximum ve OWNER Událostech (8 zdrojů) |
| --- | ---: | ---: |
| 1 | 51 | 408 |
| 10 | 501 | 4 008 |
| 100 při 1 600 řádcích | clamp na poslední stránku (max. 1 601) | max. 12 808, reálně méně podle totals zdrojů |

Strategie zachovává správné globální chronologické pořadí a ručně zadané `page=100000` už kandidátní `take` nenafoukne. Offset náklady na skutečně existujících hlubokých stránkách nadále rostou lineárně. Pokud budou běžně používány desítky tisíc řádků, lze posoudit keyset/cursor pagination nad sjednoceným `(occurredAt, source, id)`; DB `UNION ALL` má smysl až při prokázaném problému. Centrální `AuditLog` ani materializace dnes nejsou odůvodněné.

## Retence

Dnes neexistuje automatická produkční retence pro žádný z uvedených zdrojů. Doporučení před implementací odsouhlasit s provozními a účetními povinnostmi:

- booking status/reschedule/payment audit a voucher redemption: držet po dobu životnosti business záznamu, orientačně 5 let; nemačkat FK cascade bez samostatného rozhodnutí o mazání bookingů;
- availability audit: 2 roky online, případně starší komprimovaný export;
- e-mail delivery stav: 12–18 měsíců; objemná `payload`/`trackingRawPayload` data anonymizovat nebo odstranit dříve, například po 90 dnech;
- běžný public booking success, validation a security/rate-limit submission: 90 dní;
- booking server failures: 12 měsíců pro incidentní analýzu;
- admin recovery a jiné významné změny přístupu: alespoň 5 let, oddělit od krátké security retence prefixovým pravidlem.
- nové doménové change logy zatím bez automatické retence; samostatně rozhodnout délku pro typy `AdminUserAuditEvent`, `VoucherChangeLog`, `ServiceChangeLog` a `SiteSettingsChangeLog`.

Retenční job má mazat po malých dávkách, mít dry-run/count režim a nikdy nesmí plošně odstranit doménový audit jen podle stáří jedné sdílené tabulky.

## Priority

### P0

Po provedených opravách nebyl nalezen otevřený P0 problém. Security/system data jsou serverově owner-only a fingerprinty nejsou součástí UI read modelu.

### P1

Všechny P1 body z auditu jsou dokončené:

- immutable audit admin účtů, voucherů, provozních změn služeb a SiteSettings;
- atomické before/after zápisy bez no-op historie a bez duplikace cenového auditu;
- serverová OWNER/SALON viditelnost nových zdrojů;
- totals-first page clamp a odstranění nepotřebných SALON health countů.

### P2

- Zavést explicitní prefixovou retenci a monitoring velikosti tabulek.
- Přidat chronologické indexy jen po ověření přes `EXPLAIN (ANALYZE, BUFFERS)` na reálném objemu.
- Při růstu nad desítky tisíc řádků zvážit cursor pagination nebo read-only `UNION ALL`; nevytvářet centrální auditní model bez nové potřeby.
- Pokud se mají blokace zobrazovat jako abuse, přidat agregované threshold pravidlo podle hashe a časového okna, nikoli jednotlivé warningy.
