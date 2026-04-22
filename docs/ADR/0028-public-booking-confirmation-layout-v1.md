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
  - hlavní přehled se službou, termínem, časem a referenčním kódem
  - krátký blok `Co bude následovat`
  - akční sekci oddělenou od textu
  - kontaktní blok až pod hlavním obsahem
- Veřejný booking payload se rozšíří o `scheduledStartsAt`, `scheduledEndsAt` a `cancellationUrl`, aby confirmation vrstva mohla skládat CTA bez dalšího dohledávání.
- Primární webová akce bude `Přidat do kalendáře` přes klientsky generovaný `.ics` soubor.
- Secondary CTA `Požádat o změnu` bude zatím realizované přes předvyplněný kontakt do studia; struktura i umístění ale počítají s budoucím napojením na samostatný self-service endpoint.
- Destruktivní akce `Zrušit rezervaci` zůstává viditelná, ale nesmí být dominantnější než ostatní kroky.

## Důsledky

### Pozitivní
- uživatelka do několika vteřin pochopí stav rezervace i přesný termín
- confirmation screen nepůsobí jako zbytkový e-mailový card, ale jako skutečný stavový krok
- CTA jsou jasně oddělené od informací a lépe připravují budoucí self-service správu rezervace
- e-mail i web mluví stejnou hierarchií, což zvyšuje důvěryhodnost celého flow

### Negativní
- confirmation vrstva má víc prezentační logiky a samostatnou komponentu navíc
- `.ics` export přidává trochu klientské logiky do jinak převážně server-first booking flow
- secondary CTA je zatím jen dočasný most přes `mailto:` a vyžaduje pozdější napojení na plnohodnotný manage/reschedule backend

## Alternativy
- Zachovat stávající souhrnný card a upravit jen copy: zamítnuto, protože problém byl v hierarchii a informačním toku, ne jen ve wording změnách.
- Udělat hlavní CTA storno a ostatní akce schovat pod text: zamítnuto, protože confirmation screen má podporovat další krok, ne zdůrazňovat zrušení.
- Přidat pro `Přidat do kalendáře` nový veřejný route handler: zatím zamítnuto, protože klientský `.ics` export řeší potřebu bez rozšíření veřejného API.
