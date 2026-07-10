# ADR 0109: Offline recovery OWNERa a invariant aktivního OWNERa

## Stav

schváleno

## Kontext

Webový bootstrap login dokázal vydat JWT pro identitu, která neměla databázový záznam. Session resolver takový subject správně odmítal, takže dokumentovaná recovery cesta vedla k okamžitému lockoutu. Současně bylo možné deaktivovat nebo degradovat posledního aktivního OWNERa.

## Rozhodnutí

- Webový bootstrap login a systémové účty mimo databázi se odstraňují.
- Obnovu přístupu provádí pouze offline CLI `admin:recover-owner`, které vytvoří nebo obnoví aktivního DB OWNERa, nastaví hash hesla, revokuje otevřené pozvánky a zapíše auditní záznam bez hesla.
- Deaktivace a změna role administrátora probíhají v serializovatelné transakci. Aktivního OWNERa nelze změnit na ne-OWNERa ani deaktivovat, pokud by tím nezůstal žádný další aktivní OWNER.

## Alternativy

- Opravit session resolver tak, aby přijímal `bootstrap-*`: zamítnuto, protože by web obcházel databázovou aktivitu, aktuální roli i auditovatelnou identitu.
- Povolit poslednímu OWNERovi self-demotion s varováním: zamítnuto, protože warning nechrání před lockoutem ani souběžnými akcemi.

## Důsledky

- Recovery vyžaduje přístup k provoznímu hostu a databázi, ale každá úspěšná obnova vytváří použitelnou databázovou session.
- Stávající proměnné bootstrap hesel již nejsou součástí runtime kontraktu; `ADMIN_OWNER_EMAIL` zůstává jen kontaktní fallback.
- UI zůstává pohodlné pro běžnou správu, serverová transakce je však závazná ochrana i pro ruční request.
