# ADR 0112: Explicitní Turbopack root pro verzované releasy

## Kontext

Release helper vytváří staging checkout v `releases/.staging.*`, který obsahuje vlastní `package-lock.json`. Automatická detekce Turbopacku pak při `next build` viděla lockfile hlavního checkoutu i staging releasu a vypisovala varování o nejednoznačném workspace rootu.

## Rozhodnutí

- `next.config.ts` explicitně nastavuje `turbopack.root` na `path.resolve(__dirname)`.
- Root je relativní k aktuálnímu configu, nikoli pevná cesta `/var/www/ppstudio`, aby stejná konfigurace fungovala v hlavním checkoutu, staging adresáři i verzovaném release.

## Alternativy

- Mazat staging `package-lock.json`: zamítnuto, protože lockfile je nutný pro deterministické `npm ci` a je součástí plného release artefaktu.
- Ignorovat warning: zamítnuto, protože skrývá skutečné problémy s workspace resolucí a zbytečně znepřehledňuje produkční build log.
- Nastavit root na rodičovský adresář releasů: zamítnuto, protože by rozšířilo filesystem watching na všechny historické releasy.

## Důsledky

- Turbopack řeší moduly i cache pouze uvnitř aktivního checkoutu/release.
- Produkční staging build nehlásí falešný konflikt lockfileů.
- Konfigurace nepřidává env proměnnou ani externí závislost.

## Stav

Schváleno.
