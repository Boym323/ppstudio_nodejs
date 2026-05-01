# ADR 0071: Admin dashboard jako denní provozní cockpit

## Kontext

Dashboard už obsahoval dnešní provoz, alerty, volné sloty, rychlé akce, týdenní obsazenost i Matomo analytiku. V praxi ale hlavní obrazovka míchala denní rozhodování s analytickým reportingem a majitelka salonu neměla během pár sekund jasnou odpověď, co má vyřešit jako první.

Zároveň nechceme měnit admin shell, navigaci, booking engine, role guardy, DB schéma ani Matomo API kontrakt.

## Rozhodnutí

Overview `/admin` a `/admin/provoz` se zjednodušuje na denní provozní cockpit.

- Horní sekce `Dnešní provoz` je nízká horizontální operační lišta s datem, krátkým stavovým řádkem, volitelným mini boxem další rezervace a třemi hlavními akcemi.
- `Vyžaduje pozornost` slučuje čekající rezervace, chybějící publikovanou dostupnost dnes/zítra a chybné e-maily do kompaktních inline alertů. Nulový stav je klidný pozitivní text.
- KPI jsou omezené na provozní hodnoty a zobrazené jako jeden metric strip: dnešní rezervace, volná okna dnes, týdenní obsazenost a volné sloty tento týden.
- Hlavní obsah je dvousloupcový: vlevo `Dnešní plán` a `Nejbližší volné termíny`, vpravo `Rychlé akce`, `Tento týden` a `Výkon webu`.
- `Dnešní plán` zobrazuje jen rezervace, ne volná okna. Řádky jsou nízké, právě probíhající rezervace je decentně zvýrazněná a dokončené rezervace jsou tlumené.
- Pravý sloupec je zhuštěný: rychlé akce jsou 2x2 krátká tlačítka, `Tento týden` má tři řádky a Matomo widget je ve výchozím stavu kompaktní `Výkon webu`. Zdroje návštěv a funnel jsou dostupné až přes rozbalení `Zobrazit analytiku`.

## Důsledky

- Dashboard má nižší vizuální šum a rychleji odpovídá na provozní otázky dne.
- Analytika zůstává dostupná, ale není hlavním signálem provozní obrazovky.
- Bezpečné fallbacky řeší chybějící názvy služeb nebo klientek, nulové rezervace, nulové sloty i nedostupnou Matomo konfiguraci.
- Nebyla přidána žádná nová závislost, env proměnná ani databázová migrace.

## Stav

schváleno
