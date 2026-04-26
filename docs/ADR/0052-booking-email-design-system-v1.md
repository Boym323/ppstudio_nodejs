# 0052 Booking Email Design System v1

## Kontext

Booking e-maily postupně vznikaly podle konkrétních flow: přijetí rezervace, finální potvrzení, reminder, přesun, storno a provozní admin notifikace. Výsledek byl funkční, ale šablony měly rozdílnou vizuální hierarchii, opakované kontaktní věty a místy silnější CTA, než odpovídalo klidnému tónu PP Studia.

## Rozhodnutí

V `src/lib/email/templates.ts` používáme jeden konzervativní email design systém:

- 600px shell s inline styly a prezentačními tabulkami.
- Jednotné klientské bloky `Služba / Datum / Čas`, `Místo`, `Kontakt` a decentní patička.
- Pevné místo pro klientské e-maily: `PP Studio`, `Sadová 2, 760 01 Zlín`, včetně bezpečného Google Maps fallback odkazu.
- Jeden kontaktní blok: `Napište nám: info@ppstudio.cz` a `Zavolejte: +420 732 856 036`.
- Časový rozsah ve formátu `09:30 – 10:30`.
- Klientské změny a storna jako secondary nebo textové akce; admin notifikace má jedinou primary akci `Potvrdit rezervaci`.

Šablony dál nesmí měnit email worker, queue logiku, booking flow, stavový model, token generation, API endpointy ani ICS přílohy.

## Alternativy

- Nechat každou šablonu samostatně laděnou. To by rychle vrátilo duplicity v copy a rozdílnou CTA hierarchii.
- Přidat email framework nebo templating knihovnu. Pro současný rozsah by to zvýšilo závislostní povrch bez jasného přínosu.
- Přepsat e-maily do modernějšího CSS layoutu. To by zhoršilo kompatibilitu s Outlookem a staršími e-mail klienty.

## Důsledky

Další booking e-maily mají používat sdílené helpery v rendereru. Při úpravách je nutné ověřit text/plain i HTML variantu, mobilní čitelnost, jednorázový kontakt, nedominantní destruktivní akce a zachování `.ics` přílohy u `booking-approved-v1` a `booking-rescheduled-v1`.

## Stav

schváleno
