# Audit cenových snapshotů rezervací – 5. 11. 2026

> **Závěr: bez nutnosti opravy (bod 2 přednasazovacího code review uzavřen).** Tento dokument zachycuje ověření k uvedenému datu, nikoli trvalou databázovou záruku. Při pozdější změně importů, tvorby rezervací nebo cenových polí ověř předpoklad znovu.

## Kontext

- Porovnání kódu před nasazením: poslední nasazená revize `0bca28181424c5a216e584219ace6294d4525349` proti `main` na revizi `f7ec3d0e41ec4715e8a8343e9e622529a45e4dd6` (31 commitů).
- Původní auditní připomínka: v `src/features/admin/lib/admin-clients.ts` je záložní čtení aktuálního ceníku služby, pokud v rezervaci chybí cenový snapshot. Bez snapshotu by změna ceníku mohla přepočítat historickou tržbu.
- Uživatelem doložené ověření přímo nad produkční PostgreSQL databází `ppstudio`, schéma `public`, dne 5. 11. 2026.

## Reprodukovatelný read-only dotaz a výsledek

```sql
SELECT COUNT(*) AS rezervace_bez_ceny
FROM "Booking"
WHERE "status" = 'COMPLETED'
  AND "finalPriceCzk" IS NULL
  AND "servicePriceFromCzk" IS NULL;
```

**Výsledek doložený screenshotem uživatele: `rezervace_bez_ceny = 0`.**

Výklad: ke dni ověření **žádná dokončená rezervace** neměla obě cenová pole `NULL`. Nejde o ověření všech stavů rezervací a nejde o databázový constraint; obě pole jsou v `prisma/schema.prisma` definována jako volitelná (`Int?`).

## Rozhodnutí pro audit a budoucí review

- `admin-clients.ts` používá `COALESCE(booking."finalPriceCzk", booking."servicePriceFromCzk", service."priceFromCzk", 0)`. Pro tehdejší dokončené rezervace se proto fallback na aktuální `Service.priceFromCzk` **neaktivuje**.
- **Neotvírat znovu požadavek na opravu historických tržeb pouze kvůli této hypotetické možnosti.** Není důvod měnit kód, databázové schéma ani zpětně rekonstruovat ceny na základě tohoto zjištění.
- Fallback zůstává defenzivní ochranou pro případ budoucích neúplných či importovaných dat; není sám o sobě důkazem chybného výpočtu a není třeba jej nyní odstraňovat.
- Znovu prověřit jen při konkrétním incidentu s cenami, změně zapisování snapshotů / importu historických rezervací nebo pokud read-only dotaz začne vracet nenulový počet. Pro ověření všech stavů připrav samostatný dotaz, neslučuj jej s tímto doloženým výsledkem.

**Rozsah:** pouze bod 2 code review. Ostatní auditní body (obnova rozpracované rezervace, test režimu e-mailového workeru `background`) tím nejsou vyřešeny.
