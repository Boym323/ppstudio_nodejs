# ADR 0105: GitHub Quality and Security Automation v1

## Stav
Accepted

## Kontext
- Projekt už měl jeden hlavní CI workflow pro lint, aplikační testy, build a Playwright E2E, ale chyběla část kontrol, které GitHub nativně podporuje pro dlouhodobou kvalitu a bezpečnost.
- V repu existoval `npm run test:coverage`, ale coverage report se v GitHub Actions nespouštěl ani neukládal jako artifact.
- TypeScript kontrola nebyla v CI explicitně oddělená, takže část typových regresí mohla být vidět až při buildu nebo lokálně.
- Bezpečnostní vrstva chyběla hlavně ve třech oblastech:
  - statická bezpečnostní analýza kódu
  - dependency diff review na PR
  - průběžné audity závislostí a automatické update PR

## Rozhodnutí
- Rozšířit hlavní CI workflow o:
  - `npm run typecheck`
  - `npm run test:coverage`
  - upload `coverage/` a `playwright-report/` jako GitHub artifactů
- Přidat samostatný workflow `CodeQL` pro `javascript-typescript`.
- Přidat PR workflow `Dependency Review` s fail-on `high`.
- Přidat samostatný scheduled `npm audit --audit-level=high`.
- Zapnout repo-level automatizaci aktualizací přes `.github/dependabot.yml` pro:
  - `npm`
  - `github-actions`

## Důsledky
- Pull requesty dostanou dřívější signál o type regresích, coverage výstupech a rizikových dependency změnách.
- Tým má v GitHubu dostupné HTML/LCOV artifacty bez ručního lokálního generování.
- Security signály budou přibývat průběžně i mimo běžné feature PR díky CodeQL, Dependabotu a scheduled auditu.
- Branch protection a required status checks zůstávají repo-level nastavení mimo git; po merge je potřeba je ručně sladit s novými workflow názvy.
