# 0056 Client Email Optional For Manual Booking

## Kontext

Ruční rezervace v adminu vzniká i z offline nebo sociálních kanálů, typicky z Instagramu nebo telefonu. Dosavadní model vyžadoval e-mail klientky vždy, což nutilo provoz vymýšlet zástupné adresy nebo rezervaci nezapsat hned.

## Rozhodnutí

- `Client.email` je v Prisma schématu nově volitelný (`String? @unique`).
- Veřejný booking flow dál e-mail vyžaduje; uvolnění se týká pouze ruční rezervace v adminu.
- Shared booking engine umí založit nebo aktualizovat klientku i bez e-mailu.
- Když ruční rezervace nemá e-mail, klientský potvrzovací e-mail se přeskočí a booking zůstane uložený bez chyby.
- Admin UI má u takové klientky zobrazovat čitelný fallback `Bez e-mailu` místo prázdného kontaktu nebo neplatného `mailto:` odkazu.

## Alternativy

- Ponechat povinný e-mail a ukládat zástupné adresy. To by znečistilo data a komplikovalo pozdější kontakt i deduplikaci.
- Ukládat prázdný string do povinného unikátního pole. To by fungovalo jen pro jednu klientku a rozbilo by další ruční rezervace bez e-mailu.
- Zavést zvláštní model pro offline lead bez klientského profilu. To by zbytečně štěpilo booking doménu a zhoršilo návaznost historie.

## Důsledky

- Produkce vyžaduje migraci `20260426123000_client_email_nullable_for_manual_booking`.
- V adminu je potřeba počítat s tím, že ne každá klientka má e-mail; kontaktní akce musí zůstávat podmíněné.
- Reminder, self-service odkazy i klientské e-maily se dál opírají o `Booking.clientEmailSnapshot`; pokud je prázdný, e-mailové workflow se přeskočí.

## Stav

schváleno
