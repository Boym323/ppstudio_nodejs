# ADR 0039: Admin Login Rate Limit V1

## Kontext

Veřejná rezervace už používá server-side throttling nad `BookingSubmissionLog`, ale admin login route `POST /api/auth/login` dosud přijímala neomezené množství pokusů. To zvyšovalo riziko brute-force a credential stuffing útoků na nejcitlivější vstup systému.

## Rozhodnutí

- Přidáváme server-side rate limit pro admin login přes nový helper `src/lib/auth/admin-login-rate-limit.ts`.
- Limity běží v okně 10 minut a vyhodnocují se nad hashovanou IP adresou a hashovaným e-mailem.
- Aktuální prahy:
  - max 20 pokusů na IP hash
  - max 6 neúspěšných pokusů na e-mail hash
- Audit login pokusů ukládáme do existující tabulky `BookingSubmissionLog` s prefixem `ADMIN_LOGIN_*`:
  - `ADMIN_LOGIN_SUCCESS`
  - `ADMIN_LOGIN_INVALID_PAYLOAD`
  - `ADMIN_LOGIN_INVALID_CREDENTIALS`
  - `ADMIN_LOGIN_RATE_LIMITED`
- Při překročení limitu route vrací redirect na `/admin/prihlaseni?error=rate_limited` a session se nevytvoří.

## Alternativy

- Přidat in-memory limiter bez DB: zamítnuto, protože by se nespolehlivě choval ve více instancích a po restartu.
- Zavést novou dedikovanou tabulku jen pro auth pokusy: odloženo, protože existující `BookingSubmissionLog` už poskytuje potřebné indexy a auditní stopu.
- Nechat login bez limitu a spoléhat jen na silná hesla: zamítnuto jako nedostatečná ochrana.

## Důsledky

- Admin login je odolnější proti rychlým opakovaným pokusům.
- Přibyde auditní stopa pokusů i blokací bez nové migrace a bez nové závislosti.
- Systém při vyšší intenzitě chybných pokusů ukazuje uživatelskou chybu `rate_limited`; provoz má tuto větev zahrnout do QA.

## Stav

schváleno
