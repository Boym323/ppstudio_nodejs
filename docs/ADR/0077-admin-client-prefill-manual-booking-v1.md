# 0077 - Admin Client Prefill Into Manual Booking v1

- Status: accepted
- Date: 2026-05-01

## Context
- Admin detail klientky existuje pro owner i salon oblast.
- Ruční vytvoření rezervace už běží na existující route `/admin/rezervace` a `/admin/provoz/rezervace` přes drawer a server action.
- Potřebujeme z detailu klientky otevřít stejné ruční flow s předvyplněnou klientkou bez změny DB schématu nebo booking business logiky.

## Decision
- Nepřidáváme novou route ani migraci.
- Primární CTA `Vytvořit rezervaci` na detailu klientky vede na existující booking workspace s query parametry `?create=1&clientId=<id>`.
- Booking page server-side vyhodnotí `clientId`, zkusí klientku načíst a předá draweru initial state pro otevření a předvyplnění.
- Pokud `clientId` neexistuje nebo klientka není dohledaná, drawer zobrazí jemný fallback `Klientku se nepodařilo předvyplnit.` a zůstane normálně použitelný.
- Pokud je klientka neaktivní, drawer ji předvyplní a zobrazí warning `Klientka je neaktivní.`.
- Server action pro vytvoření rezervace zůstává stejná a dál běží přes existující admin autorizaci i booking engine validace.

## Consequences
- OWNER i SALON mají stejný bezpečný flow, liší se jen route prefix `/admin` vs `/admin/provoz`.
- Prefill klientky je čistě UX zkratka; nedochází k obejití validace dostupnosti, překryvů, notifikací ani audit trailu.
- URL zůstává sdílitelná v rámci administrace, ale po zavření nebo úspěšném vytvoření rezervace se query parametry z klientského routeru vyčistí, aby se drawer neotevíral opakovaně.
