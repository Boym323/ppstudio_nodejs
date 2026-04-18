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
- Neplatné nebo chybějící env proměnné při startu aplikace.
- Chyby Prisma klienta po změně schematu nebo po nasazení bez `db:generate`.
- Selhání admin přihlášení kvůli špatnému `ADMIN_SESSION_SECRET` nebo bootstrap účtům.
- Chybný role redirect nebo neočekávaný přístup `SALON` do owner-only sekcí.
- Veřejné kontaktní údaje nebo ceny ponechané v placeholder režimu po nasazení.
- Nefunkční CTA odkazy mezi veřejným webem a rezervační částí.
- Opakované `EmailLog.status = FAILED` po nasazení nové SMTP konfigurace.
- Nefunkční storno odkazy kvůli špatnému `NEXT_PUBLIC_APP_URL` nebo proxy přepisu hosta.
