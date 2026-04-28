# ADR 0058: Voucher server domain v1

## Kontext
- Databázový základ voucherů už existuje v modelech `Voucher`, `VoucherRedemption` a intent polích na `Booking`.
- Voucher systém zatím nemá mít UI, PDF ani změnu veřejného booking flow.
- Čerpání voucheru je provozní admin akce, zatímco veřejná rezervace smí voucher pouze bezpečně ověřit pro budoucí intent.

## Rozhodnutí
- Serverová doména voucherů je v `src/features/vouchers` rozdělená na kód voucheru, formátování, Zod schémata, veřejnou validaci, admin čerpání a read modely.
- Mutační doménové helpery pro tvorbu/validaci/uplatnění jsou v `src/features/vouchers/lib/voucher-management.ts`, ne v `"use server"` modulu. Veřejně volatelné Server Actions smí vznikat až v admin vrstvě, kde se znovu ověřuje role.
- Kódy mají tvar `PP-YYYY-XXXXXX`, používají nematoucí uppercase znaky a před zápisem ověřují unikátnost v DB.
- Efektivní stav voucheru se počítá aplikačně: aktivní nebo částečně čerpaný voucher po `validUntil` se vrací jako `EXPIRED`, ale DB status se automaticky nepřepisuje.
- Veřejná validace vrací jen bezpečný výsledek bez údajů o kupující, příjemci, interní poznámce nebo historii čerpání.
- Admin čerpání běží v Prisma transakci; pro hodnotové vouchery používá row lock a podmíněný update zůstatku, aby se snížilo riziko dvojího souběžného odečtu.

## Alternativy
- Odečítat voucher už ve veřejném bookingu: zamítnuto, protože veřejný booking má zatím ukládat pouze záměr.
- Přepisovat expirované statusy při každé validaci: zamítnuto, protože by read operace měnily databázi a komplikovaly audit.
- Řešit souběh jen čtením a následným update: zamítnuto pro hodnotové vouchery, kde je potřeba chránit zůstatek i při paralelních admin akcích.

## Důsledky
- Budoucí UI může používat existující serverové funkce bez zavádění další business logiky do komponent.
- Public booking flow může později uložit `intendedVoucherId` až po volání bezpečné validační funkce.
- Doménové testy pokrývají tvorbu, validaci a čerpání voucherů nad reálným Prisma wiringem.

## Stav
- schváleno
