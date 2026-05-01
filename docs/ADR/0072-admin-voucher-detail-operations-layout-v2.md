# ADR 0072: Admin voucher detail operations layout v2

## Kontext
- První verze admin detailu voucheru správně zobrazovala data i akce, ale rozpadla se do příliš mnoha samostatných karet.
- Provozní obsluha potřebuje na detailu nejdřív rychle přečíst typ voucheru, stav, platnost, čerpání, kupujícího a dostupné akce.
- Business logika voucherů, routy, PDF export i ruční odeslání e-mailem už existují a nemají se v této iteraci měnit.

## Rozhodnutí
- Detail voucheru zůstává read-only a dál běží na stávajících URL `/admin/vouchery/[voucherId]` a `/admin/provoz/vouchery/[voucherId]`.
- Nahoře používáme jednu souhrnnou kartu přes celou šířku s kódem, typem, stavem, platností, čerpáním a akcemi `Stáhnout PDF`, `Tisk A4`, `Poslat e-mailem`.
- Karty `Detaily` a `Hodnota / služba` slučujeme do jedné kompaktní definice `Parametry voucheru`.
- Karty `Kupující`, `Odeslat voucher` a základní stav odeslání slučujeme do pravého panelu `Kupující a odeslání`.
- Historii e-mailových pokusů držíme jako nízký kompaktní seznam pod tímto panelem.
- Historie uplatnění zůstává samostatná, ale s nižší hustotou a kratšími empty stavy.

## Alternativy
- Zachovat samostatné tematické karty a jen zmenšit paddingy: zamítnuto, protože hlavní problém byl v roztříštěném čtení stránky, ne jen v mezerách.
- Přesunout ruční odeslání voucheru do summary karty jako plně interaktivní client widget: zamítnuto, protože by se zbytečně rozšiřovala klientská hranice stránky.

## Důsledky
- Detail je kratší a více provozně orientovaný bez změny databáze nebo serverových action kontraktů.
- `Poslat e-mailem` v summary kartě funguje jako rychlý skok na existující potvrzovací panel, takže se nemění workflow odeslání.
- Pokud voucher nemá e-mail kupujícího, odesílací akce zůstává zablokovaná s vysvětlením místo tichého selhání.

## Stav
- schváleno
