# ADR 0114: Tichý readiness probe po restartu webu

## Kontext

Systemd potvrzuje start Next.js procesu dříve, než server otevře port 3000. První health request proto běžně končil `curl: (7)`, přestože služba byla za okamžik připravená.

## Rozhodnutí

- Release helper po startu obou služeb tiše zkouší dosažitelnost `PPSTUDIO_HEALTH_URL` po dobu výchozích pěti sekund.
- Až po otevření spojení provádí viditelnou strict health a homepage smoke kontrolu.
- Vyčerpání readiness retry je skutečné selhání startu a zachovává rollback.

## Alternativy

- Ignorovat první chybu curl: zamítnuto, protože by mohl být potlačen skutečný start failure.
- Přidat pevný sleep: zamítnuto, protože by prodlužoval každý release bez ohledu na skutečnou rychlost startu.

## Důsledky

- Běžný rychlý start neprodukuje falešný chybový výpis.
- Pomalý či nefunkční start zůstává diagnostikovatelný a bezpečně rollbackovaný.

## Stav

Schváleno.
