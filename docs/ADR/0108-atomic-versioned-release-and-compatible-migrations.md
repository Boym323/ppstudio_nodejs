# 0108: Atomický verzovaný release a kompatibilní migrace

## Kontext

Původní rollout vyměňoval jen `.next` a `node_modules`, zatímco checkout zůstal po `git pull` nový. E-mail worker se ale spouští přes `tsx` přímo ze zdrojových TypeScript souborů. Selhání buildu nebo startu tedy mohlo kombinovat starý runtime s novým schématem databáze nebo s novými zdroji workeru.

## Rozhodnutí

- Každý release je úplný adresář `releases/<git-hash>-<UTC-čas>` obsahující checkout, `node_modules`, `.next`, `.env` pro build a `.release-env` pro runtime.
- Systemd unity používají stabilní `WorkingDirectory=/var/www/ppstudio/current`; `current` se mění atomickým přejmenováním symlinku až po úspěšném buildu a migraci.
- Předchozí cíl symlinku se zachová jako `previous` až po úspěšném startu webu i workeru a po lokálním health/homepage smoke testu.
- `prisma validate`, lint a build běží před jakýmkoliv zápisem do DB. `prisma migrate deploy` se spouští těsně před aktivací a povoleny jsou pouze expand/contract migrace kompatibilní s předchozím runtime.
- Při selhání webu, workeru, health nebo smoke testu se automaticky vrací celý předchozí runtime release. DB rollback se neprovádí automaticky.
- Po úspěšném health/smoke testu se automaticky uklidí pouze adresáře odpovídající názvu release; `current`, `previous` a konfigurovaný počet dalších nejnovějších release zůstávají zachované.

## Důsledky

Rollout už nemůže spustit worker z jiného checkoutu než web nebo Prisma klient. Selhání buildu nemění produkční DB. Selhání po migraci vyžaduje, aby starší aplikace novému schématu rozuměla; destruktivní změny se proto dělí do nejméně dvou releasů (expand, nasazení kompatibilního kódu, contract až později). Release adresáře je nutné provozně retencovat nebo uklidit až po ověřené záloze a po skončení rollback okna.
