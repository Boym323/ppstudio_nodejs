# ADR 0061: Admin voucher create v1

## Kontext
- Voucher databázový základ, doménová tvorba, admin seznam a read-only detail už existují.
- OWNER i SALON mají v modulu voucherů stejná provozní práva, ale používají paralelní admin URL.
- První verze tvorby nemá řešit PDF, automatické e-mailové odeslání, editaci, rušení, mazání ani čerpání.

## Rozhodnutí
- Přidáváme routy `/admin/vouchery/novy` pro OWNER a `/admin/provoz/vouchery/novy` pro SALON.
- Statické voucher routy mají vlastní admin layout wrapper, aby vytvoření i detail běžely uvnitř standardního admin shellu, ne přímo nad veřejným světlým body pozadím.
- Routy sdílí `createAdminVoucherCreateRoute(...)`, komponentu `src/features/admin/components/admin-voucher-form.tsx` a server action `createAdminVoucherAction(...)`.
- Server action vždy ověřuje roli `OWNER` nebo `SALON`, validuje vstup přes existující voucher Zod schéma a pro typ `SERVICE` znovu kontroluje, že vybraná služba je aktivní.
- Formulář výchozí na typ `VALUE`, předvyplní dnešní `validFrom` a `validUntil` plus 12 měsíců v timezone `Europe/Prague`.
- Údaje kupujícího, obdarovaného a věnování jsou volitelné; `purchaserEmail` se zatím pouze ukládá jako příprava pro budoucí ruční odeslání voucheru e-mailem.
- Formulář používá dvousloupcovou provozní skladbu s živým náhledem voucheru, aby obsluha před uložením viděla typ, hodnotu nebo službu, platnost a volitelné osobní údaje.
- Po úspěšném vytvoření action přesměruje na detail ve stejné admin oblasti.

## Alternativy
- Duplikovat owner a salon formulář: zamítnuto, protože voucher práva i business logika jsou stejné.
- Volat `createVoucher` přímo z routy bez admin action wrapperu: zamítnuto, protože server action musí znovu ověřit autentizaci a autorizaci.
- Přidat PDF nebo e-mail hned při vytvoření: odloženo, aby vystavení voucheru zůstalo čistě databázová operace nad existující doménou.

## Důsledky
- Detail voucheru zůstává po vytvoření jediným místem pro kontrolu vystaveného kódu.
- Budoucí e-mailové odeslání může navázat na uložené údaje kupujícího, ale nesmí se spouštět implicitně při této akci.
- Budoucí editace nebo storno voucheru musí být samostatné explicitní admin workflow s vlastní validací a auditem.

## Stav
- schváleno
