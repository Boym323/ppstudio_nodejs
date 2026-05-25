# 0099 - Interní čas na úklid u služby

## Kontext
PP Studio potřebuje u každé služby evidovat volitelný čas na úklid po službě. Hodnota je provozní metadata služby a nesmí se klientce zobrazovat jako délka služby.

## Rozhodnutí
Do modelu `Service` přidáváme pole `cleanupMinutes` s výchozí hodnotou `0` a databázovou kontrolou nezáporné hodnoty. Admin formulář služby pole zobrazuje jako `Čas na úklid po službě` s nápovědou, že se použije pouze pro interní blokaci termínu po službě a klientce se nezobrazuje jako délka služby.

Při vytvoření a přesunu rezervace systém snapshotuje `cleanupMinutes` do rezervace, počítá `cleanupBlockMinutes` zaokrouhlením nahoru na 15 minut a ukládá interní konec blokace do `blockedUntil`.

Generování dostupnosti i kolizní kontroly používají interní interval `scheduledStartsAt -> blockedUntil`. Klientský termín, délka služby, cena, platební logika a veřejné texty zůstávají beze změny (`scheduledStartsAt -> scheduledEndsAt`).

## Alternativy
- Rozšířit rovnou výpočet dostupnosti bez snapshotu: zamítnuto, protože změna služby by zpětně přepisovala chování historických rezervací.
- Použít globální buffer v nastavení salonu: zamítnuto, protože různé služby mohou potřebovat odlišný úklidový čas.
- Ukládat úklid jako součást `durationMinutes`: zamítnuto, protože by se klientce zobrazovala delší služba a změnily by se e-maily, kalendáře i veřejné UI.

## Důsledky
Stávající služby mají po migraci `cleanupMinutes = 0`, takže jejich chování zůstává stejné. Historické rezervace bez snapshot hodnot fallbackují na `0` a nesmí padat při výpočtu dostupnosti ani v admin detailu.

Změna `cleanupMinutes` u služby ovlivňuje jen nové rezervace; existující rezervace drží vlastní snapshot a zpětně se nepřepočítávají.

## Stav
schváleno
