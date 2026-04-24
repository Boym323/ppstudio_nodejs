# Incident Log

Evidence produkčních incidentů a jejich řešení.

## Šablona záznamu
- Datum a čas
- Dopad (uživatelé/systém)
- Příčina
- Okamžité řešení
- Trvalá oprava
- Preventivní opatření

## Incidenty
- Datum a čas: 2026-04-20 14:46 CEST
  Dopad (uživatelé/systém): veřejné odeslání formuláře `/rezervace` mohlo skončit obecnou chybou `UNEXPECTED_ERROR` místo potvrzení rezervace, pokud klientka nevyplnila telefon.
  Příčina: drift mezi Prisma modelem a DB schématem; `Booking.clientPhoneSnapshot` byl v DB `NOT NULL`, ale aplikační logika ho používá jako volitelné pole.
  Okamžité řešení: rollback neúspěšné migrace a bezpečné nasazení opravné migrace `20260420125500_booking_client_phone_nullable_fix`.
  Trvalá oprava: sloupec `clientPhoneSnapshot` je nullable; navíc byla přidána migrace `20260420130500_rename_booking_primary_key_constraint`, aby byl stav DB plně konzistentní se schématem.
  Preventivní opatření: před nasazením pouštět `npm run db:check-migrations` a po změnách schématu ověřit diff `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`.

## Doporučené sledované oblasti
- Cross-origin blokace Next.js dev assetů (`/_next/webpack-hmr`, overlay, refresh endpointy) při otevření lokálního dev serveru z jiného zařízení nebo hostname, který není v `allowedDevOrigins`.
- Neplatné nebo chybějící env proměnné při startu aplikace.
- Chyby Prisma klienta po změně schematu nebo po nasazení bez `db:generate`.
- Selhání admin přihlášení kvůli špatnému `ADMIN_SESSION_SECRET` nebo bootstrap účtům.
- Brute-force pokusy na `/api/auth/login` bez aktivace rate limit ochrany (`error=rate_limited` se po sérii špatných pokusů neobjeví).
- Chybný role redirect nebo neočekávaný přístup `SALON` do owner-only sekcí.
- Rozjezd owner-only sekce `Uživatelé / role`, kdy by se `SALON` dostal na `/admin/uzivatele` nebo by se v UI objevila jiná role než `OWNER` / `SALON`.
- Chybně označené systémové přístupy nebo rozbitý stav `Pozvánka čeká` po nasazení migrace `AdminUser.invitedAt`.
- Nefunkční aktivace pozvánky na `/admin/pozvanka/[token]` (expirace, použitý token, nebo chybějící migrace `AdminUserInviteToken`).
- Veřejné kontaktní údaje nebo ceny ponechané v placeholder režimu po nasazení.
- Právní stránka `/obchodni-podminky` ponechaná v draft nebo placeholder režimu; po release musí působit jako finální provozní dokument, ne jako interní návrh.
- Nefunkční CTA odkazy mezi veřejným webem a rezervační částí.
- Opakované `EmailLog.status = FAILED` po nasazení nové SMTP konfigurace.
- Nefunkční storno odkazy kvůli špatnému `NEXT_PUBLIC_APP_URL` nebo proxy přepisu hosta.
- Nefunkční self-service odkaz `Změnit termín` kvůli špatnému `NEXT_PUBLIC_APP_URL`, rozbité route `/rezervace/sprava/[token]` nebo chybně generovanému `BookingActionTokenType.RESCHEDULE`.
- Nefunkční approve/reject odkazy v provozním e-mailu kvůli špatnému `NEXT_PUBLIC_APP_URL`, neaplikované migraci enumu `BookingActionTokenType` nebo rozbitému veřejnému routingu `/rezervace/akce/[intent]/[token]`.
- Chybějící nebo poškozená `.ics` příloha v potvrzovacím klientském e-mailu kvůli chybě v renderu šablony `booking-approved-v1`, SMTP transportu nebo generování iCalendar obsahu.
- Nefunkční owner kalendářový feed kvůli špatnému `NEXT_PUBLIC_APP_URL`, neaplikované migraci `CalendarFeed`, chybné rotaci tokenu nebo rozbité route `/api/calendar/owner.ics`.
- Apple Calendar subscription vracející prázdný nebo nevalidní obsah kvůli chybě v ICS escapování, line folding nebo timezone mapování `Europe/Prague`.
- Zákaznická `.ics` událost posunutá o hodinu kvůli chybě v `DTSTART/DTEND` nebo chybějícímu `VTIMEZONE` bloku `Europe/Prague`.
- Zákaznický `.ics` endpoint vracející event i pro `PENDING` nebo `CANCELLED` rezervaci; správně má být aktivní jen pro `CONFIRMED`.
- Rezervace mimo stav `CONFIRMED` omylem zobrazené v owner kalendáři; feed má být jen read-only provozní přehled potvrzených termínů.
- Opakované použití stejného email akčního odkazu, které musí bezpečně skončit stavem `už zpracováno`, ne druhou změnou rezervace.
- Rezervace potvrzená nebo zrušená jinou cestou ještě před otevřením email akce; confirmation screen musí vrátit korektní stav `už potvrzeno` / `už zrušeno`, ne 500.
- Ruční rezervace vytvořená mimo veřejnou dostupnost bez viditelného warningu nebo bez nastavení `manualOverride`; provoz pak ztratí auditní stopu, proč termín neodpovídal veřejným slotům.
- Nasazení kódu ruční rezervace bez aplikované migrace `20260422230500_manual_booking_admin_v1`, což by způsobilo chyby nad chybějícími sloupci `Booking.isManual` / `Booking.manualOverride` nebo nad neaktuálním enum `BookingSource`.
- Staré hodnoty enumu `BookingSource` (`PUBLIC_WEB`, `OWNER_ADMIN`, `SALON_ADMIN`) ponechané v DB po nepovedené migraci; list/detail rezervací pak budou padat na neplatném mapování zdroje.
- Worker běžící bez SMTP přístupu nebo bez `EMAIL_DELIVERY_MODE=background` a zůstávající fronta `PENDING` logů.
- Zastavený `email:worker`, kvůli kterému se nově nejen nedoručují pending e-maily, ale ani nevznikají 24h reminder joby pro zítřejší potvrzené rezervace.
- Reminder omylem odeslaný po storno nebo přesunu rezervace; worker má před sendem vždy znovu ověřit `Booking.status`, `scheduledStartsAt` a `reminder24hSentAt`.
- Přesun termínu uložený bez auditního logu nebo bez navýšení `Booking.rescheduleCount`; reschedule flow musí vždy zapisovat `BookingRescheduleLog` i metadata posledního přesunu.
- Self-service přesun termínu zapsaný bez `changedByClient = true`; veřejný manage flow musí být v historii odlišitelný od admin přesunu.
- Přesun termínu provedený, ale starý interní override slot zůstal viset jako `DRAFT` a dál blokuje původní čas; doménová služba musí orphanovaný override slot uvolnit.
- Přesun termínu provedený, ale klientský e-mail `BOOKING_RESCHEDULED` se nezaložil; změna rezervace má i v takovém případě zůstat uložená a chyba musí být jen zalogovaná pro provozní dohled.
- Omylem spuštěné `prisma migrate dev` na produkčním serveru místo `prisma migrate deploy`.
- Pokus o vytvoření nebo editaci překrývajícího se slotu, který by měl skončit user-friendly validační chybou místo neošetřeného 500.
- Slot omylem snížený pod počet aktivních rezervací nebo archivovaný navzdory aktivní rezervaci.
- Chybějící provozní feedback po slot akci (stav/smazání), kdy obsluha neví, proč se nic nestalo.
- Rozjeté chování owner vs salon route po změně shared factory wrapperů (např. rozdílný guard nebo chybějící `notFound` validace sekce).
- Nasazený kód admin sekce `Služby` bez aplikované migrace `20260419103000_service_public_bookability`, což by vedlo na Prisma chyby nad chybějícím sloupcem.
- Mylný předpoklad, že admin změna služby automaticky aktualizuje i veřejné stránky `/sluzby` a `/cenik`; ten je už vyřešený, veřejný katalog teď čte z DB v request-time.
- Omylem smazaná kategorie se službami; tohle má být nyní systémově blokované a provoz má místo toho použít deaktivaci.
- Neočekávané rozjetí pořadí kategorií mezi adminem a veřejným katalogem po ruční DB úpravě `sortOrder`.
- Rozbitá quick action v admin sekci `Služby` nebo `Kategorie služeb`, která by po kliknutí nevrátila obsluhu do stejného filtrovaného kontextu; po změnách vždy ověř query-driven návrat na seznam.
- Mobilní admin detail služeb nebo kategorií otevřený pod seznamem místo odděleného flow; po UI zásahu vždy ověř, že se na mobilu používá samostatný detailový režim.
- Overview dashboard zobrazující zastaralý počet dnešních rezervací nebo slotů po změně dat; overview musí zůstávat čistě server-rendered read model bez ručního cache layeru.
- Sender e-mail upravený v admin sekci `Nastavení` na adresu, kterou SMTP provider ve skutečnosti nepovoluje; výsledek budou opakované `EmailLog.status = FAILED`.
- Přehnaně přísný minimální předstih nebo příliš krátký horizont rezervace ve `SiteSettings`, kvůli kterému veřejný booking náhle schová skoro všechny sloty.
- Rozbitý reset vybraného času při změně dne v kroku 2 `/rezervace`, kvůli kterému by souhrn nebo hidden inputs držely stale `startsAt` mimo aktuálně zobrazený den.
- Storno limit nastavený příliš vysoko nebo omylem na `0`, což změní chování self-service storno odkazů.
- Chybějící nebo nečitelný `MEDIA_STORAGE_ROOT`, kvůli kterému upload selže při zápisu nebo se veřejný asset fyzicky nikdy neuloží.
- Upload root namountovaný do dočasného adresáře, který se smaže při deployi nebo restartu serveru.
- Nefunkční veřejné URL `/media/*` kvůli ručnímu zásahu do souborů na filesystemu bez odpovídajícího `MediaAsset` záznamu v DB.
- Pokus o nahrání nepodporovaného typu souboru nebo souboru nad velikostní limit, který musí skončit validační chybou místo 500.
- Certifikát nahraný v adminu, ale neviditelný na `/o-mne` kvůli chybějícímu `PUBLIC` záznamu nebo neplatné `storagePath`.
- Hlavní portrét na `/o-mne` nahrazený neexistujícím nebo nevhodně ořezaným assetem v `public/brand`, kvůli čemuž by hero ztratil důvěryhodnost nebo vizuální kvalitu na mobilu.
- Stránka `/o-mne` publikovaná jen s placeholder certifikáty nebo pracovní fotografií i po finálním dodání brand assetů; před release je potřeba ověřit, že placeholder stavy nejsou omylem ponechané jako produkční finální řešení.

## Preventivní poznámka
- Sekce `volne-terminy` je po resetu z `2026-04-19` záměrně minimalistická; incidentem je pouze neočekávaný pád route, ne absence starých planner funkcí.
- Admin sekce `Email logy` je citlivá na rozjezd mezi Prisma schématem a generovaným klientem. Projekt proto nyní před `dev` i `build` automaticky spouští `prisma generate`.
- Rozbitý týdenní planner po deployi: špatné zachování query parametrů `week/day/panel`, kvůli kterému se obsluha po akci vrací na jiný den nebo na výchozí týden.
- Rozbitý týdenní planner po deployi: špatné zachování query parametrů `week/day/panel/slot`, kvůli kterému se obsluha po akci vrací na jiný den, jiný slot nebo na výchozí týden.
- Sticky draft bar nebo badge `Neuloženo`, které zůstávají viset i po návratu ke stejnému týdennímu stavu; indikace se má odvozovat z reálného diffu proti serverovým dnům, ne jen z ručně přepínaného flagu.
- Batch create vytvářející jen část série: tohle nesmí nastat; workflow má běžet transakčně all-or-nothing.
- Mobilní planner s nečitelnými touch targety nebo horizontálním scrollem v kartách dnů.
- Mobilní nebo tabletový inspektor dne, který překryje grid bez možnosti rychlého zavření nebo neukáže vybraný blok po tapnutí.
- Day workspace otevírající špatný slot po změně filtru stavu nebo týdne.
- Owner-only sekce `Nastavení` má dopad i na veřejný web a e-mailovou komunikaci; po každé změně je potřeba rychlá smoke kontrola footeru, `/kontakt`, `/faq`, `/storno-podminky` a `/rezervace`.
- Storno stránka publikovaná se správným limitem hodin, ale se starými kontakty nebo opačným významem summary karet; po změně `SiteSettings` vždy ověř hero box `Jak zrušit rezervaci` i text `více než / méně než X hodin`.
