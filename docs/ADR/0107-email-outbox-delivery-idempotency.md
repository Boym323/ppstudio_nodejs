# ADR 0107: Tokenovaný claim a idempotence e-mailového outboxu

## Kontext

`EmailLog` už při claimu vytvářel `processingToken`, ale doručení jej nekontrolovalo. Zastaralý nebo paralelní caller proto mohl zapsat výsledek cizího claimu a dva cally mohly poslat stejný e-mail. Po ACK poskytovatele a před DB zápisem navíc nelze z databáze poznat, zda zpráva odešla.

## Rozhodnutí

- Worker předává token claimu do `deliverEmailLog`; načtení jobu, úspěšné dokončení, skip i retry/final failure vyžadují shodný token.
- Ruční okamžité odeslání job nejdřív atomicky claimuje stejným protokolem.
- Resend REST dostává stabilní `Idempotency-Key` `email-log/<EmailLog.id>`.
- SMTP dostává stabilní `Message-ID` a `Resend-Idempotency-Key` jako neškodnou kompatibilní hlavičku pro Resend SMTP.

## Důsledky

Paralelní nebo zastaralý worker nemůže dokončit cizí claim. Resend eliminuje opakované requesty stejného jobu ve svém 24hodinovém okně. Obecné SMTP však neposkytuje potvrzené exactly-once API: mezi přijetím zprávy a DB zápisem zůstává at-least-once semantika, která musí být provozně akceptovaná.
