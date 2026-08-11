# Migrace HTML e-mailů na React Email

## 1. Současná architektura

Tok je:

`business event → vytvoření EmailLog/payloadu → renderEmailTemplate(templateKey, subject, payload) → { subject, html, text, attachments } → deliverEmailLog / sendEmail → Nodemailer nebo Resend/SMTP provider`

Booking akce, reminder scheduler a voucher akce vytvářejí `EmailLog` s template key a JSON payloadem. `src/lib/email/worker.ts` záznam zamyká a předává jej `src/lib/email/delivery.ts`; stejná delivery funkce se používá i pro okamžité odeslání. `src/lib/email/provider.ts` následně předává HTML, plain text a přílohy Nodemaileru nebo Resendu. Retry, locking a stav EmailLogu jsou mimo renderer.

`renderEmailTemplate` v `src/lib/email/templates.ts` současně zajišťuje validaci payloadu, načtení brandingu, formátování dat, ruční HTML i plain text a u některých šablon tvorbu příloh. Voucherová orchestrace v témže souboru načítá voucher a PDF a volá `buildVoucherEmailTemplate`.

## 2. Template inventory

| Template key | Soubor | Příjemce | Akční URL | Attachment | Doporučená fáze |
|---|---|---|---|---|---|
| `booking-confirmation-v1` | `src/lib/email/templates.ts` | klient | ano, volitelně správa/storno | ne | 1 – pilot |
| `booking-approved-v1` | `src/lib/email/templates.ts` | klient | ano, volitelně správa/storno | ano, volitelně ICS | 2 |
| `booking-reminder-24h-v1` | `src/lib/email/templates.ts` | klient | ano, správa/storno | ne | 2 |
| `booking-rescheduled-v1` | `src/lib/email/templates.ts` | klient | ano, správa/storno | ano, volitelně ICS | 2 |
| `booking-cancelled-v1` | `src/lib/email/templates.ts` | klient | ne | ne | 2 |
| `booking-rejected-v1` | `src/lib/email/templates.ts` | klient | ne | ne | 2 |
| `admin-booking-notification-v1` | `src/lib/email/templates.ts` | admin | ano, schválit/zamítnout/admin detail | ne | 3 |
| `admin-booking-cancelled-v1` | `src/lib/email/templates.ts` | admin | ne | ne | 3 |
| `admin-booking-rescheduled-v1` | `src/lib/email/templates.ts` | admin | ano, admin detail | ne | 3 |
| `voucher-sent-v1` | `src/lib/email/templates.ts` + `src/features/vouchers/lib/voucher-email-template.ts` | klient/příjemce voucheru | ano, ověření voucheru | ano, PDF | 4 |

Přímý call site voucherového HTML builderu je orchestrace `voucher-sent-v1` v `src/lib/email/templates.ts`; ostatní použití je v jeho unit testu. Preview script volá pouze veřejný `renderEmailTemplate`. Batch script jej volá a předává přílohy do odeslání.

## 3. Co bude migrováno

Pouze tvorba HTML těla e-mailu: layout, tabulková e-mailová struktura, inline styly, textové bloky, odkazy, tlačítka, karty a escaping řešený JSX/React Email komponentami. Zachová se stejný vstupní payload, subject, výstupní HTML kontrakt a template key. Plain text zůstane explicitní variantou mimo React Email, dokud nebude prokazatelně nahrazena samostatným textovým rendererem.

## 4. Co zůstává beze změny

Beze změny zůstávají Nodemailer, SMTP/provider (včetně Resendu), `EmailLog`, worker, retry/locking mechanismus, booking/reminder scheduler, ICS generátor, PDF generátor, databáze, template keys a payload contracts. Nemění se ani booking a voucher business logika. Jediná změna na integrační hranici má být dosazení výsledného HTML do stávajícího `RenderedEmailTemplate`.

## 5. Navržená cílová struktura

Minimální struktura:

```text
src/lib/email/react-email/
  _components/
    EmailShell.tsx
    EmailCard.tsx
    EmailButton.tsx
    ContactBlock.tsx
  BookingConfirmationEmail.tsx
  BookingApprovedEmail.tsx
  BookingReminderEmail.tsx
  BookingRescheduledEmail.tsx
  BookingCancelledEmail.tsx
  BookingRejectedEmail.tsx
  AdminBookingNotificationEmail.tsx
  AdminBookingCancelledEmail.tsx
  AdminBookingRescheduledEmail.tsx
  VoucherSentEmail.tsx
```

Komponenty mají být pouze sdílené vizuální stavební bloky. Orchestrace, payload schema, subject, plain text a přílohy zůstanou v existující e-mailové vrstvě; nevytvářet obecný registry/framework nad rámec potřebných template keys.

## 6. Pořadí migrace

1. `booking-confirmation-v1` jako pilot.
2. Klientské booking e-maily: approved, reminder, rescheduled, cancelled, rejected.
3. Admin e-maily.
4. Voucherový e-mail; PDF se generuje a připojuje stejně jako dnes.
5. Cleanup starých ručních HTML helperů až po přepnutí všech keys.
6. Finální audit kontraktů, preview a příloh.

## 7. Rizika

- Escaping: JSX zabrání části ručního HTML escapingu, ale URL atributy, textové hodnoty a případné raw HTML musí mít explicitní pravidla.
- Akční/tokenové URL: nesmí se změnit hodnota, encoding, volitelnost ani cílová route.
- `render()` je async; renderer nesmí měnit synchronní očekávání callerů ani načítání brandingu.
- PDF a ICS attachments nejsou HTML; musí vznikat a vracet se stejným kódem a metadaty.
- Preview musí dál volat veřejný `renderEmailTemplate` a generovat všech osm booking/admin preview scénářů.
- Plain text se z React komponenty automaticky neodvozuje bez změny strategie; zachovat současné textové výstupy a jejich testy.
- E-mailový klient může měnit podporu CSS; porovnat výsledné HTML v preview, zejména tlačítka a tabulkový layout.

## 8. Testovací strategie

Existující základ:

- `src/lib/email/templates.test.ts` – všechny booking/admin keys, escaping, akční URL, legacy payloady, časové pásmo a ICS.
- `src/features/vouchers/lib/voucher-email-template.test.ts` – VALUE/SERVICE varianty, text, escaping obsahu a PDF metadata.
- `src/lib/email/provider.test.ts` – provider a předání příloh.
- `src/features/booking/lib/booking-email-worker.integration.test.ts` – worker delivery a reminder flow.
- `src/features/booking/lib/booking-public-voucher.integration.test.ts` – booking confirmation a voucher vazby.

Minimální příkazy po implementaci jednotlivých fází:

```bash
npm test -- src/lib/email/templates.test.ts src/features/vouchers/lib/voucher-email-template.test.ts
npm run email:previews
npm test -- src/lib/email/provider.test.ts src/features/booking/lib/booking-email-worker.integration.test.ts
```

Před dokončením migrace doplnit snapshot/strukturální kontroly výsledného HTML nebo explicitní ekvivalenční assertions; vizuální kontrola vzniklých souborů v `tmp/email-previews` je povinná pro každou skupinu šablon.

## 9. Stav migrace

- [x] **Fáze 1 – booking confirmation pilot:** `booking-confirmation-v1` renderuje HTML pomocí `react-email`; vznikly pouze prezentační komponenty `EmailLayout`, `BookingDetailCard` a kontaktní bloky. `renderEmailTemplate` zůstává async, payload/subject/plain text i doručovací a attachment infrastruktura beze změny. Vývojový preview běží přes `@react-email/ui` a `npm run email:dev`; žádná odchylka od plánu.
- [x] **Fáze 2 – klientské booking e-maily:** approved, reminder, rescheduled, cancelled, rejected; HTML používá React Email, plain-text a ICS/tokenové URL zůstávají v původní orchestraci.
- [x] **Fáze 3 – admin e-maily:** `admin-booking-notification-v1`, `admin-booking-cancelled-v1` a `admin-booking-rescheduled-v1` renderují HTML přes React Email. URL akcí a detailu vznikají v dosavadní orchestraci a renderer je pouze přijímá přes props; token generation ani expirace se nezměnily. Sdílený `BookingDetailCard`, `EmailLayout` a rozšířený `EmailButton` zachovávají operační hierarchii akcí včetně destruktivní varianty. Testy ověřují obsah, přesné fiktivní action URL, jejich nepřítomnost v nerelevantních šablonách a JSX escaping poznámky bez aktivního script elementu. Fáze 4 musí zachovat samostatnou voucherovou PDF a ověřovací URL orchestraci.
- [x] **Fáze 4 – voucher:** `voucher-sent-v1` renderuje HTML přes React Email. Synchronous `buildVoucherEmailTemplate` se změnil na async a jediný produkční call site v `renderEmailTemplate` jej awaituje. VALUE i SERVICE varianta, plain text a voucher-specific `VoucherDetailCard` jsou pokryté testy; PDF attachment zůstává beze změny (původní bytes, filename a `application/pdf`) a nadále vzniká v orchestrace `templates.ts`. Verification URL nadále skládá orchestrace pomocí `buildVoucherVerificationUrl` a React komponenta ji pouze přijímá přes props. Pro Fázi 5 zbývá odstranit až tehdy nepoužívané legacy HTML helpery.
- [ ] **Fáze 5 – cleanup:** odstranit pouze nepoužívané ruční HTML helpery po ověření nulových call sites.
- [ ] **Fáze 6 – audit:** projít všech 10 keys, payload contracts, plain text, preview, provider, worker, retry/locking a přílohy.

Tento checklist je výchozí stav; každá další implementační fáze jej musí aktualizovat.
