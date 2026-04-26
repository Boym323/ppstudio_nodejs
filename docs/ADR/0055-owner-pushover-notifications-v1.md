# ADR 0055: Owner Pushover Notifications V1

## Kontext
- Owner potrebuje rychle mobilni upozorneni na dulezite rezervacni a systemove udalosti.
- Notifikace nesmi zahlcovat, nesmi obsahovat citlive detaily klientky a nesmi rozbit booking, email ani reminder flow.
- Role `SALON` nema spravovat ani dostavat tyto osobni owner notifikace.

## Rozhodnutí
- Pushover je server-only integrace v `src/lib/notifications/pushover.ts` s verejnou funkci `sendOwnerPushover(input)`.
- App token je serverovy env `PUSHOVER_APP_TOKEN`, globalni vypinac je `PUSHOVER_ENABLED=true`.
- Per-owner nastaveni je samostatny model `UserNotificationSettings` s 1:1 vazbou na `AdminUser`, ne rozsireni hlavniho admin uzivatele o provozni integracni pole.
- Admin UI je v owner-only sekci `/admin/nastaveni` jako blok `Pushover notifikace`, vcetne User Key, hlavniho toggle, event togglu a testovaci notifikace.
- Odesilaci dotaz vzdy vybira pouze aktivni `AdminRole.OWNER` uzivatele s `pushoverEnabled`, vyplnenym User Key a zapnutym konkretnim event typem.
- Stejny `type + bookingId/contextId/emailLogId` se v jednom procesu neposle casteji nez jednou za 30 sekund.
- Chyby Pushover API se pouze loguji; produkcni flow pokracuje bez vyhozeni chyby.

## Alternativy
- Rozsirit `AdminUser` primo o Pushover pole. To by bylo jednodussi, ale michalo by identitu uzivatele s volitelnymi notifikacnimi preferencemi.
- Posilat Pushover pres email worker/frontu. To by pridalo audit a perzistenci, ale zvysilo by zasah do existujici email worker logiky, kterou aktualni zmena nema menit.
- Pouzit externi Pushover SDK. Neni potreba; API je jednoduchy POST a vestaveny `fetch` staci.

## Důsledky
- OWNER ma samostatne, per-user nastavitelne mobilni upozorneni bez dopadu na `SALON`.
- Pushover lze bezpecne vypnout env promennou nebo nevyplnenym app tokenem.
- In-memory rate limit chrani proti lokalnim duplicitam, ale neni globalni napric vice procesy nebo servery.
- Pushover zpravy nejsou auditni log; zdrojem pravdy zustavaji `Booking`, `BookingStatusHistory`, `BookingRescheduleLog` a `EmailLog`.

## Stav
- schváleno
