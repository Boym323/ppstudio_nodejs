# ADR 0008: Email delivery a veřejné storno rezervace ve v1

## Kontext
- Veřejný booking flow už vytváří rezervaci, action token a `EmailLog`, ale chyběla skutečná delivery vrstva a reálné zpracování storna přes token.
- Pro self-hosted provoz potřebujeme jednoduché řešení bez vendor lock-inu, s možností běžet i v log-only režimu při prvním rolloutu.

## Rozhodnutí
- Zavedli jsme jednoduchou e-mailovou vrstvu nad `nodemailer` se dvěma režimy:
  - `log` pro bezpečný rollout a lokální vývoj
  - `smtp` pro produkční odesílání
- `EmailLog` zůstává zdrojem pravdy pro audit e-mailů; po vytvoření rezervace i po storno akci se e-mail odesílá až po úspěšném commitu transakce.
- Storno odkaz je realizovaný jako veřejná stránka s potvrzovacím krokem a server-side storno akcí nad `BookingActionToken`.
- Po storno akci se:
  - změní stav `Booking` na `CANCELLED`
  - zapíše `BookingStatusHistory`
  - aktuální token označí jako použitý
  - ostatní storno tokeny rezervace se revokují
  - vytvoří a zpracuje potvrzovací storno e-mail

## Alternativy
- Přímé odesílání e-mailu bez `EmailLog`
- Externí transakční provider API bez SMTP fallbacku
- Automatické storno ihned po otevření token URL bez potvrzovací stránky

## Důsledky
- Výhodou je nízká integrační složitost a auditovatelný provoz.
- Booking ani storno nejsou blokované tím, že SMTP dočasně selže; chyba se propíše do `EmailLog`.
- Nevýhodou je synchronní odesílání po commitu, takže při pomalém SMTP může být request delší než s frontou.
- Pro vyšší provoz bude později vhodné přesunout delivery do background jobu, ale datový model na to už je připravený.

## Stav
- schváleno
