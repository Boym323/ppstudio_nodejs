# ADR 0025: Veřejný booking flow V2 pro rychlejší dokončení rezervace

## Stav
schváleno

## Kontext
První produkční booking flow už používalo reálný katalog služeb, konkrétní starty po 30 minutách a bezpečný server-side submit. Z pohledu UX ale pořád naráželo na několik třecích míst:

- seznam služeb byl jeden dlouhý blok bez mezikroku, takže uživatelka musela dělat příliš velké rozhodnutí najednou
- krok s termínem začínal kalendářem, i když nejčastější chování je vzít nejbližší volný čas
- grid časů byl záměrně kompaktní, ale na mobilu a při rychlém rozhodování působil příliš hustě
- kontaktní krok čekal až na server-side validaci, takže uživatelka dostala část zpětné vazby pozdě
- souhrn byl čitelný, ale neuměl pohodlnou editaci jednotlivých bloků bez návratu přes předchozí flow

Business logika rezervace, ochrany proti kolizi, délkové filtrování slotů, rate limit i zápis do `Booking` už byly správně na serveru a nebyl důvod je měnit.

## Rozhodnutí
- Veřejný booking flow zůstává jeden klientský wizard nad stejným server action `createPublicBookingAction`.
- Krok 1 se rozděluje na dvoustupňové rozhodnutí:
  - nejprve výběr kategorie přes `CategorySelect`
  - následně výběr konkrétní služby v rámci vybrané kategorie
- Po výběru služby flow automaticky scrolluje na krok s termínem.
- Krok 2 nově začíná blokem `SuggestedSlots`, který ukazuje nejbližší dostupné časy napříč kalendářem a umožňuje přechod na kontakt jedním klikem.
- Kalendář zůstává zachovaný jako sekundární fallback pro uživatelku, která chce jiný den než nejbližší nabídku.
- Grid časů používá větší klikací plochy a nižší hustotu na řádek.
- Krok 3 přidává lehkou klientskou inline validaci pro jméno, e-mail a telefon; server-side Zod validace zůstává autoritativní.
- Pravý souhrn přidává akce `Upravit` pro službu, termín i kontakt, aby se uživatelka nemusela vracet lineárně zpět.
- Na mobilu flow doplňuje `StickyCTA`, které podle stavu výběru vede na další akci nebo slouží jako submit.
- Flow přidává viditelný progress bar a krátké helper texty vysvětlující další krok po odeslání.

## Důsledky

### Pozitivní
- kratší cesta k rezervaci pro nejběžnější scénář „vezmu nejbližší vhodný termín“
- menší rozhodovací paralýza díky rozdělení služby na kategorii a konkrétní variantu
- lepší mobilní ergonomie díky sticky CTA a větším časovým tlačítkům
- lepší opravitelnost dat bez ztráty výběru v souhrnu
- žádná změna DB, server action rozhraní ani booking business logiky

### Negativní
- booking klientská komponenta je bohatší na lokální UI stav než V1
- klientská validace duplikuje část pravidel ze serveru, takže je potřeba hlídat obsahovou shodu chybových zpráv
- součástí flow je víc pomocných prezentačních komponent, které je potřeba držet konzistentní při dalších redesign iteracích

## Alternativy
- Zachovat calendar-first flow a jen zvětšit tlačítka časů: zamítnuto, protože hlavní problém byl v pořadí rozhodnutí, ne jen v hustotě layoutu.
- Přesunout doporučené termíny do pravého sidebaru: zamítnuto, protože na mobilu i desktopu má být nejrychlejší volba přímo v hlavním proudu kroku 2.
- Přepsat celý booking flow na nový server/client kontrakt: zamítnuto, protože stávající business logika je produkčně použitelná a změna byla čistě UX vrstva.
