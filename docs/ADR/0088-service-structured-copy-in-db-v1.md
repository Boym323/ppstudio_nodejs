# ADR 0088: Strukturovaná copy služeb v DB

## Kontext
- Veřejný web čte služby z databázového modelu `Service`, ale nové strukturované sekce detailu služby byly dočasně uložené v copy override vrstvě podle `slug`.
- Override měl přednost před adminem, takže pozdější editace textů v administraci se u známých slugů nemusela projevit na veřejném webu.
- Cíl je umožnit kompletní správu služby přes admin bez zásahu do kódu.

## Rozhodnutí
- Model `Service` rozšiřujeme o `seoTitle String?` a čtyři nativní PostgreSQL seznamy textů: `idealFor String[]`, `includes String[]`, `benefits String[]`, `goodToKnow String[]`.
- Pro seznamy volíme `String[] @default([])`, protože jde o homogenní plain-text body s jednoduchou serverovou validací a PostgreSQL/Prisma tento typ podporuje bez další serializační vrstvy.
- Admin služeb ukládá seznamy z textarea polí, kde každý neprázdný řádek je jedna položka.
- Veřejný web preferuje DB pole; `service-copy-overrides.ts` zůstává jen jako dočasný zdroj pro ruční backfill.

## Alternativy
- `Json` pole pro každou sekci: pružnější pro budoucí struktury, ale zbytečně slabší typování pro aktuální seznam plain-text bodů.
- Trvalá copy override vrstva podle `slug`: rychlá bez migrace, ale obchází admin a znemožňuje spolehlivou editaci obsahu v DB.

## Důsledky
- Novou službu lze kompletně vyplnit přes admin a zobrazit na `/sluzby`, detailu služby, v ceníku, rezervaci a sitemapě bez úpravy kódu.
- Produkční nasazení vyžaduje DB migraci a jednorázový backfill strukturovaných polí.
- Starší pole `publicIntro`, `description`, `pricingShortDescription` a `seoDescription` zůstávají zachovaná a dál se upravují přes admin.

## Stav
- schváleno
