# 0049 Admin email log detail business/debug split v1

## Kontext

Detail email logu v adminu dosud působil primárně jako technický debug panel. Payload, queue metadata a provider informace byly příliš vysoko, takže obsluha musela číst technické údaje dřív, než zjistila základní provozní odpovědi:

- komu email patří
- jaký typ emailu to byl
- k jaké rezervaci se vztahuje
- jestli byl úspěšný nebo je problém
- jestli je potřeba nějaká akce

Současně nechceme měnit worker, retry politiku, queue mechanismus, payload strukturu ani booking vazby.

## Rozhodnutí

Detail `/admin/email-logy/[emailLogId]` nově odděluje business a technický pohled:

- Nahoře je výrazný business header s názvem emailu, jedním finálním stavem, příjemcem, klientkou, rezervací a klíčovým časem.
- Pod headerem jsou vždy viditelné rychlé akce `Zpět na přehled`, `Otevřít rezervaci` a podle stavu `Zkusit znovu` nebo `Uvolnit zaseknutý job`.
- Hlavní obsah používá dvousloupcovou IA `Navázané záznamy + chyba` versus `Souhrn`.
- Payload, raw metadata a provider debug se přesouvají do spodního rozbalovacího bloku `Technické detaily`.
- Citlivé údaje se defaultně maskují; plné hodnoty se zobrazí až po explicitním rozbalení.
- Finální stav detailu se dopočítává deterministicky z existujících dat bez změny persistence:
  - `sentAt` existuje -> `Odesláno`
  - `PENDING` s `attemptCount > 0` -> `Retry`
  - `FAILED` -> `Selhalo`
  - jinak -> `Čeká`

## Alternativy

- Nechat detail technický a přidat jen pár badge nebo tooltipů.
- Vytvořit zcela nový client-side inspector se stavovými toggly.
- Přidat nové status pole nebo helper sloupce do databáze.

## Důsledky

- Owner rychleji přečte business dopad konkrétního emailu bez rolování do payloadu.
- Debug data zůstávají dostupná, ale už nepřebíjí hlavní informační hierarchii.
- Nevzniká nový backend kontrakt ani změna worker logiky; změna je čistě v read modelu a UI.
- Citlivé tokeny a URL parametry se méně snadno odhalí při běžném provozním použití obrazovky.

## Stav

schváleno
