# ADR 0029: Owner-only správa přístupů se dvěma rolemi, pozvánkou a aktivací hesla

## Stav
schváleno

## Kontext
Sekce `Uživatelé / role` existovala jen jako generický owner placeholder nad read modelem z `admin-data.ts`. V praxi to vedlo k několika problémům:

- UI mluvilo technickým jazykem (`bootstrap`, `env`, `ADMIN`) místo srozumitelné správy přístupů pro malý salon
- stránka nepůsobila jako reálná pracovní sekce, spíš jako interní debug přehled
- role nebyly prezentované v souladu s produkční realitou PP Studio, kde existují pouze `OWNER` a `SALON`
- chyběl poctivý způsob, jak rozlišit běžný aktivní účet od čekající pozvánky
- nebyl dokončený tok „pozvánka -> nastavení hesla -> přihlášení“

## Rozhodnutí
- Sekce `Uživatelé / role` bude samostatná owner-only obrazovka s vlastním read modelem a nebude dál používat generický placeholder renderer.
- V UI budou pouze dvě role:
  - `OWNER`
  - `SALON`
- Systémové přístupy z env vrstvy se budou v UI prezentovat jen jako `Systémový účet`; technické termíny `bootstrap`, `env` nebo `config account` se z hlavního rozhraní odstraní.
- Stav účtu bude mít jen čtyři čitelné varianty:
  - `Aktivní`
  - `Pozvánka čeká`
  - `Deaktivovaný`
  - `Systémový účet`
- Do modelu `AdminUser` přidáme volitelné pole `invitedAt`, aby šlo stav `Pozvánka čeká` ukládat poctivě bez zavedení třetí role nebo složitější permission vrstvy.
- Pozvánky budou jednorázové a expirující přes model `AdminUserInviteToken` (hash tokenu, expirace, použití, revokace).
- UI nabídne jen jednoduché owner akce odpovídající dnešnímu backendu:
  - založit pozvánku
  - upravit jméno a e-mail
  - přepnout roli mezi `OWNER` a `SALON`
  - deaktivovat / znovu aktivovat účet
  - znovu poslat čekající pozvánku
- Příjemce pozvánky dokončí aktivaci na route `/admin/pozvanka/[token]`, kde nastaví heslo; po úspěchu se přihlásí přes běžný login `/admin/prihlaseni`.
- Admin login bude preferovat databázové účty s `passwordHash`; bootstrap env účty zůstanou jako systémový fallback.
- Blok `Role a oprávnění` zůstane read-only a bude sloužit jen jako klidný vysvětlující sidebar.

## Důsledky

### Pozitivní
- owner okamžitě vidí, kdo má přístup, jakou má roli a co s ním lze udělat
- sekce odpovídá skutečnému provozu malého salonu a nezahltí uživatele technickými pojmy
- systémové účty jsou pořád dohledatelné, ale nepůsobí jako developerský debug výpis
- tok pozvánky je kompletní a provozně použitelný bez enterprise IAM vrstvy
- `invitedAt` i `AdminUserInviteToken` dávají rozšiřitelný základ bez nutnosti přepisovat UI

### Negativní
- přibyly dvě migrace (`AdminUser.invitedAt`, `AdminUserInviteToken`) a navazující provozní QA scénáře
- při výpadku SMTP se účet vytvoří, ale pozvánka nedorazí; owner musí použít opětovné odeslání po opravě SMTP

## Alternativy
- Zachovat generický placeholder a upravit jen copy: zamítnuto, protože problém byl v celé informační architektuře, ne jen ve wording změnách.
- Přidat roli `ADMIN` jako meziúroveň: zamítnuto, protože provozní realita PP Studio ji nepotřebuje.
- Zavést plný permission matrix: zamítnuto, protože by šlo proti cíli mít klidné a přehledné rozhraní pro malý salon.
