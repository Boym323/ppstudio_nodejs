# Conform Audit — PP Studio

## Executive summary

PP Studio používá Server Actions, React 19 `useActionState`, Zod 4 a nativní uncontrolled HTML formuláře. Opakovaný plumbing je reálný hlavně v převodu `FormData` a ručním převodu Zod chyb do `fieldErrors`. Zároveň je mnoho formulářů provozně jednoduchých a největší booking formuláře mají řízený lookup, více intentů, idempotency a business pravidla. Conform by mohl zachovat Server Actions, ale nepřevezme Prisma, autorizaci ani business orchestration. Přínos je jasný u standardních settings/catalog formulářů, ne u celého adminu. Verdikt: **PILOT ONLY**.

## Current form architecture

Technologický kontrakt: Next.js `16.3.0`, React `19.2.8`, Zod `4.4.3`, TypeScript 5. Formuláře používají nativní `<form action={formAction}>`, `useActionState` a `useFormStatus`. Server Action přijímá `(previousState, formData)`, ručně čte hodnoty, volá Zod `safeParse`, vrací typovaný action-state a potom provádí guardy, Prisma operace, audit, side effects, `revalidatePath` nebo redirect.

Typický tok:

```text
uncontrolled HTML / lokální controlled UI
  → Server Action + FormData
  → readFormString/readFormBoolean nebo přímé get()
  → Zod 4 safeParse
  → { status, formError, fieldErrors, successMessage }
  → Prisma + business pravidla + side effects
```

## Inventory

Repozitář obsahuje přibližně 36 souborů s admin form markup/state a nejméně 11 action modulů s `FormData`. Níže je reprezentativní inventář.

| Form | Action | Complexity | Boilerplate | Conform fit | Recommendation |
|---|---|---:|---:|---:|---|
| `AdminSalonSettingsForm` | `updateSalonSettingsAction` | B, 8 polí, text/email/url/select | střední | vysoký | **PILOT / OVĚŘIT** |
| `AdminEmailSettingsForm` | `updateEmailSettingsAction` | B, 4 textová pole | nízký–střední | střední | ponechat / porovnat |
| `AdminPushoverSettingsForm` | `updatePushoverSettingsAction` | B, text + checkboxy | střední | střední | až po settings pilotu |
| `AdminServiceForm` | `createServiceAction` / `updateServiceAction` | C, cca 20 polí, čísla, checkboxy, create/edit | vysoký | vysoký pro plumbing | **PILOT / OVĚŘIT** |
| `AdminServiceCategoryForm` | create/update category actions | B, select + čísla + enum | střední | střední–vysoký | později |
| `CreateManualBookingDrawer` | `createManualBookingAction` | C, lookup, slot/manual režim | vysoký | nízký–střední | **NEMIGROVAT nyní** |
| `AdminBookingStatusForm` | status/complete actions | C, voucher/direct payment, controlled | vysoký | nízký | **NEMIGROVAT** |
| `AdminBookingPaymentForm` | booking payment actions | B/C, create/edit/delete, idempotency | střední | nízký–střední | NEMIGROVAT nyní |
| `AdminBookingPriceForm` | `updateBookingPriceAction` | B, controlled cena + přeplatek | střední | nízký–střední | NEMIGROVAT |
| `AdminClientContactForm` | `updateClientContactAction` | A/B, 2 pole | nízký | nízký | NEMIGROVAT |
| `AdminInviteActivationForm` | activation action | A, heslo + confirm, `superRefine` | nízký | střední | ponechat |
| `AdminMediaPage` upload | `uploadMediaAction` | C, file upload + metadata | vysoký | nízký | **NEMIGROVAT** |

Klasifikace: A jednoduché, B střední, C komplexní. U standardních formulářů převažuje `defaultValue`/uncontrolled model; controlled `value`/state je v lookup, booking a potvrzovacích UI.

## Repeated boilerplate

- Lokální `readFormString` je v settings, service, client, booking a email-log actions; pattern je `formData.get(key)` + kontrola stringu.
- Checkboxy mají varianty `readFormBoolean` / `readCheckbox` a hodnoty `"1"`, `"on"` nebo `"true"`.
- Actiony ručně skládají objekt pro schema z přibližně 4 až 24 klíčů; `service-actions.ts` je nejvýraznější.
- Validační chyby se opakovaně převádějí přes `parsed.error.flatten().fieldErrors` a explicitně mapují na `fieldErrors.foo?.[0]`.
- Action-state typy opakují `status`, `formError`, `successMessage` a `fieldErrors`.
- Komponenty opakují render obecné chyby, success zprávy a textu pod polem.
- Hodnoty se po chybě zachovají hlavně přirozeně přes browser/`defaultValue`; obecný snapshot submitted values v action state není.
- `formData.getAll(...)`, `safeParseAsync`, ruční `aria-invalid` a `aria-describedby` se v relevantním admin rozsahu prakticky nepoužívají.

Skutečný boilerplate je parsing + explicitní field-error mapping. Business logika (role, guardy, Prisma, transakce, idempotency, audit, e-maily, redirect/revalidate) není kód, který má převzít Conform.

## Compatibility

### Next.js / Server Actions

Kompatibilita je dobrá: případný `parseWithZod` může být vložen před existující business část Server Action a native Server Action kontrakt může zůstat. Není důvod přecházet na client-side fetch. Ověřit se musí mapování výsledku do současného action-state a zachování business error větve.

### Zod 4

Projekt používá Zod 4. Schemas často přijímají raw stringy přes `z.coerce`, `z.preprocess`, `.refine` a `.superRefine` — například služby, settings a booking payments. Conform odstraní část ručního sestavení vstupu, nikoli tato pravidla.

### Radix/custom inputs, controlled state a accessibility

Jednoduchá integrace: native input, textarea, select, hidden input a checkbox bez lokální logiky. Malý adapter: vlastní `SettingsField` a komponenty generující hidden value z lokálního stavu. Problematická integrace: autocomplete/lookup, `CreateManualBookingDrawer`, status form s voucher/direct větvemi, controlled cena s potvrzením přeplatku a upload.

Accessibility je dnes jednoduchá, ale neúplně explicitní: label vazbu řeší obalující `<label>`, chyby jsou text pod polem, ruční `aria-invalid`, `aria-describedby` a focus po chybě nejsou běžným patternem. Conform by mohl sjednotit metadata, ale nenahradí správné obalení custom komponent ani focus management.

## Pilot candidate

Doporučený jediný pilot: `src/features/admin/components/admin-salon-settings-form.tsx` + `updateSalonSettingsAction` v `src/features/admin/actions/settings-actions.ts` + `updateSalonSettingsSchema` v `src/features/admin/lib/admin-settings-validation.ts`.

Je reprezentativní (8 polí, text/email/url/select, optional empty values, Zod refine, server success/error a field errors), ale bez lookupu, uploadu, více intentů a složité booking business logiky. Relevantní testovací opory jsou `src/features/admin/actions/actions-validation.test.ts` a `action-states.test.ts`.

## Estimated before/after

U pilotu je zhruba 35–50 řádků relevantního action plumbing (čtení polí, `safeParse`, flatten/mapování a result větev) plus opakovaný field-error rendering. S Conformem by pravděpodobně zmizelo ruční sestavení vstupního objektu a explicitní mapování validačních chyb; zůstaly by schema, Server Action, authorization/business větev, success/form error a layout. Přibyly by Conform metadata, result parsing a napojení field props.

Odhad: **boilerplate -25 až -40 %**. U `AdminServiceForm` by úspora mohla být vyšší, ale create/edit intent a business warnings by se z velké části pouze přesunuly.

## Migration risk

**MEDIUM** pro jeden pilot, **HIGH** pro plošnou migraci.

- Pilot má nízkou business složitost, ale mění error/result wiring.
- Plošná migrace zasáhne mnoho action-state kontraktů.
- Controlled lookup, booking intenty, idempotency, upload a cross-field validace vyžadují individuální návrh.
- Shared helper není nutný pro první pilot; adaptery pro komplexní komponenty by neměly vznikat před ověřením přínosu.
- Testy musí pokrýt action výsledky, submitted values a role/auth chování.

## Forms not worth migrating

Ponechat `CreateManualBookingDrawer`, `AdminBookingStatusForm`, `AdminBookingPriceForm`, payment formuláře, upload médií a autocomplete/lookup. Obtíž zde není převod raw hodnot, ale controlled UI, více režimů, idempotency, potvrzovací stavy, file handling a server-side business rozhodnutí. Ponechat také velmi malé formuláře se dvěma poli.

## Testovací strategie případného pilotu

Pilot musí ověřit validní submit, jednu i více invalidních hodnot, zachování zadaných hodnot, select, optional prázdné hodnoty, URL/email/phone pravidla, success state, obecnou business chybu, field error, metadata `id/name/label/aria-invalid/aria-describedby`, pending stav a nezměněný Server Action contract. Authorization/role OWNER/SALON, Prisma, audit, side effects, redirect/revalidate a server security musí zůstat mimo Conform.

## Co Conform NESMÍ převzít

Prisma, DB transakce, authorization, role OWNER/SALON, booking/voucher business logic, audit logy, side effects, e-mailové odesílání, redirect/revalidate pravidla ani serverovou security kontrolu.

## Decision

### PILOT ONLY

Audit prokázal opakovaný plumbing a zachování Server Actions je možné, ale jasný přínos je nejlépe doložen u omezené skupiny standardních formulářů. U komplexních booking formulářů by Conform významnou část složitosti pouze přeskupil. Plošné **GO** proto není podloženo.

## Bodovací model

| Oblast | Skóre (0–10) | Komentář |
|---|---:|---|
| Redukce boilerplate | 6 | Úspora v parsing/error mappingu, ne v business kódu. |
| Čitelnost | 6 | Lepší metadata, ale další abstrakce v jednoduchých formulářích. |
| Typová bezpečnost | 6 | Zod zůstává, action-state hranice vyžaduje návrh. |
| Accessibility | 5 | Potenciál sjednocení, současný základ je už jednoduchý. |
| Server Action compatibility | 8 | Native action tok lze zachovat. |
| Custom/Radix compatibility | 5 | Jednoduché prvky ano, lookup/controlled prvky s adaptérem. |
| Migrační riziko | 5 | Pilot přijatelné, plošně vysoké. |
| Dlouhodobá údržba | 6 | Smysl pouze jako selektivní standard. |

## Proposed next step

Pokud bude pokračovat pilot, scope je pouze `AdminSalonSettingsForm`, jeho action, schema a cílené testy/action contract. Acceptance criteria: stejný Server Action kontrakt, stejné business a auth chování, stejné nebo lepší field/form errors, zachované hodnoty po chybě, ověřené accessibility props a žádný Conform kód v Prisma/business vrstvě.

