# Slučování duplicitních klientských profilů

> Ověřeno proti `main` commitu `90389a54d30b529d9f35ab2e9559ea05726a1d03` (PR #101, 2. 11. 2026). Zdroj pravdy je implementace v repozitáři; tento text není návod k ruční opravě produkčních dat.

## Provozní postup a oprávnění

- V detailu aktivní klientky s e-mailem v `/admin/klienti/[clientId]` má **OWNER** formulář **Sloučit duplicitní profil**. Otevřený profil je **zdroj** a bude archivován; zadáním jednoznačného e-mailu se vybírá **cílový profil**, který zůstane zachován. Role `SALON` nemá tuto akci dostupnou.
- Náhled porovná jména, kontakty, počty rezervací, poslední dokončenou návštěvu a nadcházející termíny. Vlastník explicitně zvolí výsledné jméno a telefon (`source`/`target`), opíše e-mail archivovaného profilu a potvrdí souhlas s přesunem historie. Výchozí volbou jména je cílový profil.
- Při změně podkladových údajů nebo právě zpracovávaném klientském e-mailu operace selže bezpečně a vyžaduje nový náhled či dokončení e-mailové fronty. **Automatické vrácení sloučení v administraci neexistuje.**

## Transakce, audit a e-mailové dopady

1. [`client-merge-actions.ts`](../src/features/admin/actions/client-merge-actions.ts) vyžaduje `requireAdminArea("owner")`, validuje vstupy pomocí Zod a vystaví náhled jako **15minutový HS256 JWT** vázaný na owner session. Token nese ID obou profilů, očekávané e-maily a fingerprint.
2. [`client-merge-preview.ts`](../src/features/admin/lib/client-merge-preview.ts) odvozuje fingerprint ze stavu obou profilů, rezervací, `EmailLog` a `BookingSubmissionLog`; před zápisem je porovnán s novým náhledem.
3. [`client-merge.ts`](../src/features/admin/lib/client-merge.ts) používá **Serializable** PostgreSQL transakci a řádkové zámky na obou profilech, rezervacích a navázaných logech. Odmítá neaktivní či již sloučené profily, neobvyklé vazby, rozpracované klientské e-maily a aktivní e-mailové delivery lease.
4. Vazby `Booking`, `EmailLog` a `BookingSubmissionLog` se přesunou k cíli. U aktivních **budoucích** `PENDING`/`CONFIRMED` rezervací obou profilů se sjednotí `clientNameSnapshot` a `clientPhoneSnapshot` podle výsledné volby; historie se zaznamená v `BookingStatusHistory`.
5. Pokud se e-mailový snapshot rezervace převáděného profilu liší od cíle, [`client-contact-token-rotation.ts`](../src/features/admin/lib/client-contact-token-rotation.ts) rotuje klientské akční tokeny a připraví odpovídající náhradní potvrzení. Neúspěšná příprava způsobí rollback transakce. Neodeslané klientské e-maily dostávají aktuální `clientName` v payloadu.
6. [`booking-preflight.ts`](../src/lib/email/booking-preflight.ts) a [`delivery.ts`](../src/lib/email/delivery.ts) při autorizovaném doručení odmítají zastaralé jméno; kompatibilita starých payloadů bez jména zůstává. [`resend-webhooks.ts`](../src/lib/email/resend-webhooks.ts) zabrání duplicitnímu upozornění na opožděný failure webhook po již uzavřeném merge incidentu.
7. Zdrojový profil je **archivován, nikoli smazán**: `isActive=false`, `email=null`, `phone=null`; `internalNote` obsahuje auditní JSON s `CLIENT_MERGE_AUDIT_MARKER` a identitu cíle. Archivovaný profil není použitelný pro novou rezervaci. Viz [`client-merge-marker.ts`](../src/features/clients/lib/client-merge-marker.ts).

## Jednoúčelový CLI nástroj — pouze mimo produkci

[`scripts/merge-duplicate-client.ts`](../scripts/merge-duplicate-client.ts) řeší úzce definovaný scénář jedné budoucí `PENDING`/`CONFIRMED` rezervace zdrojového profilu a má přísnější předpoklady než admin workflow. **Výchozí režim je read-only náhled** na testovací DB:

```bash
npm run db:merge-duplicate-client -- \
  --source-client-id "<SOURCE_ID>" \
  --target-client-id "<TARGET_ID>" \
  --booking-id "<BOOKING_ID>" \
  --source-email "<SOURCE_EMAIL>" \
  --target-email "<TARGET_EMAIL>"
```

Před zápisem vyžaduje současně `--apply`, `--confirm-apply`, `--confirm-database-host` přesně podle hosta `DATABASE_URL`, aktuální `--confirm-preview` s otiskem a explicitní `--name-choice source|target` i `--phone-choice source|target`. **Zápis je zakázaný při `NODE_ENV=production` nebo když `EMAIL_DELIVERY_MODE` není `log`**. Nástroj nikdy nepoužívej k obcházení produkční admin autorizace.

## Regresní testy a odpovědnost

- Hlavní kontrola: [`client-merge.integration.test.ts`](../src/features/admin/lib/client-merge.integration.test.ts); další testy prověřují e-mailový preflight, outbox, pozdní webhooky a booking reschedule.
- `scripts/run-db-integration-tests.mjs` a skripty `test:db:booking` / `test:db:admin-logs` používají `--experimental-test-module-mocks`. Nedostupné `t.mock.module` se vyhodnotí jako chyba, ne jako tichý skip.
- Při změně této funkce aktualizuj tuto dokumentaci, `MANUAL.md`, `docs/DEVELOPMENT.md` a `CHANGELOG.md` společně s kódem.
