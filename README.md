# PPStudio

Next.js projekt připravený pro vývoj webové aplikace.

## Rychlý start

```bash
npm install
npm run dev
```

Aplikace běží na `http://localhost:3000`.

## Skripty

- `npm run dev` - vývojový server
- `npm run build` - produkční build
- `npm run start` - spuštění buildu
- `npm run lint` - linting

## Povinná dokumentace během vývoje

Při každé významné změně udržuj aktuální:

- `MANUAL.md` - průběžný provozní a uživatelský manuál
- `CHANGELOG.md` - chronologický seznam změn
- `docs/DEVELOPMENT.md` - podrobná technická dokumentace
- `docs/ADR/` - architektonická rozhodnutí (ADR)
- `docs/ENVIRONMENT.md` - proměnné prostředí
- `docs/DEPLOYMENT.md` - nasazení a rollback
- `docs/INCIDENTS.md` - produkční incidenty
- `docs/DEPENDENCIES.md` - důležité knihovny

Doporučení:
- Každý větší PR by měl obsahovat i aktualizaci dokumentace.
- Změny v nasazení nebo konfiguraci vždy zapisuj do manuálu.

## Pravidlo pro commit zprávy

- Commit message píš česky.
- Pro jednotný styl je nastavená lokální šablona `.gitmessage-cz.txt`.
