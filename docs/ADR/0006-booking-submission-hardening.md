# ADR 0006: Booking submission hardening

## Stav
Accepted

## Kontext
Veřejný booking submit potřebuje kromě samotného vytvoření rezervace i ochranu proti opakovaným pokusům, srozumitelnější recovery a provozní audit selhání.

## Rozhodnutí
- Zavádíme lehký rate limit nad submission logy v databázi.
- Každý pokus o veřejnou rezervaci zapisuje auditní stopu s outcome, IP fingerprintem a případným důvodem selhání.
- Krok 2 ve frontendu filtruje sloty i podle délky služby, aby krátké sloty vůbec nebyly nabídnuté.
- Server při rezervaci dál znovu validuje kapacitu, kompatibilitu služby a časovou délku slotu.

## Důsledky

### Pozitivní
- provozní troubleshooting má konkrétní historii selhání a blokací
- anti-spam ochrana nevyžaduje další infrastrukturu
- uživatelé dostanou rychlejší a přesnější feedback už ve výběru termínu

### Negativní
- přibyla nová tabulka pro submission logy
- rate limit je záměrně lehký, takže není náhradou plnohodnotné WAF ochrany

## Alternativy
- In-memory rate limiting: zamítnuto, protože by nefungoval napříč více instancemi a po restartu.
- Audit jen v `EmailLog`: zamítnuto, protože selhání rezervace není e-mailový event.
- Bez auditního logu blokací: zamítnuto, protože by troubleshooting ztratil kontext o tom, proč submit selhal.
