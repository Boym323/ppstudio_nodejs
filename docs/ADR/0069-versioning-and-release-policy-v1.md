# ADR 0069: Versioning and Release Policy v1

## Kontext
- Projekt používá `package.json` metadata `name` a `version`, ale pravidla pro změny verze nebyla explicitně zapsaná na jednom místě.
- Tým potřebuje jednotné rozhodování, kdy zvedat `PATCH`, `MINOR` a `MAJOR`, aby release komunikace byla předvídatelná.

## Rozhodnutí
- Zavádíme jednotnou politiku verzování podle SemVer `MAJOR.MINOR.PATCH`.
- Pravidla:
  - `PATCH`: opravy chyb a interní změny bez změny veřejného kontraktu.
  - `MINOR`: zpětně kompatibilní rozšíření funkcí.
  - `MAJOR`: nekompatibilní změny kontraktu (API, data, route nebo provozní workflow).
- Každá významná změna musí mít záznam v `CHANGELOG.md` sekci `Unreleased`.
- Release commit musí obsahovat atomicky finální bump verze a odpovídající release poznámky.

## Alternativy
- Verzi neměnit podle pravidel a řešit ji ad hoc.
- Udržovat pravidla pouze ústně bez dokumentace.

## Důsledky
- Vyšší konzistence release procesu.
- Snazší orientace v dopadu změn pro vývoj i provoz.
- Mírně vyšší disciplína při správě changelogu před release.

## Stav
- schváleno
