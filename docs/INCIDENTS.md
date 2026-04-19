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
- Zatím bez záznamu.

## Doporučené sledované oblasti
- Cross-origin blokace Next.js dev assetů (`/_next/webpack-hmr`, overlay, refresh endpointy) při otevření lokálního dev serveru z jiného zařízení nebo hostname, který není v `allowedDevOrigins`.
- Neplatné nebo chybějící env proměnné při startu aplikace.
- Chyby Prisma klienta po změně schematu nebo po nasazení bez `db:generate`.
- Selhání admin přihlášení kvůli špatnému `ADMIN_SESSION_SECRET` nebo bootstrap účtům.
- Chybný role redirect nebo neočekávaný přístup `SALON` do owner-only sekcí.
- Veřejné kontaktní údaje nebo ceny ponechané v placeholder režimu po nasazení.
- Nefunkční CTA odkazy mezi veřejným webem a rezervační částí.
- Opakované `EmailLog.status = FAILED` po nasazení nové SMTP konfigurace.
- Nefunkční storno odkazy kvůli špatnému `NEXT_PUBLIC_APP_URL` nebo proxy přepisu hosta.
- Worker běžící bez SMTP přístupu nebo bez `EMAIL_DELIVERY_MODE=background` a zůstávající fronta `PENDING` logů.
- Omylem spuštěné `prisma migrate dev` na produkčním serveru místo `prisma migrate deploy`.
- Pokus o vytvoření nebo editaci překrývajícího se slotu, který by měl skončit user-friendly validační chybou místo neošetřeného 500.
- Slot omylem snížený pod počet aktivních rezervací nebo archivovaný navzdory aktivní rezervaci.
- Chybějící provozní feedback po slot akci (stav/smazání), kdy obsluha neví, proč se nic nestalo.
- Rozjeté chování owner vs salon route po změně shared factory wrapperů (např. rozdílný guard nebo chybějící `notFound` validace sekce).
- Nasazený kód admin sekce `Služby` bez aplikované migrace `20260419103000_service_public_bookability`, což by vedlo na Prisma chyby nad chybějícím sloupcem.
- Mylný předpoklad, že admin změna služby automaticky aktualizuje i veřejné stránky `/sluzby` a `/cenik`; ten je už vyřešený, veřejný katalog teď čte z DB v request-time.
- Omylem smazaná kategorie se službami; tohle má být nyní systémově blokované a provoz má místo toho použít deaktivaci.
- Neočekávané rozjetí pořadí kategorií mezi adminem a veřejným katalogem po ruční DB úpravě `sortOrder`.
- Sender e-mail upravený v admin sekci `Nastavení` na adresu, kterou SMTP provider ve skutečnosti nepovoluje; výsledek budou opakované `EmailLog.status = FAILED`.
- Přehnaně přísný minimální předstih nebo příliš krátký horizont rezervace ve `SiteSettings`, kvůli kterému veřejný booking náhle schová skoro všechny sloty.
- Storno limit nastavený příliš vysoko nebo omylem na `0`, což změní chování self-service storno odkazů.

## Preventivní poznámka
- Sekce `volne-terminy` je po resetu z `2026-04-19` záměrně minimalistická; incidentem je pouze neočekávaný pád route, ne absence starých planner funkcí.
- Admin sekce `Email logy` je citlivá na rozjezd mezi Prisma schématem a generovaným klientem. Projekt proto nyní před `dev` i `build` automaticky spouští `prisma generate`.
- Rozbitý týdenní planner po deployi: špatné zachování query parametrů `week/day/panel`, kvůli kterému se obsluha po akci vrací na jiný den nebo na výchozí týden.
- Rozbitý týdenní planner po deployi: špatné zachování query parametrů `week/day/panel/slot`, kvůli kterému se obsluha po akci vrací na jiný den, jiný slot nebo na výchozí týden.
- Batch create vytvářející jen část série: tohle nesmí nastat; workflow má běžet transakčně all-or-nothing.
- Mobilní planner s nečitelnými touch targety nebo horizontálním scrollem v kartách dnů.
- Day workspace otevírající špatný slot po změně filtru stavu nebo týdne.
- Owner-only sekce `Nastavení` má dopad i na veřejný web a e-mailovou komunikaci; po každé změně je potřeba rychlá smoke kontrola footeru, `/kontakt`, `/faq`, `/storno-podminky` a `/rezervace`.
