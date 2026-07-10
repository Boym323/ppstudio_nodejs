# ADR 0106: Deaktivace administrátora revokuje pozvánky atomicky

## Kontext

Veřejná action pro nastavení hesla dříve po ověření pozvánky bezpodmínečně zapisovala `AdminUser.isActive = true`. Účet deaktivovaný ownerem se tak mohl držitelem dosud nepoužitého odkazu znovu aktivovat. Oddělené čtení a zápis navíc dovolovalo souběžné použití téhož tokenu.

## Rozhodnutí

- Deaktivace účtu a revokace všech jeho nepoužitých tokenů probíhá v jedné PostgreSQL transakci.
- Aktivace pozvánky v jedné transakci zamkne token i navázaný účet (`FOR UPDATE`), vyžaduje aktivní účet, neexpirovaný token a `usedAt IS NULL` i `revokedAt IS NULL`.
- Token se spotřebuje pod stejnými podmínkami atomickým `UPDATE`; potom se uloží pouze hash hesla a revokují sourozenecké pozvánky.
- Veřejná aktivace nikdy nezapisuje `isActive`; opětovnou aktivaci provádí jen autorizovaný owner.

## Důsledky

- Staré odkazy po deaktivaci nemohou obnovit přístup ani při souběhu požadavků.
- Owner při legitimním návratu uživatele účet nejprve aktivuje a případně vydá novou pozvánku.
- Chování chrání integrační test pro „deaktivace → stará pozvánka“ i pro dva paralelní pokusy o stejný token.
