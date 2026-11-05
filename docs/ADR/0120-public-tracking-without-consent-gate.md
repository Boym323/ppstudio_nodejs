# ADR 0120: Veřejné trackery bez cookie souhlasové brány

## Kontext

Cookie panel a souhlasové kontroly byly přidány společně s integrací Meta CAPI. Vlastník projektu požádal o jejich úplné odstranění.

## Rozhodnutí

- Odstranit cookie panel, jeho cookie a runtime kontroly souhlasu z veřejných trackerů i serverové CAPI.
- Trackery se řídí svými konfiguračními přepínači a zachovávají stávající vyloučení administračních a citlivých rout.
- UTM/MTM akvizice se ukládá podle stávajících allowlistů a sanitizace bez kontroly souhlasu.
- Úspěšná veřejná rezervace získá deduplikační UUID; CAPI outbox se vytvoří pouze při aktivní CAPI konfiguraci a dostupném user-agentu.
- Bezpečné filtrování událostí, vyloučení kontaktních údajů a krátká retence browser identifikátorů zůstávají zachované.

## Důsledky

- Veřejné měření se spouští při zapnuté konfiguraci služby bez cookie volby návštěvníka.
- Provozní zapnutí nebo vypnutí jednotlivých služeb zůstává v env konfiguraci.
- ADR 0119 zůstává historickým záznamem původního návrhu; jeho souhlasová část je tímto rozhodnutím nahrazena.

## Stav

schváleno

## Nahrazení

Od 5. 11. 2026 je tato historická volba nahrazena ADR 0121: marketingové a analytické nástroje musí respektovat opt-in souhlas, včetně serverové události `Schedule`. Toto ADR ponecháváme pouze jako auditní záznam.
