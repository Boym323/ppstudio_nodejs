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
- Datum a čas: 2026-05-01 10:20 CEST
  Dopad (uživatelé/systém): lokální vývojový server padal během práce v `/admin` a přerušoval hot reload.
  Příčina: poškozená Turbopack dev cache (`.next/dev/cache/turbopack`), chybějící `.sst` soubory při obnově task databáze.
  Okamžité řešení: zastavit dev server, vyčistit `.next` a spustit znovu (`npm run dev:clean`); při opakování použít fallback `npm run dev:webpack`.
  Trvalá oprava: do `package.json` přidány skripty `clean`, `dev:clean` a `dev:webpack`, dokumentace doplněna o postup.
  Preventivní opatření: při prvních známkách Turbopack cache chyb neřešit symptomaticky po souborech, ale rovnou resetovat `.next`; při nestabilitě dočasně přepnout na webpack dev mód.
- Datum a čas: 2026-04-30 19:45 CEST
  Dopad (uživatelé/systém): release doběhl přes migrace, lint i build, ale skončil chybou při restartu `ppstudio-web.service`; nová verze tak zůstala nenasazená do běžících procesů a rollout se musel ručně dohledávat.
  Příčina: server neměl nainstalované systemd units z `deploy/systemd/*` a současně mu zůstal legacy PM2 runtime; `deploy/release.sh` tehdy neověřoval ani přítomnost unitů, ani konflikt dvou process managerů.
  Okamžité řešení: nainstalovat units přes `sudo /var/www/ppstudio/deploy/deploy.sh`, odstranit `ppstudio-web` / `ppstudio-email-worker` z PM2, uložit prázdný PM2 dump a vypnout `pm2-root.service`.
  Trvalá oprava: `deploy/release.sh` nově fail-fast kontroluje `LoadState` pro `ppstudio-web.service` a `ppstudio-email-worker.service` ještě před `npm ci`/buildem a při nalezených PM2 procesech vypíše přesný převod na čistý systemd provoz.
  Preventivní opatření: na novém serveru nebo po obnově `/etc/systemd/system` vždy nejdřív spustit `deploy/deploy.sh`; při migraci z PM2 nejdřív odstraň staré `ppstudio-*` procesy a vypni `pm2-root.service`, jinak hrozí `EADDRINUSE` nebo duplicitní worker.
- Datum a čas: 2026-04-20 14:46 CEST
  Dopad (uživatelé/systém): veřejné odeslání formuláře `/rezervace` mohlo skončit obecnou chybou `UNEXPECTED_ERROR` místo potvrzení rezervace, pokud klientka nevyplnila telefon.
  Příčina: drift mezi Prisma modelem a DB schématem; `Booking.clientPhoneSnapshot` byl v DB `NOT NULL`, ale aplikační logika ho používá jako volitelné pole.
  Okamžité řešení: rollback neúspěšné migrace a bezpečné nasazení opravné migrace `20260420125500_booking_client_phone_nullable_fix`.
  Trvalá oprava: sloupec `clientPhoneSnapshot` je nullable; navíc byla přidána migrace `20260420130500_rename_booking_primary_key_constraint`, aby byl stav DB plně konzistentní se schématem.
  Preventivní opatření: před nasazením pouštět `npm run db:check-migrations` a po změnách schématu ověřit diff `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`.
- Ruční booking bez aplikované migrace `20260426123000_client_email_nullable_for_manual_booking`; admin formulář po releasu dovolí prázdný e-mail, ale DB by pořád odmítla novou klientku bez adresy. Po deploy booking CRM změn vždy ověř i skutečně nasazené Prisma migrace.
- Datum a čas: 2026-04-26 21:40 CEST
  Dopad (uživatelé/systém): `ppstudio-email-worker` běžel v PM2 crash loopu a zbytečně vytěžoval CPU; e-mail fronta a 24h reminder scan se nemohly spolehlivě spustit.
  Příčina: worker přes `src/lib/email/delivery.ts` a `src/features/booking/lib/booking-reminders.ts` importoval Pushover modul s `import "server-only"`, který mimo Next.js bundler v plain Node procesu okamžitě vyhodí chybu.
  Okamžité řešení: Pushover implementace byla oddělena do `src/lib/notifications/pushover-core.ts` a worker importy byly přepojené na worker-safe modul.
  Trvalá oprava: `src/lib/notifications/pushover.ts` zůstává jen jako Next.js `server-only` wrapper; standalone skripty nesmí importovat wrapper, ale přímo `pushover-core`.
  Preventivní opatření: po změnách Pushover, e-mail delivery nebo reminder scheduleru ověřit alespoň import/start worker vrstvy mimo Next.js runtime.

## Doporučené sledované oblasti
- Cross-origin blokace Next.js dev assetů (`/_next/webpack-hmr`, overlay, refresh endpointy) při otevření lokálního dev serveru z jiného zařízení nebo hostname, který není v `allowedDevOrigins`.
- Neplatné nebo chybějící env proměnné při startu aplikace.
- Chyby Prisma klienta po změně schematu nebo po nasazení bez `db:generate`.
- Selhání admin přihlášení kvůli špatnému `ADMIN_SESSION_SECRET` nebo bootstrap účtům.
- Admin login/logout redirect nebo proxy přesměrování mířící na cizí doménu po podvrženém `Host` / `x-forwarded-host`; okamžitě ověř `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_DOMAIN`, `VOUCHER_PUBLIC_DOMAIN`, reverse proxy hlavičky a helper `src/lib/http/request-origin.ts`.
- Brute-force pokusy na `/api/auth/login` bez aktivace rate limit ochrany (`error=rate_limited` se po sérii špatných pokusů neobjeví).
- Chybný role redirect nebo neočekávaný přístup `SALON` do owner-only sekcí.
- Nefunkční prefill klientky v admin ruční rezervaci (`/admin/.../rezervace?create=1&clientId=...`), zejména po změně detailu klientky, booking draweru nebo shared owner/salon route factory.
- Rozjezd owner-only sekce `Uživatelé / role`, kdy by se `SALON` dostal na `/admin/uzivatele` nebo by se v UI objevila jiná role než `OWNER` / `SALON`.
- Chybně označené systémové přístupy nebo rozbitý stav `Pozvánka čeká` po nasazení migrace `AdminUser.invitedAt`.
- Nefunkční aktivace pozvánky na `/admin/pozvanka/[token]` (expirace, použitý token, nebo chybějící migrace `AdminUserInviteToken`).
- Veřejné kontaktní údaje nebo ceny ponechané v placeholder režimu po nasazení.
- Právní stránka `/obchodni-podminky` ponechaná v draft nebo placeholder režimu; po release musí působit jako finální provozní dokument, ne jako interní návrh.
- Nefunkční CTA odkazy mezi veřejným webem a rezervační částí.
- Chybně zapnutý nebo rozbitý Matomo tracking, který by posílal admin nebo tokenové URL, duplicitní první pageview, PII v event name, nebo by chybou `_paq` ovlivnil booking flow; helper musí zůstat bezpečný no-op.
- Rozbitý server-side Matomo dashboard reporting kvůli chybějícímu `MATOMO_AUTH_TOKEN`, špatnému `MATOMO_SITE_ID`, nedostupnému Reporting API nebo omylem veřejně vystavenému tokenu; UI má zůstat na nulových fallback hodnotách a token nesmí mít prefix `NEXT_PUBLIC_`.
- Regrese admin dashboardu zpět do analyticky přeplněného pohledu: hlavní obrazovka má zůstat denní provozní cockpit a detailní zdroje návštěv nebo funnel mají být schované až v rozbalení `Zobrazit analytiku`.
- Endpoint `/api/admin/analytics` omylem dostupný bez admin session nebo vracející detailní payload z Matomo; endpoint smí vracet jen agregovaná dashboard čísla bez PII a bez `token_auth`.
- Rozbita nebo pomala Pushover konfigurace (`PUSHOVER_ENABLED=true` bez `PUSHOVER_APP_TOKEN`, spatny owner User Key nebo nedostupne Pushover API) nesmi rozbit rezervaci, potvrzeni, storno, presun, email worker ani reminder scan; spravne chovani je log + preskoceni nebo chybovy stav jen v testovacim tlacitku a HTTP pokus ma byt ukonceny nejpozdeji po 3 s timeoutu.
- `SALON` omylem vidi Pushover nastaveni nebo prijima Pushover notifikaci; UI i serverovy dotaz musi zustat omezeny na `AdminRole.OWNER`.
- Pushover zprava obsahuje telefon, raw token, citlivou poznamku klientky nebo cely payload; notifikace maji posilat jen sluzbu, termin, zdroj, typ chyby a odkaz do adminu.
- Pushover spam pri retry nebo opakovanem submitu; stejne `type + bookingId/contextId/emailLogId` ma byt v jednom procesu potlaceno 30s in-memory rate limitem.
- Opakované `EmailLog.status = FAILED` po nasazení nové SMTP konfigurace.
- Nefunkční storno odkazy kvůli špatnému `NEXT_PUBLIC_APP_URL` nebo proxy přepisu hosta.
- Nefunkční self-service odkaz `Změnit termín` kvůli špatnému `NEXT_PUBLIC_APP_URL`, rozbité route `/rezervace/sprava/[token]` nebo chybně generovanému `BookingActionTokenType.RESCHEDULE`.
- Regrese UX self-service změny termínu, kdy se storno znovu objeví jako dominantní akce, kalendář předběhne nejbližší termíny, výběr slotu neaktualizuje potvrzení nebo na mobilu vznikne horizontální scroll.
- Matomo na tokenové self-service stránce omylem odešle pageview s raw tokenem nebo duplicitní date/time event při renderu; eventy smějí vznikat jen z interakcí a bez PII.
- Nefunkční approve/reject odkazy v provozním e-mailu kvůli špatnému `NEXT_PUBLIC_APP_URL`, neaplikované migraci enumu `BookingActionTokenType` nebo rozbitému veřejnému routingu `/rezervace/akce/[intent]/[token]`.
- Provozní e-mail o nové rezervaci nečitelný na mobilu nebo v Outlooku kvůli regresi v HTML šabloně; po zásahu do `admin-booking-notification-v1` vždy ověř stackovaná tlačítka, normální letter-spacing a danger-light vizuál storna.
- Regrese booking e-mailového design systému, kdy se vrátí duplicitní kontaktní věty, dominantní storno CTA, starý formát času bez mezer nebo chybějící adresa `PP Studio, Sadová 2, 760 01 Zlín`; po zásahu do `src/lib/email/templates.ts` ověř text/plain i HTML varianty všech booking šablon.
- Chybějící nebo poškozená `.ics` příloha v potvrzovacím klientském e-mailu kvůli chybě v renderu šablony `booking-approved-v1`, SMTP transportu nebo generování iCalendar obsahu.
- Nefunkční owner kalendářový feed kvůli špatnému `NEXT_PUBLIC_APP_URL`, neaplikované migraci `CalendarFeed`, chybné rotaci tokenu nebo rozbité route `/api/calendar/owner.ics`.
- Apple Calendar subscription vracející prázdný nebo nevalidní obsah kvůli chybě v ICS escapování, line folding nebo timezone mapování `Europe/Prague`.
- Zákaznická `.ics` událost posunutá o hodinu kvůli chybě v `DTSTART/DTEND` nebo chybějícímu `VTIMEZONE` bloku `Europe/Prague`.
- Zákaznický `.ics` endpoint vracející event i pro `PENDING` nebo `CANCELLED` rezervaci; správně má být aktivní jen pro `CONFIRMED`.
- Dvojí nebo chybné uplatnění voucheru: při incidentu porovnej `Voucher.remainingValueCzk`, `Voucher.status`, navázané `VoucherRedemption` záznamy a admin aktéra; public validace voucheru sama nikdy nemá vytvářet redemption ani odečítat zůstatek.
- Badge nebo status v admin seznamu voucherů nesedí k řádku, chybně se láme nebo vizuálně mizí: zkontroluj `AdminStatePill`, mapování `effectiveStatus -> tone` v `admin-vouchers-page.tsx` a šířku desktopového sloupce `Stav`; nesmí se tím měnit voucher business logika ani filtrace.
- Veřejné ověření `/vouchery/overeni` ukáže citlivá voucherová data nebo změní zůstatek: okamžitě ověř `verifyVoucherPublic(...)`, page output, `VoucherRedemption` záznamy a změny `remainingValueCzk` / `Voucher.status`; route musí zůstat read-only a zobrazovat jen bezpečná pole.
- Nečekané uplatnění voucheru z detailu rezervace: ověř server action `redeemBookingVoucherAction`, roli přihlášeného admina, zadaný `voucherCode`, volitelnou `amountCzk`, navázaný `bookingId` a revalidované owner/salon route; žádná client-side logika nesmí sama měnit zůstatek.
- Chybný stav v panelu `Úhrada` u rezervace: porovnej `Booking.servicePriceFromCzk`, aktuální `Service.priceFromCzk`, součet `VoucherRedemption.amountCzk` a součet `BookingPayment.amountCzk` pro daný `bookingId`; stav úhrady se neukládá do DB a musí odpovídat helperu `getBookingPaymentSummary(...)`.
- Chybný `CRM souhrn` v detailu klientky: ověř, že read model načítá všechny rezervace klientky včetně `servicePriceFromCzk`, `scheduledStartsAt`, `scheduledEndsAt`, `VoucherRedemption.amountCzk` a `BookingPayment.amountCzk`; platební část musí dál odpovídat helperu `getBookingPaymentSummary(...)`. `Uhrazeno` má ukazovat skutečně zapsané úhrady, ale `Neuhrazeno` nesmí započítat budoucí aktivní rezervace ani `CANCELLED` / `NO_SHOW`.
- Duplicitní nebo chybně smazaná platba mimo voucher: zkontroluj `BookingPayment.bookingId`, `amountCzk`, `method`, `paidAt`, `createdByUserId` a auditní kontext v admin session. Mazání má být dostupné pouze pro `OWNER`; `SALON` smí platbu jen zapsat.
- Voucher vystavený na špatnou službu nebo hodnotu: zkontroluj admin route `/admin/vouchery/novy` nebo `/admin/provoz/vouchery/novy`, payload server action, aktivitu vybrané služby a snapshot pole `serviceNameSnapshot`, `servicePriceSnapshotCzk`, `serviceDurationSnapshot`; první verze nemá editaci ani storno, oprava vyžaduje vědomý provozní zásah.
- Voucher omylem zůstává uplatnitelný po ručním zrušení: ověř `Voucher.status = CANCELLED`, `cancelledAt`, `cancelledByUserId`, `cancelReason`, veřejné `verifyVoucherPublic(...)` a admin `redeemVoucherForBooking(...)`; interní důvod se nesmí propisovat na `/vouchery/overeni`.
- Zrušení voucheru selže u aktivního voucheru bez čerpání: zkontroluj počet `VoucherRedemption` pro `voucherId`, stav voucheru a existenci aktuálního admin uživatele v `AdminUser`; bootstrap session smí uložit audit jako `null`, ale akce nemá padat.
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
- Změna ceny služby uložená bez auditní stopy; admin editace musí při skutečné změně `priceFromCzk` vždy zapisovat `ServicePriceChangeLog` s původní a novou hodnotou.
- Voucher chybně odečtený už při veřejné rezervaci; správné chování je jen intent na `Booking`, skutečné čerpání vzniká výhradně ručním admin zápisem `VoucherRedemption`.
- Hodnotový voucher čerpaný souběžně bez transakční aktualizace `remainingValueCzk`; budoucí admin akce musí u `VALUE` voucherů zamykat/ověřit aktuální zůstatek a až potom vytvořit `VoucherRedemption`.
- Rezervační přehled vracející špatné nebo neaktivní filtry po kliknutí na statistický box; klik na aktivní box musí vždy umět vrátit seznam do výchozího stavu bez ruční editace URL.
- Pracovní seznam rezervací bez vizuálního oddělení dnešních a budoucích termínů; po každém zásahu do read modelu nebo toolbaru ověř bloky `Dnes`, `Zítra`, `Později` a `Dříve`.
- Detail rezervace po UX refaktoru schová hlavní akce pod fold nebo mimo sticky header; po každém zásahu ověř, že `termín + stav + rychlé akce` zůstávají viditelné bez dalšího scrollu.
- Detail rezervace znovu smíchá reschedule flow do běžného status chooseru; `Přesunout termín` má zůstat samostatné CTA s vlastním drawerem, validací a historií.
- Click-to-open řádek rezervace, který při práci s checkboxem, kontaktem nebo row akcemi omylem otevírá detail; interaktivní prvky uvnitř řádku musí propagaci zastavit.
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
- Desktop admin detail služeb nebo kategorií vykreslený mimo pravý overlay drawer (regrese zpět na inline/sticky panel), kvůli čemuž obsluha ztratí sjednocené list/detail chování mezi desktopem a mobilem.
- Overview dashboard zobrazující zastaralý počet dnešních rezervací nebo slotů po změně dat; overview musí zůstávat čistě server-rendered read model bez ručního cache layeru.
- Sender e-mail upravený v admin sekci `Nastavení` na adresu, kterou SMTP provider ve skutečnosti nepovoluje; výsledek budou opakované `EmailLog.status = FAILED`.
- Přehnaně přísný minimální předstih nebo příliš krátký horizont rezervace ve `SiteSettings`, kvůli kterému veřejný booking náhle schová skoro všechny sloty.
- Delší služba nabízená až zbytečně pozdě, přestože v kalendáři vizuálně vypadá dost volného času; po zavedení chainingu navazujících slotů je potřeba při podobném hlášení ověřit, že sousední publikované sloty mají opravdu kompatibilní kapacitu, stejná service restrictions a žádnou mezeru mezi segmenty.
- Regrese po booking/reschedule chainingu, kdy admin planner ukáže volný začátek nebo konec coverage řetězce jako `Omezené`; po zásahu do `splitSlotForEditing` nebo coverage logiky vždy ověř, že se rozsekají i krajní segmenty řetězce, ne jen single-slot případ.
- Browser warning `Encountered two children with the same key` v planner inspektoru je signál, že UI seznam používá příliš hrubý key typu `startCell-endCell`; po úpravách seznamů intervalů vždy ověř, že key obsahuje i den nebo jiný stabilní rozlišovač.
- Legacy anchor slot po starším chainingu může zůstat v datech i po nasazení opravy enginu. Pro jednoduché single-booking případy použij `node scripts/repair-legacy-chained-slots.mjs` a teprve po kontrole `repairable` výstupu případně `--apply`; případy se dvěma a více bookingy na jednom slotu řeš ručně.
- `CANCELLED` booking nesmí v planneru maskovat plain published slot jako `Omezené`; při podobném hlášení zkontroluj, jestli slot neblokuje jen zrušená rezervace natažená přes relační `slot.bookings`.
- Rozbitý reset vybraného času při změně dne v kroku 2 `/rezervace`, kvůli kterému by souhrn nebo hidden inputs držely stale `startsAt` mimo aktuálně zobrazený den.
- Regresní rozbití booking flow nebo týdenního planneru po čistě strukturálním refaktoru; po změnách v `booking-flow`, `booking-public` nebo `admin-slots` vždy ověř build, základní booking smoke flow a admin planner akce.
- Storno limit nastavený příliš vysoko nebo omylem na `0`, což změní chování self-service storno odkazů.
- Chybějící nebo nečitelný `MEDIA_STORAGE_ROOT`, kvůli kterému upload selže při zápisu nebo se veřejný asset fyzicky nikdy neuloží.
- Upload root namountovaný do dočasného adresáře, který se smaže při deployi nebo restartu serveru.
- Nefunkční veřejné URL `/media/public/*` nebo legacy `/media/*` kvůli ručnímu zásahu do souborů na filesystemu bez odpovídajícího `MediaAsset` záznamu v DB.
- Chybějící nebo nepodporovaný soubor zvolený jako `Logo pro PDF vouchery` nesmí blokovat stažení voucheru; očekávaný stav je fallback textové logo `PP Studio`. Pokud obsluha čeká obrázek, zkontroluj `SiteSettings.voucherPdfLogoMediaId`, existenci navázaného `MediaAsset` a lokální soubor v `MEDIA_STORAGE_ROOT`.
- Tisková A4 varianta voucheru nesmí změnit e-mailovou PDF přílohu ani původní admin stažení. Při hlášení špatného tisku ověř nejdřív `/pdf/tisk`, A4 rozměr 210 x 297 mm, voucher v horní třetině a bílé pozadí mimo voucher; při hlášení změny e-mailového PDF porovnej, zda e-mail stále volá původní `generateVoucherPdf(...)`.
- Pokus o nahrání nepodporovaného typu souboru nebo souboru nad velikostní limit, který musí skončit validační chybou místo 500.
- Admin `Média webu` po uploadu, editaci nebo publish/unpublish vrací obsluhu na špatný filtr, takže rychlá práce v knihovně působí chaoticky a je potřeba znovu ručně přepínat tabs.
- Hero portrét na homepage nebo `/o-mne` neodpovídá očekávané stránce, protože je médium uložené pod špatným typem (`PORTRAIT_HOME` vs `PORTRAIT_ABOUT`) nebo chybí fallback na legacy `PORTRAIT`.
- Certifikát nahraný v modulu `Média webu`, ale neviditelný na `/o-mne` kvůli jinému `MediaType` než `CERTIFICATE`, vypnutému `isPublished`, neplatné `storagePath` nebo chybějícímu souboru ve storage rootu.
- Fotka studia nahraná v modulu `Média webu`, ale neviditelná na `/studio` kvůli jinému `MediaType` než `SALON_PHOTO`, vypnutému `isPublished`, neplatné `storagePath` nebo chybějícímu souboru ve storage rootu.
- Hlavní portrét na `/o-mne` nahrazený neexistujícím nebo nevhodně ořezaným assetem v `public/brand`, kvůli čemuž by hero ztratil důvěryhodnost nebo vizuální kvalitu na mobilu.
- Stránka `/o-mne` publikovaná jen s placeholder certifikáty nebo pracovní fotografií i po finálním dodání brand assetů; před release je potřeba ověřit, že placeholder stavy nejsou omylem ponechané jako produkční finální řešení.

## Preventivní poznámka
- Přetrvávající text `Rendering...` na admin detailu voucheru po dokončení načtení je UI regrese; voucher detail má používat loading stav jen během skutečného fetch/render přechodu a v klidovém stavu ukazovat už jen finální summary a provozní panely.
- Historie Prisma migrací může obsahovat rollbacknuté záznamy `20260419140000_site_settings_singleton` a `20260419103000_service_public_bookability`. Jsou to známé záznamy ze staršího recover postupu; nemaž je ručně z `_prisma_migrations`. Za problém je považuj až tehdy, když `npm run db:check-migrations` neskončí stavem `Migration history check: OK`, nebo když `prisma migrate deploy` odmítne pokračovat.
- Release helper očekává nainstalované systemd units `ppstudio-web.service` a `ppstudio-email-worker.service`; po provisioning/recovery serveru je nejdřív zaveď přes `sudo /var/www/ppstudio/deploy/deploy.sh`, jinak se nový release záměrně zastaví před `npm ci`.
- Produkční provoz `ppstudio` už nemá běžet současně přes PM2 i systemd. Smíšený stav způsobí buď port konflikt na `3000`, nebo dvojitý běh email workeru.
- Sekce `volne-terminy` je po resetu z `2026-04-19` záměrně minimalistická; incidentem je pouze neočekávaný pád route, ne absence starých planner funkcí.
- Admin sekce `Email logy` je citlivá na rozjezd mezi Prisma schématem a generovaným klientem. Projekt proto nyní před `dev` i `build` automaticky spouští `prisma generate`.
- Rozbitý týdenní planner po deployi: špatné zachování query parametrů `week/day/panel`, kvůli kterému se obsluha po akci vrací na jiný den nebo na výchozí týden.
- Rozbitý týdenní planner po deployi: špatné zachování query parametrů `week/day/panel/slot`, kvůli kterému se obsluha po akci vrací na jiný den, jiný slot nebo na výchozí týden.
- Sticky draft bar nebo badge `Neuloženo`, které zůstávají viset i po návratu ke stejnému týdennímu stavu; indikace se má odvozovat z reálného diffu proti serverovým dnům, ne jen z ručně přepínaného flagu.
- Batch create vytvářející jen část série: tohle nesmí nastat; workflow má běžet transakčně all-or-nothing.
- Mobilní planner s nečitelnými touch targety nebo horizontálním scrollem v kartách dnů.
- Regrese planner density passu, kdy se do horní části vrátí duplicita data týdne, vysoký hero nebo rozpad pravého panelu zpět do mnoha malých boxů; po dalších úpravách vždy ověř, že prioritu má grid a detail výběru zůstává soustředěný v jednom kompaktním panelu.
- Mobilní nebo tabletový inspektor dne, který překryje grid bez možnosti rychlého zavření nebo neukáže vybraný blok po tapnutí.
- Day workspace otevírající špatný slot po změně filtru stavu nebo týdne.
- Owner-only sekce `Nastavení` má dopad i na veřejný web a e-mailovou komunikaci; po každé změně je potřeba rychlá smoke kontrola footeru, `/kontakt`, `/faq`, `/storno-podminky` a `/rezervace`.
- Storno stránka publikovaná se správným limitem hodin, ale se starými kontakty nebo opačným významem summary karet; po změně `SiteSettings` vždy ověř hero box `Jak zrušit rezervaci` i text `více než / méně než X hodin`.
