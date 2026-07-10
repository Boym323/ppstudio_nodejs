# ADR 0110: Jednotková kapacita AvailabilitySlotu

## Stav

schváleno

## Kontext

Administrace zakládá sloty s kapacitou `1` a salon obsluhuje jedna osoba. Databázový constraint však dříve vynucoval jen kladnou hodnotu a booking engine četl skutečnou kapacitu slotu. Import, ruční SQL nebo historická data tak mohly povolit dvě souběžné rezervace.

## Rozhodnutí

- `AvailabilitySlot.capacity` je pevný business invariant `1`, nikoliv model více zdrojů.
- Migrace před změnou constraintu fail-fast zkontroluje odchylky a data automaticky nemění.
- Constraint `AvailabilitySlot_capacity_one` vynucuje `CHECK ("capacity" = 1)`.
- Booking engine pro obranu před ještě nenasazenou migrací také vždy připouští pouze jednu aktivní rezervaci.

## Alternativy

- Zachovat vícekapacitu: zamítnuto; vyžadovalo by explicitní model personálu či jiných zdrojů a jejich konfliktů.
- Hromadně snížit existující hodnoty při migraci: zamítnuto; mohlo by skrýt souběžné bookingy, které potřebují provozní rozhodnutí.

## Důsledky

- Importy a ruční zásahy nesmí zapisovat jinou kapacitu.
- Při budoucím provozu s více osobami je nutný nový doménový model a nové ADR, ne oslabení tohoto constraintu.
