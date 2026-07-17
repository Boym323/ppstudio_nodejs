# Admin PWA

Administrace má vlastní manifest (`/admin.webmanifest`) a service worker (`/admin-sw.js`) se scopem pouze `/admin/`; veřejný web ani `/rezervace` worker neřídí.

## Bezpečnost a offline režim

Cache `ppstudio-admin-shell-v4` obsahuje pouze `admin-offline.html` a tři admin ikony; za běhu mohou přibýt jen neměnné assety `/_next/static/`. Neobsahuje HTML administrace, RSC, API, session, rezervace, klientky, platby ani vouchery. Admin navigace jsou vždy síťové; bez připojení se ukáže pouze statická stránka bez uživatelských dat. Po odhlášení proto přístup vždy ověří server a PWA neumí ukázat předchozí admin obsah.

## Instalace a údržba

- Android/Chromium: v menu prohlížeče zvolte **Nainstalovat aplikaci** nebo **Přidat na plochu**.
- iOS: v Safari zvolte **Sdílet → Přidat na plochu**.
- Při změně workeru zvyšte suffix `CACHE_NAME` v `public/admin-sw.js`. Registrace používá `updateViaCache: "none"`; aktivaci ověříte v DevTools → Application → Service Workers.
- PWA odinstalujete v systému. Cache vyčistíte v DevTools → Application → Storage nebo odregistrováním workeru.

PWA nepodporuje offline čtení, editaci ani frontu změn. V produkčním buildu ověřte `/admin.webmanifest`, `/admin-sw.js` a `/admin-offline.html` včetně hlaviček.
