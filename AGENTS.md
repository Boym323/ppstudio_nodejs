<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

For Media Library work, read docs/architecture/media.md.

Automaticky generovaný blok Next.js výše neupravuj ručně. Jeho požadavek na ověření relevantní dokumentace v `node_modules/next/dist/docs/` platí i pro běžné úpravy kódu; čti pouze konkrétní potřebný oddíl, ne celou dokumentaci. Již ověřený oddíl v rámci stejného úkolu znovu neprocházej bez důvodu.

## Práce s kontextem a rozsahem

- Neprocházej celý repozitář, pokud to není výslovně požadováno.
- Začni cíleným vyhledáváním podle názvu souboru, komponenty, funkce, route nebo chybové hlášky.
- Čti pouze soubory potřebné pro aktuální úkol; neotvírej automaticky související soubory, nejsou-li relevantní.
- Neopakuj stejné čtení souborů ani stejné příkazy bez důvodu.
- Standardně ignoruj `node_modules/`, `.next/`, `coverage/`, `dist/`, `build/`, `playwright-report/`, `test-results/`, logy, cache a generované soubory. Čti je pouze při přímé relevanci k problému.
- Prováděj pouze změny nutné pro zadaný úkol. Nedělej plošný refaktor, cleanup ani audit mimo rozsah.
- Neměň závislosti, databázové schéma, veřejné API ani architekturu bez jasného důvodu.
- Zachovej existující styl, strukturu a zavedené vzory projektu. Nevytvářej nové abstrakce pro jednorázové použití.

## Vývojové větve a pull requesty

- Standardní implementační změny připravuj na samostatné větvi založené z aktuálního `main`; do `main` necommituj přímo, pokud to uživatel výslovně nepožaduje. Před zahájením zkontroluj aktuální větev a nezasahuj do rozpracovaných nesouvisejících změn.
- V pull requestu stručně popiš účel, dotčené části, provedené kontroly, případné netestované scénáře a dopad na databázi, e-maily či nasazení. U produkční změny přidej odpovídající bod `CHANGELOG.md` / `Unreleased`, pokud pravidla níže neurčují výjimku.
- Před odevzdáním ověř diff (včetně `git diff --check`) a stav CI na přesném commitu PR. Selhání relevantní CI kontroly neopomíjej; oprav příčinu nebo jasně uveď blokující stav. Přechodně zelený či rozpracovaný běh neoznačuj za úspěšný.
- PR neslučuj a produkci nenasazuj bez výslovného pokynu. Příprava větve, commitu nebo PR není povolením k nasazení.

## Bezpečnost prostředí, dat a oprávnění

- Vývoj, testy, staging a produkce jsou oddělená prostředí. Před příkazem, který může číst či měnit databázi, storage nebo posílat zprávy, ověř cílové připojení a režim. Lokální a CI integrační/E2E testy směřuj výhradně na izolovanou testovací databázi; nikdy na produkční `.env` nebo produkční PostgreSQL.
- Pro běžný vývoj nepouštěj nad produkcí `prisma migrate dev`, `prisma db push`, reset/seed/cleanup skripty ani zkouškové rezervace nebo hromadné operace. Produkční migrace spouštěj jen v předepsaném release postupu, po kontrole dopadů a na výslovný pokyn k nasazení.
- Datové migrace, mazání, zpětné doplňování a nevratné akce vyžadují cílený návrh, kontrolu kompatibility se stávajícími daty a jasný plán obnovy. Žádné zkracování bezpečnostních kontrol kvůli rychlejšímu deployi.
- Nikdy nezapisuj tajné klíče, hesla, tokeny, neveřejné URL ani skutečné osobní údaje klientů do kódu, commitu, testovacích fixture, logu, analytiky, screenshotů nebo popisu PR. Používej syntetická data a redigované výstupy.
- Při změnách adminu, rezervací, voucherů a veřejných tokenových odkazů zachovej serverové ověření oprávnění, minimalizaci osobních údajů a ochranu proti úniku tokenů v URL, logování, analytice i chybových hláškách. UI kontrola nenahrazuje serverovou autorizaci.
- Neměň chování odesílání reálných e-mailů, notifikací a externích integrací při lokálním testu; používej testovací transport nebo vypnuté doručování podle konfigurace projektu.

## Documentation Policy

Relevantní dokumentaci aktualizuj pouze tehdy, když ji změna přímo ovlivňuje. Nečti ani neupravuj nesouvisející dokumenty. Drobné opravy textu, stylů a lokální implementační detaily nevyžadují automatickou dokumentaci. Nové ADR vytvářej pouze při skutečném architektonickém rozhodnutí.

Dokumentace projektu (vybírej pouze relevantní soubory, nejde o povinný seznam k načtení):
- `ARCHITECTURE.md`
- `BOOKING_FLOW.md`
- `docs/BOOKING_FORM.md` (veřejný formulář, validace, refresh katalogu)
- `docs/AVAILABILITY_PLANNER.md` (admin dostupnost, autosave, propojení s rezervací)
- `DEPLOYMENT.md`
- `ENVIRONMENT.md`
- `MANUAL.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `TROUBLESHOOTING.md`
- `docs/DEVELOPMENT.md`
- `docs/API.md`
- `docs/CODEX_RULES.md` (doplňkový odkaz na tato pravidla)
- `docs/ADR/*`
- `docs/ENVIRONMENT.md`
- `docs/DEPLOYMENT.md`
- `docs/INCIDENTS.md`
- `docs/DEPENDENCIES.md`
- `docs/architecture/media.md` (pravidla knihovny médií)
- `docs/CLIENT_MERGE.md` (slučování klientů)
- `docs/REACT_EMAIL_MIGRATION.md` (e-mailové šablony a integrace)

## Příprava release verze

- Při pokynu k přípravě verze pro nasazení nejdřív cíleně přečti politiku SemVer, začátek `CHANGELOG.md` a commity od posledního version commitu; neprohledávej kvůli tomu celý repozitář ani celou dokumentaci.
- Typ bumpu urči podle SemVer: `PATCH` pro opravy a interní změny, `MINOR` pro zpětně kompatibilní rozšíření, `MAJOR` pro nekompatibilní změny kontraktu nebo provozního workflow.
- Atomicky aktualizuj `package.json`, kořenový záznam v `package-lock.json`, finální release sekci v `CHANGELOG.md` a pouze dokumenty či ukázky, které uvádějí aktuální aplikační verzi.
- Při čistě mechanickém bumpu verze a release poznámek nespouštěj testy ani `typecheck`; ověř pouze konzistenci verzí a diff. Pokud release zahrnuje dosud neověřené změny zdrojového kódu nebo konfigurace, spusť nejmenší příslušnou kontrolu. Plné `test` a `e2e` nespouštěj bez výslovného požadavku; před skutečným nasazením musí projít jako CI brána pro výsledný commit.
- Příprava verze sama o sobě neznamená deploy, commit ani push; tyto kroky proveď jen na výslovný pokyn.

## Průběžná správa changelogu

- Každá významná změna produkčního chování musí ve stejné implementační změně aktualizovat `CHANGELOG.md` v sekci `Unreleased`; nečeká se na přípravu releasu.
- Významnou změnou je zejména nová produkční funkce, oprava chyby ovlivňující uživatele nebo data, změna business logiky, administračního či veřejného rezervačního workflow, routingu, oprávnění, API, databázová migrace, bezpečnostní oprava, změna deploymentu nebo provozního chování, odstranění produkční funkce a významná změna závislosti s dopadem na aplikaci.
- Changelog obvykle nevyžadují čisté testy, překlepy v dokumentaci, formátování, komentáře, snapshoty k již popsané změně, odstranění mrtvého kódu ani interní refaktor bez změny chování. Má-li interní změna dopad na bezpečnost, stabilitu, data nebo provoz, záznam vyžaduje i přesto.
- Záznam popisuje dopad na uživatele nebo provoz, ne seznam technických souborů. Jeden významný celek má jeden stručný bod; duplicitní či překrývající se body sjednoť.
- Používej stávající kategorie `Přidáno`, `Změněno`, `Opraveno`, `Odstraněno` a `Zabezpečení`; nevytvářej prázdné kategorie.
- Při přípravě releasu přesuň obsah `Unreleased` pod novou verzovanou sekci s datem a po vydání ponech novou prázdnou sekci `Unreleased`. Historické verzované sekce neměň, s výjimkou prokazatelné faktické chyby.
- Novou verzi ani `package.json` neměň pouze kvůli doplnění `Unreleased`.
- Pro produkční změny spusť `npm run changelog:check -- --base <základní-commit-nebo-větev>`. Výjimka je možná pouze v pull requestu s labelem `skip-changelog` a řádkem `Důvod pro skip-changelog: <konkrétní důvod>` v popisu; slouží jen například pro refaktor bez změny chování, opravu typů, přesun souborů nebo zlepšení testovatelnosti, nikdy běžně pro funkce, opravy chyb, migrace ani změny workflow.

## Kontroly a testy

- Spusť pouze nejmenší relevantní kontrolu pro změněnou oblast.
- Nespouštěj automaticky celý produkční build ani celý Playwright/E2E test suite.
- Celý build nebo kompletní testy spusť pouze při široké změně, vysokém riziku nebo na výslovný požadavek.
- Neopakuj neúspěšný příkaz bez změny, která řeší příčinu chyby.
- Nespouštěj `npm install`, pokud se nemění závislosti nebo není instalace skutečně nutná.

## Regresní ochrana kritických toků

- Změny rezervací posuzuj napříč vytvořením, obnovením formuláře, dostupností termínů, změnou termínu a stornem. Zachovej časové pásmo `Europe/Prague` včetně CET/CEST, délky a blokace slotů, cenové snapshoty, validaci i konzistenci transakcí při souběžných požadavcích.
- Při zásahu do ukládání rezervací, transakcí nebo admin akcí ověř serverovou autorizaci, atomické změny a ochranu proti duplicitnímu provedení. K reprodukované chybě doplň regresní test přímo na úrovni, kde vznikla (unit, DB integrace nebo prohlížečové E2E); test samotného helperu nenahrazuje E2E, pokud je příčinou interakce UI.
- Při změnách e-mailového workeru a notifikací ověř stav fronty a doručení, retry, idempotenci a chování při selhání či timeoutu. Testy nesmějí odesílat skutečné klientské zprávy.
- Lokálně spusť nejmenší relevantní testy a popiš, co nepokrývají. Před sloučením musí projít požadované GitHub CI brány pro výsledný commit, zejména DB integrační testy a relevantní desktop/mobilní Playwright scénáře.

## Pracovní postup

1. Identifikuj nejpravděpodobnější soubory.
2. Přečti minimální potřebný kontext.
3. Proveď malou cílenou změnu.
4. Spusť relevantní kontrolu.
5. Na konci stručně vypiš změněné soubory, provedené kontroly a případná rizika.

## Commit Message Policy

- Všechny commit messages musí být česky.
- Používej stručné, významově přesné shrnutí zaměřené na záměr změny.
- Standardní technické termíny mohou zůstat anglicky (např. Next.js, API, build).
