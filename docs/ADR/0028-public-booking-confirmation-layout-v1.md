# ADR 0028: Confirmation flow veřejné rezervace jako samostatný stavový layout

## Stav
schváleno

## Kontext
Veřejný booking flow už po submitu korektně vytvářel rezervaci ve stavu `PENDING`, připravil storno token a odesílal potvrzovací e-mail. Poslední krok ale v UI i v e-mailu pořád působil spíš jako dlouhý tmavý card se souhrnným textem:

- stav rezervace nebyl dost oddělený od ostatních informací
- termín nebyl vizuálně dominantní, přestože je to nejdůležitější údaj
- akce byly slabé a prakticky se soustředily jen na storno
- kontakt byl schovaný ve spodním textu místo jasného podpůrného bloku
- web confirmation screen a e-mail měly podobný tón, ale ne dostatečně konzistentní hierarchii

Nešlo o změnu business logiky rezervace, ale o přepracování informačního toku bez zásahu do provozního modelu `Booking`.

## Rozhodnutí
- Success stav veřejné rezervace už nebude pokračováním souhrnu, ale samostatným confirmation layoutem.
- Web confirmation screen i potvrzovací e-mail budou používat stejnou obsahovou hierarchii:
  - status blok nahoře
  - hlavní přehled se službou, termínem a časem
  - krátký blok `Co bude následovat`
  - uklidňující informaci bez další akce
  - kontaktní blok až pod hlavním obsahem
- Veřejný booking payload obsahuje `scheduledStartsAt`, `scheduledEndsAt` a tokenové odkazy, ale post-submit confirmation vrstva je nepoužívá jako CTA.
- Pozdější aktualizace rozhodla, že post-submit screen nemá nabízet žádné manage/cancel CTA; změna a storno patří do e-mailu nebo detailu rezervace.

## Aktualizace 2026-04-26
- Webový success screen drží headline `Rezervace přijata`, ale doprovodné copy jasně říká, že termín je předběžně rezervovaný a čeká na finální potvrzení.
- Badge používá lidštější stav `Čeká na finální potvrzení`; blok `Co bude následovat` stručně říká, že potvrzení přijde e-mailem.
- Akční sekce `Potřebujete změnu?` byla odstraněná včetně CTA `Změnit termín` a `Zrušit rezervaci`; success screen má působit jako potvrzení a uzavření flow.
- Pod blokem `Co bude následovat` je krátké uklidnění, že termín je nyní rezervovaný a klientka nemusí dělat další kroky.
- Referenční kód se na confirmation screenu nezobrazuje, protože booking model nemá samostatný klientsky používaný reference-code atribut; interní `bookingId` se klientce neukazuje.
- Matomo event `Booking / Created` zůstává v `BookingFlow` po success submitu a je chráněný `createdBookingTrackedRef`, takže confirmation panel neposílá další duplicitní event.

## Důsledky

### Pozitivní
- uživatelka do několika vteřin pochopí stav rezervace i přesný termín
- confirmation screen nepůsobí jako zbytkový e-mailový card, ale jako skutečný stavový krok
- odstranění manage/cancel CTA snižuje nejistotu po odeslání rezervace
- e-mail i web mluví stejnou hierarchií, což zvyšuje důvěryhodnost celého flow

### Negativní
- confirmation vrstva má víc prezentační logiky a samostatnou komponentu navíc
- `.ics` export přidává trochu klientské logiky do jinak převážně server-first booking flow
- secondary CTA je zatím jen dočasný most přes `mailto:` a vyžaduje pozdější napojení na plnohodnotný manage/reschedule backend

## Alternativy
- Zachovat stávající souhrnný card a upravit jen copy: zamítnuto, protože problém byl v hierarchii a informačním toku, ne jen ve wording změnách.
- Udělat hlavní CTA storno a ostatní akce schovat pod text: zamítnuto, protože confirmation screen má podporovat další krok, ne zdůrazňovat zrušení.
- Vrátit kalendářovou akci na pending screen: zamítnuto, protože `.ics` příloha patří až do e-mailu po přechodu rezervace do `CONFIRMED`.
- Ponechat `Změnit termín` a `Zrušit rezervaci` přímo po submitu: zamítnuto, protože obrazovka má rezervaci uzavřít, ne vyvolávat další rozhodování.
