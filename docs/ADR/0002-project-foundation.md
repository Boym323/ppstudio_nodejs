# ADR 0002: Základní architektura projektu

## Stav
Accepted

## Kontext
Projekt potřebuje čistý produkční základ pro:

- luxusní veřejný web
- rezervační část s ručně vypisovanými termíny
- oddělené admin rozhraní pro owner a salon

Zároveň používáme Next.js 16, kde je potřeba respektovat aktuální App Router konvence a novou `proxy.ts` file convention.

## Rozhodnutí
Zvolili jsme následující základ:

- route groups `(public)`, `(booking)` a `(admin)`
- sdílené layout komponenty mimo route soubory
- feature-first členění v `src/features`
- infrastrukturu v `src/lib`
- validaci prostředí a vstupů přes Zod
- Prisma + PostgreSQL jako výchozí datovou vrstvu
- bootstrap admin auth přes env a podepsanou session cookie

## Důsledky

### Pozitivní
- routing a odpovědnosti jsou od začátku čitelné
- admin část se dá rozšiřovat bez míchání s veřejným webem
- booking flow je připravený na server-first implementaci
- env a auth vrstva mají konzistentní validaci

### Negativní
- bootstrap auth v env je jen přechodné řešení
- pro plnou správu admin uživatelů bude potřeba navazující ADR a migrace

## Alternativy
- Flat `app/` struktura bez route groups: zamítnuto kvůli rychlé ztrátě přehledu.
- Middleware-first auth: zamítnuto, protože Next 16 směřuje na `proxy.ts` a finální autorizace má zůstat na serveru.
- Mock-first booking data: zamítnuto, protože cílem je čistý produkční scaffold bez demo balastu.
