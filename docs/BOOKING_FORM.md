# Rezervační formulář – současná implementace PP Studio

> Aktualizováno proti zdrojovému kódu k verzi **3.36.1** dne 24. 10. 2026. Při rozporu má přednost implementace a `prisma/schema.prisma`. Tento dokument popisuje veřejný formulář; správa a publikování termínů jsou v [AVAILABILITY_PLANNER.md](AVAILABILITY_PLANNER.md), celý životní cyklus rezervace a e-mailů v [BOOKING_FLOW.md](../BOOKING_FLOW.md).

## Cesty a vstupní data

- Stránka: `/rezervace` → `src/app/(booking)/rezervace/page.tsx`. Server načte `getPublicBookingCatalog()` a profil salonu a vykreslí [`booking-page.tsx`](../src/features/booking/components/booking-page.tsx). Pokud nejsou služby nebo vůbec žádné publikované sloty, ukáže fallback s kontaktem, nikoliv nefunkční formulář.
- Parametry: `?service=<slug>` předvybere službu (legacy slug trvale přesměruje na kanonický), `?voucher=<kód>` předvyplní kód voucheru a `?source=<zdroj>` určuje kontext vstupu. Povolené zdroje jsou `service_detail`, `price_list`, `homepage`, `voucher`, `direct_booking`, `other`; neznámý zdroj se změní na `direct_booking`. Stránka s query parametry má `noindex`.
- Zdroj dat je PostgreSQL: `ServiceCategory`, `Service`, `AvailabilitySlot`, `AvailabilitySlotService`, `Booking`, `SiteSettings`. Veřejné časy **nejsou kopie admin kalendáře**: počítají se z publikované dostupnosti, rezervací a aktuálních pravidel.

## Struktura formuláře a komponenty

Čtyři fáze vyplývají z [`stepLabels`](../src/features/booking/components/booking-flow/helpers.ts): **Služba → Termín → Kontakt → Souhrn**. Kategorie je součást výběru služby, ne samostatný krok. Vše řídí [`booking-flow.tsx`](../src/features/booking/components/booking-flow.tsx) jako klientský wizard s `useActionState(createPublicBookingAction)`:

| Část | Implementace | Co zajišťuje |
| --- | --- | --- |
| Služba | [`service-step.tsx`](../src/features/booking/components/booking-flow/service-step.tsx), [`category-select.tsx`](../src/features/booking/components/category-select.tsx) | Kategorie, nabídka služby, délka a orientační cena, změna služby či předvýběr ze slugu |
| Termín | [`term-step.tsx`](../src/features/booking/components/booking-flow/term-step.tsx) | Doporučené časy, kalendář dostupných dní, hodinové skupiny, fallback při nulové nabídce pro službu |
| Doporučení | [`suggested-slots.tsx`](../src/features/booking/components/suggested-slots.tsx) | Výběr a zobrazení podmnožiny vhodných časů (nejvýše šest), nikoliv celá dostupnost |
| Kontakt | [`contact-step.tsx`](../src/features/booking/components/booking-flow/contact-step.tsx) | Jméno, e-mail, nepovinný telefon, poznámka, voucher; inline chyby, `aria-describedby`, focus |
| Souhrn / mobil | [`summary-sidebar.tsx`](../src/features/booking/components/booking-flow/summary-sidebar.tsx), [`sticky-cta.tsx`](../src/features/booking/components/sticky-cta.tsx) | Revize výběru, návrat k editaci, finální CTA „Odeslat rezervaci“ |
| Výsledek | [`booking-confirmation-panel.tsx`](../src/features/booking/components/booking-confirmation-panel.tsx) | Výsledek založení požadavku, kontakt a odkazy pro správu rezervace |

Stav UI drží zejména `currentCatalog`, `selectedCategoryKey`, `selectedServiceId`, `selectedDateKey`, `selectedTimeOptionKey`, kontakt, `voucherCode`, `appliedVoucherCode`, `voucherApplication` a `currentStep`. Změna služby ruší závislý výběr termínu a vyžaduje nové ověření voucheru. Výběr času **nerezervuje kapacitu** – rozhoduje až transakční submit.

## Výpočet dostupných časů

1. [`booking-availability-policy.ts`](../src/features/booking/lib/booking-availability-policy.ts) načte z `SiteSettings` rezervační okno `bookingMinAdvanceHours` a `bookingMaxAdvanceDays` (databázové defaulty 2 hodiny a 90 dní). Služba musí být aktivní, veřejně rezervovatelná a v aktivní kategorii. Slot musí mít stav `PUBLISHED`.
2. [`booking-availability-core.ts`](../src/features/booking/lib/booking-availability-core.ts) načte relevantní sloty, aktivní rezervace a podklady pro optimalizaci. Pro veřejné konflikty se používají `PENDING` a `CONFIRMED`; obsazený interval končí v `blockedUntil ?? scheduledEndsAt`. Kompatibilní sousední sloty se pro katalog mohou sloučit, ale jejich segmenty a původní `slotId` zůstávají sledovatelné.
3. Klient filtruje sloty podle vybrané služby: délka služby se musí vejít, `ANY` dovoluje obecnou nabídku a `SELECTED` vyžaduje vybranou službu v `allowedServiceIds`. [`booking-time-slots.ts`](../src/features/booking/lib/booking-time-slots.ts) skládá obvyklé kandidáty po **30 minutách** a výjimečné **15minutové** starty na hranách rezervací/úklidu a odvozeného oběda.
4. V projektu platí **jedna kapacita (`capacity=1`)**. Klientka vidí délku služby `durationMinutes`, ale při obsazenosti se respektuje také `cleanupMinutes` zaokrouhlené na čtvrthodiny. Nesmí vzniknout kolize v `startsAt → blockedUntil`.
5. [`filterTimeOptionsForAutoLunch`](../src/features/booking/lib/booking-time-slots.ts) odstraní časy, které by při aktivní politice znemožnily automatický oběd. `selectableTimeOptions` obsahuje jen nedisablované možnosti.
6. [`selectSuggestedSlots`](../src/features/booking/lib/booking-schedule-optimization.ts) vybírá kvalitativně dobrá doporučení podle fragmentace a návaznosti. Ranking smí měnit **jen doporučení**, nikoli veškeré platné možnosti v kalendáři.

Přesná pravidla oběda: **45 minut**, začátky **11:00 až 13:00 po 15 minutách**, minimálně **5 hodin skutečného pracovního dne** v `Europe/Prague`; aktivace a pozice se počítají, oběd se nepersistuje jako slot nebo rezervace. Viz [SCHEDULE_OPTIMIZATION_MIGRATION.md](SCHEDULE_OPTIMIZATION_MIGRATION.md).

## Odeslání a validační kontrakt

HTML `<form action={formAction}>` odesílá kontaktní pole a hidden `serviceId`, `slotId`, `startsAt` a **ověřený** `voucherCode`. Zpracovává je [`create-public-booking.ts`](../src/features/booking/actions/create-public-booking.ts) se serverovým Zod schématem:

| Pole | Aktuální serverová podmínka |
| --- | --- |
| `serviceId`, `slotId` | Povinné, max. 64 znaků; skutečná existence/povolenost se znovu ověří |
| `startsAt` | Povinné; doména kontroluje platný čas, publikační pokrytí a kolize |
| `fullName` | 3–120 znaků a alespoň dvě písmena |
| `email` | Platná e-mailová adresa, max. 254 znaků |
| `phone` | Nepovinný, max. 32 znaků; zadaná hodnota musí projít `isValidClientPhoneInput` |
| `clientNote` | Nepovinná poznámka, max. 600 znaků |
| `voucherCode` | Nepovinný, max. 64 znaků; ověřuje se také serverově pro konkrétní službu |

- Klientská validace slouží pro UX; nesmí nahradit serverovou. Rate limit: **8 pokusů na IP / 10 minut** a **3 neúspěšné pokusy na e-mail / 10 minut**. Zapisuje se audit `BookingSubmissionLog`.
- [`createPublicBooking`](../src/features/booking/lib/booking-public.ts) ověřuje aktuální nastavení i voucher. Veřejný submit vždy předává `source: WEB`, `status: PENDING`, `allowManualOverride: false`.
- [`createBookingWithEngine`](../src/features/booking/lib/booking-public/engine.ts) uvnitř **Serializable transakce** znovu načte pravidla a službu, zamyká sloty/pokrytí, kontroluje kolize, kapacitu, oběd a vytvoří `Client`/`Booking`, historii, tokeny a `EmailLog`. Stale `slotId` není oprávnění k vytvoření rezervace.
- Nová veřejná rezervace je **`PENDING`**, ale již blokuje čas. Admin ji může následně potvrdit; `CONFIRMED` není automatický výsledek formuláře.
- Veřejně vložený voucher znamená **intended voucher**, ne okamžité `VoucherRedemption`. Hodnota se uplatní až v administraci při dokončení návštěvy. E-mailová fronta, stavové přechody, ICS a storno: [BOOKING_FLOW.md](../BOOKING_FLOW.md).
- Akviziční UTM/MTM cookie, Matomo a Meta Pixel sledují neosobní eventy; **kontakty, poznámky a raw tokeny neodesílat do analytiky**.

## Chybové stavy a stale katalog

Formulář drží `PublicBookingActionState` (`idle/error/success`, `fieldErrors`, `errorCode`, `suggestedStep`, `confirmation`). Pokud se slot mezitím obsadí nebo změní, kódy `SLOT_UNAVAILABLE`, `SLOT_NOT_ALLOWED`, `SLOT_TOO_SHORT` a relevantní `BOOKING_CONFLICT` vyvolají [`availability-refresh.ts`](../src/features/booking/components/booking-flow/availability-refresh.ts) a [`refresh-public-booking-catalog.ts`](../src/features/booking/actions/refresh-public-booking-catalog.ts). UI aktualizuje katalog, zruší chybný čas a přejde ke kroku Termín. Po selhání refreshe dovolí opakování. Request ID a revize formuláře brání přepsání novějšího výběru zastaralou odpovědí.

Změna slotů v adminu **neposílá okamžitý push do otevřené veřejné stránky**. Nový katalog vzniká při novém načtení; souběh je ošetřen při finálním serverovém zápisu. Pouhé klientské zobrazení dostupného času není garancí rezervace.

## Regresní scénáře a odkazy

1. Vstup se službou ze slugu/aliasu, změna kategorie a reset termínu.
2. Žádné služby / žádné publikované termíny / žádný vhodný termín pro službu.
3. Různé délky a cleanup, navazující sloty, čtvrthodinové hranice a DST.
4. `PENDING` a `CONFIRMED` již zabírají čas; dvě souběžná vytvoření nemohou obsadit stejný blok.
5. Stará klientská nabídka, kolize při odeslání a refresh bez ztráty kontaktu.
6. Voucher s jinou službou, oběd `AUTO/OFF`, přístupnost a mobilní sticky CTA.

Testy: [`tests/e2e/booking-flows.spec.ts`](../tests/e2e/booking-flows.spec.ts), [`tests/e2e/accessibility.spec.ts`](../tests/e2e/accessibility.spec.ts), testy v `src/features/booking/`.

**Kde co měnit:** UI v `booking-flow.tsx` a `booking-flow/*`; generování dostupnosti v `booking-availability-{policy,core}.ts` a `booking-time-slots.ts`; authoritative write v `create-public-booking.ts` a `booking-public/engine.ts`; správa publikovaných intervalů v [AVAILABILITY_PLANNER.md](AVAILABILITY_PLANNER.md).