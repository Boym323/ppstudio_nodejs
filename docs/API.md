# API Reference

Praktická reference hlavních HTTP endpointů v PP Studio aplikaci.

Tento dokument není kompletní seznam každé interní route, ale je zdrojem pravdy pro veřejné a provozně důležité endpointy, které:
- používá monitoring nebo externí integrace,
- čte admin UI přes `fetch`,
- mají samostatný bezpečnostní nebo provozní kontrakt.

Pro přesný runtime kontrakt je vždy rozhodující implementace route handleru v `src/app/api/**/route.ts`.

## Přehled

| Endpoint | Metoda | Přístup | Účel |
| --- | --- | --- | --- |
| `/api/health` | `GET` | veřejný | Provozní health check webu, DB a email workeru |
| `/api/calendar/owner.ics?token=...` | `GET` | veřejný přes tajný token | Owner-only Apple/ICS subscription feed |
| `/api/bookings/calendar/[token].ics` | `GET` | veřejný přes tajný token | Klientský `.ics` export konkrétní rezervace |
| `/api/auth/login` | `POST` | veřejný | Admin login handler se session cookie |
| `/api/auth/logout` | `POST` | admin session | Admin logout handler |
| `/api/admin/analytics` | `GET` | admin-only (`OWNER`, `SALON`) | Agregovaná Matomo dashboard data |
| `/api/admin/bookings/search` | `GET` | admin-only (`OWNER`, `SALON`) | Našeptávání hledání v rezervacích |
| `/api/admin/vouchers/lookup` | `GET`, `POST` | admin-only (`OWNER`, `SALON`) | Lookup voucheru pro admin workflow |
| `/api/admin/users/resend-invite` | `POST` | admin-only (`OWNER`) | Znovuodeslání admin pozvánky |
| `/api/webhooks/resend` | `POST` | veřejný webhook | Zpracování Resend email eventů |

## `GET /api/health`

Účel:
- veřejný endpoint pro monitoring a rychlou diagnostiku produkce
- kontroluje:
- DB dostupnost přes rychlý `SELECT 1`
- stav email outbox fronty
- přítomnost backlogu bez aktivního worker claimu
- stale processing claimy
- failed email logy
- poslední odeslaný email a poslední recent error

Přístup:
- veřejný

Vstup:
- bez request body

Odpověď:
- HTTP status:
- `200`: `status=ok` nebo `status=warning`
- `503`: `status=error`, typicky DB chyba nebo kritický stav email workeru
- hlavičky:
- `Cache-Control: no-store`
- `Content-Type: application/json`
- shape odpovědi při běžném běhu:

```json
{
  "status": "ok",
  "checkedAt": "2026-06-29T17:12:34.000Z",
  "durationMs": 24,
  "release": {
    "version": "0.3.34",
    "deploymentId": "abc123def456",
    "deploymentVersion": "abc123def456",
    "gitHash": "abc123def456"
  },
  "db": {
    "status": "ok"
  },
  "emailWorker": {
    "status": "ok",
    "staleClaimTimeoutMs": 600000,
    "summary": "Worker frontu zpracovává bez aktivní chyby."
  },
  "emailQueue": {
    "pending": 0,
    "retrying": 0,
    "processing": 0,
    "staleProcessing": 0,
    "failed": 0
  },
  "emailDelivery": {
    "lastSentAt": "2026-06-29T12:49:49.676Z",
    "lastErrorAt": null,
    "hasRecentError": false,
    "recentErrorWindowMs": 86400000
  },
  "alerts": []
}
```

Poznámky:
- `status=warning` znamená neideální, ale ne fatální stav, typicky backlog `pending/retrying` bez aktivního claimu.
- `status=error` znamená produkční problém vyžadující zásah.
- `release.*` slouží pro porovnání monitoringu s aktivním releasem a startup logy.
- `hasRecentError` je omezené na posledních 24 hodin; přesné okno vrací `recentErrorWindowMs`.
- Endpoint nesmí vracet citlivá data, raw tokeny ani plné texty emailových chyb.

Vysvětlení polí:
- `checkedAt`: čas, kdy endpoint health snapshot sestavil.
- `durationMs`: jak dlouho endpointu trvalo health check spočítat a vrátit odpověď; vyšší číslo může signalizovat zpomalení DB nebo serveru.
- `release.deploymentId`: hlavní identifikátor aktivního releasu, typicky aktuální commit nasazený do runtime.
- `release.version`: aplikační verze převzatá z `package.json`.
- `release.deploymentVersion`: alias deployment identifikátoru pro prostředí, kde se používá tato env proměnná.
- `release.gitHash`: git commit hash dostupný v runtime env; používá se jako fallback nebo doplňkový identifikátor buildu.
- `db.status`: výsledek rychlé DB dostupnosti.
- `emailWorker.status`: agregovaný stav email workeru z pohledu fronty.
- `emailWorker.staleClaimTimeoutMs`: po jaké době se aktivní processing claim považuje za zaseknutý.
- `emailQueue.pending`: nové emaily čekající na první odeslání.
- `emailQueue.retrying`: emaily čekající na další retry pokus.
- `emailQueue.processing`: emaily, které si worker právě claimnul a zpracovává.
- `emailQueue.staleProcessing`: emaily, které vypadají jako claimnuté příliš dlouho a worker se na nich mohl zaseknout.
- `emailQueue.failed`: emaily ukončené jako definitivně neúspěšné.
- `emailDelivery.lastSentAt`: čas posledního úspěšně odeslaného emailu.
- `emailDelivery.lastErrorAt`: čas poslední relevantní emailové chyby ještě uvnitř sledovaného okna.
- `emailDelivery.hasRecentError`: jestli se v posledním sledovaném okně objevila relevantní emailová chyba.
- `emailDelivery.recentErrorWindowMs`: délka časového okna pro `hasRecentError`; aktuálně 24 hodin.
- `alerts`: lidsky čitelný seznam aktivních problémů, které ovlivnily vyhodnocení health stavu.

Implementace:
- [src/app/api/health/route.ts](/var/www/ppstudio/src/app/api/health/route.ts:1)

## `GET /api/calendar/owner.ics?token=...`

Účel:
- read-only owner calendar feed pro Apple Calendar subscription a jiné ICS klienty

Přístup:
- veřejný endpoint, ale jen přes tajný token v query parametru `token`
- bez tokenu nebo s neplatným tokenem vrací `404`

Vstup:
- query parametr `token`

Odpověď:
- HTTP status:
- `200`: vrací `.ics` obsah
- `404`: neplatný nebo chybějící token
- hlavičky při úspěchu:
- `Content-Type: text/calendar; charset=utf-8`
- `Content-Disposition: inline; filename="owner-bookings.ics"`
- `Cache-Control: private, no-store`
- `X-Robots-Tag: noindex, nofollow, noarchive`
- obsah:
- pouze potvrzené owner bookingy
- feed je read-only export, aplikace zůstává source of truth

Implementace:
- [src/app/api/calendar/owner.ics/route.ts](/var/www/ppstudio/src/app/api/calendar/owner.ics/route.ts:1)

## `GET /api/bookings/calendar/[token].ics`

Účel:
- veřejný tokenizovaný `.ics` export konkrétní rezervace pro klientku

Přístup:
- veřejný endpoint, ale jen přes platný booking token v URL
- podporuje tvar s `.ics` suffixem
- bez tokenu nebo s neplatným tokenem vrací `404`

Vstup:
- booking token v URL path

Odpověď:
- HTTP status:
- `200`: vrací `.ics` obsah pro konkrétní rezervaci
- `404`: token není dostupný nebo rezervace není pro export zpřístupněná
- hlavičky při úspěchu:
- `Content-Type: text/calendar; charset=utf-8`
- `Content-Disposition: inline; filename="pp-studio-rezervace-....ics"`
- `Cache-Control: private, no-store`
- `X-Robots-Tag: noindex, nofollow, noarchive`

Poznámky:
- jde o zákaznický kalendářový export navázaný na konkrétní booking
- token nesmí být logovaný nebo kopírovaný do veřejných chybových hlášek

Implementace:
- [src/app/api/bookings/calendar/[...token]/route.ts](/var/www/ppstudio/src/app/api/bookings/calendar/%5B...token%5D/route.ts:1)

## `POST /api/auth/login`

Účel:
- form POST handler pro admin přihlášení

Přístup:
- veřejný endpoint

Vstup:
- `Content-Type: multipart/form-data` nebo běžný HTML form submit
- pole:
  - `email`
  - `password`
  - volitelně `next`

Odpověď:
- validuje payload
- aplikuje server-side rate limit nad hashovanou IP a hashovaným e-mailem
- po úspěchu nastaví admin session cookie
- odpověď není JSON, ale redirect
- redirecty:
- úspěch: `303` na owner nebo salon admin home, případně na bezpečný `next`
- chyba payloadu: `303` na `/admin/prihlaseni?error=invalid_payload`
- špatné přihlašovací údaje: `303` na `/admin/prihlaseni?error=invalid_credentials`
- rate limit: `303` na `/admin/prihlaseni?error=rate_limited`

Bezpečnostní pravidla:
- `next` musí začínat `/admin`
- `next` nesmí být externí URL ani obsahovat `\\`

Implementace:
- [src/app/api/auth/login/route.ts](/var/www/ppstudio/src/app/api/auth/login/route.ts:1)

## `POST /api/auth/logout`

Účel:
- logout handler pro admin session

Přístup:
- admin session

Vstup:
- bez request body

Odpověď:
- smaže admin session cookie nastavením `maxAge: 0`
- vrací `303` redirect na `/admin/prihlaseni`

Poznámky:
- endpoint nevrací JSON
- používá stejnou cookie konfiguraci jako login/session vrstva

Implementace:
- [src/app/api/auth/logout/route.ts](/var/www/ppstudio/src/app/api/auth/logout/route.ts:1)

## `GET /api/admin/analytics`

Účel:
- admin-only JSON endpoint pro dashboard widget `Výkon webu`

Přístup:
- vyžaduje admin session
- povolené role: `OWNER`, `SALON`

Vstup:
- bez request body

Odpověď:
- HTTP status:
- `200`: úspěch i bezpečný fallback při interním problému reportingu
- `403`: bez session nebo bez povolené role
- shape odpovědi při `403`:

```json
{
  "status": "error",
  "message": "Do teto sekce maji pristup jen prihlaseni admin uzivatele."
}
```

- shape odpovědi při `200`:

```json
{
  "reportingStatus": "ok",
  "periodLabel": "Dnes",
  "visits": 123,
  "conversions": 4,
  "conversionRate": 3.25,
  "topSource": "Instagram",
  "sources": [],
  "funnel": {
    "service": 0,
    "date": 0,
    "time": 0,
    "created": 0
  },
  "contactStepQuality": {
    "started": 0,
    "fieldFocus": 0,
    "fieldInputStarted": 0,
    "fieldError": 0,
    "focusRate": 0,
    "inputRate": 0,
    "errorRate": 0
  }
}
```

Poznámky:
- při chybě Matomo reportingu endpoint vrací bezpečný fallback s `reportingStatus != ok`, ale stále HTTP `200`
- endpoint nesmí vracet PII ani `token_auth`
- route má `revalidate = 300`

Vysvětlení polí:
- `reportingStatus`: stav Matomo reportingu; `ok` znamená validní data, jiná hodnota značí fallback nebo problém reportingu.
- `periodLabel`: lidský popisek období, za které jsou čísla počítaná.
- `visits`: počet návštěv ve sledovaném období.
- `conversions`: počet booking konverzí ve sledovaném období podle dashboard definice.
- `conversionRate`: procentuální poměr mezi návštěvami a konverzemi.
- `topSource`: hlavní zdroj návštěv v business-friendly názvu.
- `sources`: detailnější rozpad zdrojů návštěv pro widget.
- `funnel.service`: počet průchodů krokem výběru služby.
- `funnel.date`: počet průchodů krokem výběru data.
- `funnel.time`: počet průchodů krokem výběru času.
- `funnel.created`: počet dokončených rezervací.
- `contactStepQuality.started`: kolikrát uživatelka vstoupila do kontaktního kroku.
- `contactStepQuality.fieldFocus`: kolikrát dostalo fokus první relevantní kontaktní pole.
- `contactStepQuality.fieldInputStarted`: kolikrát uživatelka skutečně začala psát do kontaktního pole.
- `contactStepQuality.fieldError`: kolikrát se v kontaktním kroku objevil field-level error.
- `contactStepQuality.focusRate`, `inputRate`, `errorRate`: odvozené procentuální metriky kvality kontaktního kroku.

Implementace:
- [src/app/api/admin/analytics/route.ts](/var/www/ppstudio/src/app/api/admin/analytics/route.ts:1)

## Interní Admin API

Následující endpointy jsou aktivně používané admin UI, ale jejich kontrakt je internější než u čistě veřejných integračních route. Dokumentujeme je proto hlavně kvůli bezpečné údržbě a provozu.

## `GET /api/admin/bookings/search`

Účel:
- admin-only lookup endpoint pro našeptávání v seznamu rezervací

Přístup:
- vyžaduje admin session
- povolené role: `OWNER`, `SALON`

Vstup:
- `query`: minimálně 2 znaky, maximálně 80

Odpověď:
- HTTP status:
- `200`: vždy vrací JSON se `suggestions`, i když je dotaz nevalidní
- `403`: bez session nebo bez povolené role
- shape odpovědi při `200`:

```json
{
  "status": "success",
  "suggestions": [
    {
      "value": "Jana Novakova",
      "label": "Jana Novakova",
      "detail": "Klientka",
      "kind": "client"
    }
  ]
}
```

Poznámky:
- `kind` je jedno z `client`, `contact`, `service`
- při contact-like dotazu může vracet i e-mail nebo telefon
- endpoint je read-only a neprovádí žádnou mutaci URL ani DB

Vysvětlení polí:
- `suggestions`: seřazený seznam návrhů pro našeptávač.
- `value`: hodnota, která se po výběru použije do inputu nebo filtru.
- `label`: hlavní text zobrazený v seznamu návrhů.
- `detail`: doplňkový popisek, který pomáhá rozlišit stejně vypadající návrhy.
- `kind=client`: návrh podle jména klientky.
- `kind=contact`: návrh podle e-mailu nebo telefonu.
- `kind=service`: návrh podle názvu služby.

Implementace:
- [src/app/api/admin/bookings/search/route.ts](/var/www/ppstudio/src/app/api/admin/bookings/search/route.ts:1)

## `GET /api/admin/vouchers/lookup`
## `POST /api/admin/vouchers/lookup`

Účel:
- lookup voucheru pro admin completion panel a další voucher-aware workflow

Přístup:
- vyžaduje admin session
- povolené role: `OWNER`, `SALON`
- `POST` navíc vyžaduje same-origin admin request

Vstup:
- `GET`: query parametr `voucherCode`
- `POST`: JSON body `{ "voucherCode": "..." }`

Odpověď:
- HTTP status:
- `200`: voucher nalezen
- `400`: neplatný nebo chybějící kód
- `403`: bez session, bez povolené role nebo u `POST` neprojde kontrola původu
- `404`: voucher neexistuje
- shape odpovědi při úspěchu:

```json
{
  "status": "success",
  "voucher": {
    "code": "ABCD-1234",
    "type": "VALUE",
    "typeLabel": "Hodnotový poukaz",
    "status": "ACTIVE",
    "statusLabel": "Aktivní",
    "remainingValueCzk": 1500,
    "serviceNameSnapshot": null,
    "servicePriceSnapshotCzk": null
  }
}
```

Poznámky:
- endpoint vrací efektivní voucher status, ne jen raw DB hodnotu
- `remainingValueCzk` je vyplněné jen pro hodnotové poukazy

Vysvětlení polí:
- `voucher.code`: normalizovaný kód voucheru uložený v systému.
- `voucher.type`: interní typ voucheru, typicky `VALUE` nebo službový voucher.
- `voucher.typeLabel`: lidský český popisek typu voucheru pro UI.
- `voucher.status`: efektivní provozní stav voucheru po započtení pravidel jako expirace.
- `voucher.statusLabel`: lidský český popisek efektivního stavu voucheru.
- `voucher.remainingValueCzk`: zbývající hodnota v Kč; dává smysl jen u hodnotového voucheru.
- `voucher.serviceNameSnapshot`: název služby navázaný na voucher v okamžiku jeho vytvoření.
- `voucher.servicePriceSnapshotCzk`: uložená cena navázané služby v okamžiku vytvoření voucheru.

Implementace:
- [src/app/api/admin/vouchers/lookup/route.ts](/var/www/ppstudio/src/app/api/admin/vouchers/lookup/route.ts:1)

## `POST /api/admin/users/resend-invite`

Účel:
- owner-only endpoint pro znovuodeslání admin pozvánky

Přístup:
- vyžaduje same-origin admin request
- vyžaduje admin session role `OWNER`

Vstup:

```json
{
  "userId": "admin_user_id"
}
```

Odpověď:
- HTTP status:
- `200`: pozvánka znovu odeslaná
- `400`: nevalidní payload
- `403`: neprojde kontrola původu nebo session/role
- `404`: uživatel neexistuje
- `500`: selže příprava nebo odeslání pozvánky

- shape odpovědi při úspěchu:

```json
{
  "status": "success",
  "message": "Pozvanka byla znovu odeslana. Zkontrolujte i slozku spam nebo hromadne."
}
```

Poznámky:
- endpoint interně refreshuje invite stav, vystaví nový token a odešle email
- při neočekávané chybě posílá owner system error alert

Vysvětlení polí:
- `status=success`: pozvánka byla znovu připravená a email odešel do delivery flow.
- `status=error`: akce se nepovedla a `message` popisuje důvod pro UI.
- `message`: uživatelsky čitelná hláška určená pro admin rozhraní.

Implementace:
- [src/app/api/admin/users/resend-invite/route.ts](/var/www/ppstudio/src/app/api/admin/users/resend-invite/route.ts:1)

## `POST /api/webhooks/resend`

Účel:
- webhook endpoint pro Resend email eventy

Přístup:
- veřejný endpoint určený pouze pro Resend
- request musí nést hlavičky:
  - `svix-id`
  - `svix-timestamp`
  - `svix-signature`

Vstup:
- raw request body od Resend webhooku
- hlavičky `svix-id`, `svix-timestamp`, `svix-signature`

Odpověď:
- HTTP status:
- `200`: validní event zpracovaný
- `400`: chybí webhook hlavičky nebo selže verifikace podpisu
- `503`: webhook je vypnutý, protože chybí `RESEND_WEBHOOK_SECRET`
- shape odpovědi:

```json
{
  "status": "ok",
  "matched": true,
  "ignored": false
}
```

Další možné odpovědi:

```json
{
  "status": "invalid"
}
```

```json
{
  "status": "disabled"
}
```

Poznámky:
- payload se verifikuje nad raw request body
- eventy se párují přes `EmailLog.providerMessageId`
- endpoint je integrační vrstva; business výsledek se propsá do email tracking stavu v aplikaci

Vysvětlení polí:
- `status=ok`: webhook prošel ověřením a endpoint event zpracoval.
- `status=invalid`: request neměl validní podpis nebo povinné webhook hlavičky.
- `status=disabled`: webhook processing je vypnutý, protože chybí `RESEND_WEBHOOK_SECRET`.
- `matched`: jestli se příchozí event podařilo napárovat na existující `EmailLog`.
- `ignored`: event byl sice validní, ale záměrně nevedl ke změně stavu, například protože nebyl relevantní.

Implementace:
- [src/app/api/webhooks/resend/route.ts](/var/www/ppstudio/src/app/api/webhooks/resend/route.ts:1)

## Co tu záměrně není

V repu existují i další route handlery a interní admin pomocná API. Ne všechny mají být považované za veřejně dokumentovaný integrační kontrakt.

Typicky sem nespadají:
- interní admin lookup endpointy
- route handlery používané jen konkrétní klientskou komponentou
- endpoints, jejichž kontrakt je zatím záměrně interní a může se rychle měnit

Když se z interní route stane provozně důležitý nebo integrační kontrakt, doplň ji i sem.
