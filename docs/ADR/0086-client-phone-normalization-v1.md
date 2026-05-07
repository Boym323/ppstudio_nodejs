# ADR 0086: Normalizace telefonu klientky

## Kontext
- Ve veřejné rezervaci je telefon volitelný a klientky ho zadávají přirozeně s mezerami, českým lokálním tvarem nebo mezinárodní předvolbou.
- CRM párování klientek a admin vyhledávání potřebují jednotný uložený tvar bez mezer.

## Rozhodnutí
- Telefon normalizujeme ve sdíleném helperu `src/features/booking/lib/client-phone.ts`.
- Prázdný telefon zůstává povolený.
- České 9místné číslo bez předvolby ukládáme jako `+420...`.
- Prefix `00` převádíme na `+` a explicitní `+` předvolbu respektujeme.
- Po normalizaci musí telefon odpovídat tvaru `+` a 8 až 15 číslic.
- Raw vstup smí obsahovat jen číslice, mezery, pomlčky a úvodní `+`; text ani HTML se nesmí potichu odfiltrovat na platné číslo.

## Alternativy
- Přidat externí phone parsing knihovnu. Zamítnuto, protože požadovaná pravidla jsou úzká a stávající helpery stačí.
- Měnit Prisma schema. Zamítnuto, protože `Client.phone` i `Booking.clientPhoneSnapshot` už ukládají string a změna typu není nutná.

## Důsledky
- `Client.phone` a `Booking.clientPhoneSnapshot` mají jednotný mezinárodní tvar, například `+420777123456`.
- Admin zobrazuje normalizovaná čísla čitelně, například `+420 777 123 456`, ale `tel:` odkazy používají normalizovanou hodnotu.
- Historická data v jiném formátu se nemigrují; helper pro zobrazení se je snaží číst bezpečně.

## Stav
- schváleno
