# DEV přihlášení a hydratace – oddělené kontroly

Tyto vývojové kontroly byly odděleny od DST/UTC oprav v PR #85. Nezavádějí veřejný přihlašovací bypass ani zásah do produkčního rezervačního toku.

## DEV offline bootstrap

Pouze v prostředí development, pro vyhrazenou lokální či privátní databázi s názvem `ppstudio…_dev` nebo `ppstudio…_test`:

```sh
NODE_ENV=development PPSTUDIO_DEV_BOOTSTRAP=1 npm run admin:bootstrap-dev < /bezpecna/cesta/dev-heslo.txt
```

Skript vyžaduje heslo o délce alespoň 12 znaků a používá stdin, nikoliv CLI argument. Aktualizuje výhradně účet `dev-planner@example.test` s pevným ID; produkční runtime a databázi bez přípony DEV/TEST odmítne. Přihlášení dále prochází běžnými autentizačními kontrolami.

Unit testy ověřují omezení bootstrapu. E2E test přihlášení se spouští jen nad vyhrazenou lokální `*_test` databází; standardní GitHub Actions E2E používá `/ppstudio`, proto tento integrační scénář výslovně přeskočí, místo aby změnil bezpečnostní guard nebo modifikoval CI DB.

## Hydratace a caret-color

Playwright při screenshotu s `caret: "hide"` může dočasně nastavit `caret-color: transparent !important` na textových polích. Při zásahu před dokončením hydratace může tento externí zápis způsobit mismatch atributů. Bez původní auditní trace nelze potvrdit, že právě tento zásah způsobil původní varování.

E2E kontroluje veřejný formulář `/rezervace` a administrátorský login v čistém Chromium. Na veřejném formuláři nejdříve vybere službu; pole e-mailu se nezobrazuje v prvním kroku. Test ověřuje absenci hydration warningů a správný průchod klientským krokem, nikoli přítomnost e-mailového pole před výběrem termínu.

Produkční provoz ani historické údaje se nemění.
