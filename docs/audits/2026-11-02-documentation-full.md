# Úplný statický audit dokumentace PP Studio — 2. 11. 2026

## Výchozí stav a meze auditu
- Projekt: `Boym323/ppstudio_nodejs`, větev `codex/docs-main-reality-20261102` (PR #100) odvozená z `main` `47a0b949a8412e35e56b6886a304258bcdaab2db`.
- V kontrolovaném stromu: **1 259 souborů** včetně **154 Markdown souborů** (35 nečíslovaných/provozních a 119 číslovaných ADR). Šlo o **statický audit** proti obsahu GitHub repozitáře a vybraným kódovým souborům.
- Nebyly provedeny browserové kontroly nasazené produkce, přímé dotazy do produkční DB, vyhodnocení skutečných runtime secretů, ověření všech externích HTTP odkazů ani plná E2E sada. Nezaměňovat toto ověření za provozní akceptaci.

## Kontrolní matice

| Oblast | Výsledek a zdroj pravdy |
| --- | --- |
| Inventář | Projito všech 154 Markdown souborů, 119 ADR; rejstřík `docs/ADR/README.md` obsahuje každý číslovaný ADR soubor. |
| Markdown odkazy | Staticky kontrolované relativní cesty odkazů míří do existujících souborů/adresářů repozitáře; **0 zjištěných neplatných cest**. Kotvy a externí URL nebyly vyhodnoceny síťově. |
| Příkazy | Výskyty `npm run ...` v provozních dokumentech porovnány s `package.json.scripts`; **0 neznámých scriptů**. To nezaručuje úspěšné provedení v produkci. |
| Konfigurace | Všechny deklarované klíče v `.env.example` mají odpovídající položky v `docs/ENVIRONMENT.md` nebo `ENVIRONMENT.md`. Některé zvláštní release/test proměnné jsou dokumentované pouze v podrobné dokumentaci, záměrně ne v `.env.example`. |
| API a stránky | Hlavní endpointy uvedené v `docs/API.md` mají odpovídající `src/app/api/**/route.ts`; stránky uvedené v dokumentaci odpovídají veřejným routám či dynamickým `[section]` admin routám. |
| Verze | `package.json` a kořen `package-lock.json` odpovídají `3.38.3`; `next 16.4.3`, `react 19.3.1`, `prisma 7.10.1` souhlasí. Další přesné verze byly ověřeny jednotlivě a opraveny. |
| Planner a booking | Porovnány dokumenty s FullCalendar komponentou, serverovou akcí, časovými konstantami, `BookingFlow` a booking action. |
| ADR | Dva historicky duplicitní indexy (0026, 0090), bez chybějícího souboru v rejstříku. Dvanáct záznamů nemělo žádný explicitní status; dva další používaly nestandardní, ale existující `- Status:` / `- Stav:` formát. |

## Potvrzené nálezy a opravy
1. **Zastaralé aktuální návody k planneru** (střední závažnost): `MANUAL.md` a `docs/DEVELOPMENT.md` ještě ve dvou místech popisovaly odstraněný pravý inspektor, `MobileInspectorSheet` a sbalenou legendu v jeho detailu. Nahrazeno popisem jediné FullCalendar implementace s režimy úprav, FIFO autosave, mobilním denním pohledem a posuvem stránky.
2. **Neaktuální konkrétní závislosti** (střední závažnost): v `docs/DEPENDENCIES.md` zůstaly staré hodnoty Nodemailer (`^10.1.6 / 10.2.1`), React Email (`6.11.3`) a Playwright lockfile (`1.63.0`). Opraveno na `nodemailer ^10.3.1 / 10.3.1`, `react-email 6.11.6`, `@react-email/ui 6.11.6` a `@playwright/test ^1.63.0 / lockfile 1.64.1`. U FullCalendar doplněn lockfile `7.1.3`.
3. **ADR bez zaznamenaného stavu** (nízká až střední závažnost): u dvanácti historických souborů chyběl explicitní status. Protože původní schválení není v souboru doložené, byl doplněn neutrální historický stav; nebylo bez důkazu tvrzeno, že jde o dnes schválené rozhodnutí. Dvě další ADR už měla status pouze jako úvodní položku seznamu a nebylo třeba je měnit.
4. **Dědictví nahrazených implementací** (informativní): `CHANGELOG.md`, nahrazené `docs/ADR/0068-voucher-a4-print-pdf-v1.md` a historický `docs/CONFORM_AUDIT.md` mají odkazy/příklady ke starému kódu a starým verzím. Jde o explicitně historické zdroje; tyto záznamy se nemažou a nesmějí se prezentovat jako aktuální provozní návod.
5. **Číslování ADR** (informativní): `0026` a `0090` jsou duplicity vzniklé historicky. Zachovány kvůli stabilitě odkazů a Git historie; vždy používat úplnou cestu souboru.

## Kontrolované hranice nasazení a bezpečnosti
- `deploy/release.sh` a `docs/DEPLOYMENT.md`: release přes staging, systemd web/worker, health checky, cache a migrace; neproběhl skutečný produkční rollout.
- `docs/API.md`: read-only/liveness/diagnostics a tokenové/calendar endpointy; provozní kontrakty ověřit navíc smoke testem po nasazení.
- `docs/ENVIRONMENT.md`: konfigurace e-mailu, analytiky, voucherů, DB a release; žádné reálné tajné hodnoty nebyly načítány.
- `AGENTS.md`: čistě dokumentační změna nepotřebuje bump verze ani zásah do starých vydaných částí changelogu.

## Co audit nedokazuje
Statická existence souboru/routy/konfigurace nedokazuje funkčnost produkční DB, loginu, doručování e-mailu, voucher PDF, kalendářového feedu, provozních proxy pravidel ani skutečné rendering/SEO chování. Doporučené navazující ověření: CI pro výsledný commit, produkční smoke test, ruční QA s oběma rolemi a samostatný kontrolovaný bezpečnostní audit konfigurace serveru.

## Synchronizace po PR #101 — 2. 11. 2026

- PR #100 byl aktualizován na `main` commit `90389a54d30b529d9f35ab2e9559ea05726a1d03`, který obsahuje PR #101. Původní inventura a výsledky statické kontroly výše zůstávají historickým snímkem.
- Nová funkcionalita slučování klientů je doložena přímo v `src/features/admin/lib/client-merge.ts`, `client-merge-preview.ts`, `client-merge-actions.ts`, `client-contact-token-rotation.ts`, `src/lib/email/booking-preflight.ts`, `delivery.ts` a `resend-webhooks.ts`.
- Nový návod [`CLIENT_MERGE.md`](../CLIENT_MERGE.md) popisuje uživatelské oprávnění OWNER, 15minutový JWT náhledu, Serializable ochranu, auditní archivaci profilu, úpravy booking snapshotů a neodeslaných e-mailů a bezpečné hranice neprodukčního CLI.
- Návod ke sloučení v `MANUAL.md`, přidaný na `main` v PR #101, byl při merge zachován. `package.json` zůstává ve verzi `3.38.3`, nové změny jsou v `CHANGELOG.md` pod `Unreleased`.
- Integrační test runner vyžaduje `--experimental-test-module-mocks`, aby bezpečnostní testy nebyly tiše přeskočeny. Po každém novém dokumentačním commitu znovu vyhodnoť CI a diff vůči `main`.
- Ověřeny byly kódové kontrakty a Git historie, nikoli produkční databáze, skutečné doručování e-mailů nebo běžící server.

## Údržba
- Každý nový provozní postup musí být ověřen proti aktuálnímu zdrojovému kódu, nikoli vyvozen z historických ADR nebo changelogu.
- Pokud se mění závislosti, synchronizovat `docs/DEPENDENCIES.md` podle **manifestu i resolved verze v lockfilu**.
- U nových ADR povinně zaznamenat stav; u starých bez původního statusu ponechat označení `neuvedeno v původním záznamu`, dokud není doložené schválení/nahrazení.
