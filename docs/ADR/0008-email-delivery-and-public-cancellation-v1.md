# ADR 0008: Email delivery a veřejné storno rezervace ve v1

## Kontext
- Veřejný booking flow už vytváří rezervaci, action token a `EmailLog`, ale chyběla robustní delivery vrstva s retry a reálné zpracování storna přes token.
- Pro self-hosted provoz potřebujeme jednoduché řešení bez vendor lock-inu, s možností běžet i v log-only režimu při prvním rolloutu a s odděleným workerem v produkci.

## Rozhodnutí
- Zavedli jsme jednoduchou e-mailovou vrstvu nad `nodemailer` a PostgreSQL outbox:
  - `log` pro bezpečný rollout a lokální vývoj
  - `background` pro produkci s odděleným workerem
- `EmailLog` zůstává zdrojem pravdy pro audit e-mailů; po vytvoření rezervace i po storno akci se e-mail buď rovnou zaznamená jako `SENT` v log režimu, nebo se uloží jako `PENDING` pro background worker.
- Storno odkaz je realizovaný jako veřejná stránka s potvrzovacím krokem a server-side storno akcí nad `BookingActionToken`.
- Po storno akci se:
  - změní stav `Booking` na `CANCELLED`
  - zapíše `BookingStatusHistory`
  - aktuální token označí jako použitý
  - ostatní storno tokeny rezervace se revokují
  - vytvoří potvrzovací storno e-mailový záznam pro worker nebo log režim

## Alternativy
- Přímé odesílání e-mailu bez `EmailLog`
- Externí transakční provider API bez PostgreSQL outboxu
- Automatické storno ihned po otevření token URL bez potvrzovací stránky

## Důsledky
- Výhodou je nízká integrační složitost, auditovatelný provoz a kratší requesty.
- Booking ani storno nejsou blokované tím, že SMTP dočasně selže; chyba se propíše do `EmailLog` a worker ji retryne s backoffem.
- Nevýhodou je potřeba provozovat samostatný worker proces.
- Datový model už na to byl připravený, takže změna zůstala bez nové infrastruktury mimo PostgreSQL.

## Stav
- schváleno
