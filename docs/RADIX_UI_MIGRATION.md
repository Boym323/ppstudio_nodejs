# Migrace administračního UI na Radix UI

## Rozsah a výchozí stav

Tento dokument je cílený kontext pro postupnou migraci modalů, drawerů a
mobilních sheets. Audit pokryl pouze uvedené komponenty a jejich lokální UI
chování. Fáze 0 nemění produkční kód, dependencies ani chování aplikace.

### Invariants

Během celé migrace musí zůstat beze změny:

- booking business logika včetně vytváření, přesunu, validace a notifikací,
- availability engine a pravidla slotů,
- databázové schéma,
- API kontrakty a server actions,
- URL/routing semantics včetně route-driven zavírání drawerů,
- autentizace a role OWNER/SALON,
- analytics,
- FullCalendar,
- TanStack Table,
- veřejný branding a současný vizuální jazyk PP Studio.

Radix je pouze behavior/accessibility layer. Nesmí se z něj stát nový business
framework ani důvod pro redesign.

## Inventory

| Komponenta | Současné řešení | Navržený Radix primitive | Fáze |
|---|---|---|---|
| `admin-drawer-escape-close.tsx` | Globální `window` Escape listener; ruční focus trap přes `useAdminModalFocus`; route close přes `window.location.assign` | Sdílené tenké obaly nad `Dialog`; lifecycle `onOpenChange` | 1–2 |
| `invite-user-dialog.tsx` | Controlled vlastní `role="dialog"`, `aria-modal`, overlay click a Escape listener | `Dialog.Root`, `Portal`, `Overlay`, `Content`, `Title`, `Description`, `Close` | 1 |
| `create-manual-booking-drawer.tsx` | `createPortal`, vlastní Escape, pravý panel, sticky footer, inline success/error feedback | `Dialog` stylovaný jako pravý drawer | 2 |
| `reschedule-booking-button.tsx` | `createPortal`, vlastní Escape, pravý panel, inline success/error feedback | `Dialog` stylovaný jako pravý drawer | 2 |
| `CategoryDetailDrawer.tsx` | Vlastní fixed overlay, pravý `aside`, Escape listener; bez explicitního dialog semantics/focus trap | `Dialog` stylovaný jako drawer | 2 |
| `admin-services-page.tsx` – detail služby | Route-driven fixed drawer, overlay `Link`, Escape navigace přes helper; bez explicitního dialog semantics | `Dialog` s controlled/route-driven lifecycle | 2 |
| `admin-clients-toolbar.tsx` – `MobileFiltersSheet` | Mobilní bottom sheet, `role="dialog"`, `aria-modal`, ruční focus trap a restore focus | `Dialog` stylovaný jako bottom sheet | 3 |
| `admin-logs-page.tsx` – `LogsFiltersDialog` | Mobilní bottom sheet, `role="dialog"`, `aria-modal`, ruční focus trap a restore focus | `Dialog` stylovaný jako bottom sheet | 3 |
| `admin-shell.tsx` – mobilní navigace | Vlastní modal overlay, ruční focus trap, Escape a restore focus | `Dialog` stylovaný jako levý drawer/sheet | 3 |
| `admin-weekly-planner-lab-client.tsx` | `window.confirm` při zahození neuložených změn; status/error/undo feedback | `AlertDialog` pro potvrzení destruktivní akce | 3 |
| `site-header.tsx` – mobilní menu | `createPortal`, ruční Escape/focus trap, body scroll lock; veřejný header | `Dialog`/`Sheet` až v samostatném veřejném UI kroku | Odložit |
| `about-certificates-gallery.tsx` – lightbox | Vlastní `role="dialog"`, `aria-modal` a Escape; veřejná galerie | `Dialog` až mimo admin migraci | Odložit |

### Poznámky k výchozímu stavu

- Sdílený hook `useAdminModalFocus` řeší počáteční fokus, Tab cyklus, Escape,
  ale pouze tam, kde je komponenta explicitně použije. Pravé route-driven
  drawery služeb a kategorií jej dnes nepoužívají.
- Rezervační drawery mají významné inline success/error stavy. Po migraci
  musí zůstat ve stejném workflow a nesmí být nahrazeny toastem před zavedením
  společného toast systému.
- Manuální rezervace při úspěchu zavře panel, odstraní query parametry,
  refreshne data a zobrazí success banner mimo drawer. Toto pořadí je invariant.
- Přesun rezervace zachovává availability, conflict handling, refresh,
  server action a výsledný booking state; Radix smí změnit pouze modal lifecycle.
- `admin-services-page.tsx` zavírá detail navigací na `returnTo`, nikoli pouze
  lokálním state. Stejný výsledný URL stav musí zůstat zachován.
- `admin-weekly-planner-lab-client.tsx` používá `window.confirm` pouze při
  zahození více pending změn; jde o vhodný samostatný `AlertDialog` krok.
- `<details>/<summary>` jako action menu se v cíleném rozsahu nenašlo. V logách
  je `<details>` pouze rozbalovací technický stav e-mailové fronty, nikoli menu.
- `FullCalendar` a TanStack Table jsou v cílených souborech konzumenty dat/UI;
  migrace modalu se jich nesmí dotknout.

## UI conventions

### Dialog

Používat pro potvrzený modalní obsah, `Dialog.Title` a `Dialog.Description`,
Radix portal/overlay, uzavření přes `onOpenChange` a návrat fokusu na trigger.
Obsah má zachovat současný PP Studio styling a být použitelný i na mobilech.

### Drawer

Použít `Dialog` primitives s layoutem draweru: desktop pravý panel, hlavička
s titulkem/popisem/close, scrollovatelný obsah a sticky footer. Overlay, Escape,
focus trap a focus restoration řeší Radix; business stav zůstává v calleru.

### Mobile Sheet

Použít stejný Dialog základ jako bottom sheet (admin filtry) nebo levý sheet
(navigace). Zachovat safe-area padding, omezení výšky, vnitřní scroll a
kliknutí mimo panel. Nezaměňovat sheet za nový globální stavový systém.

### AlertDialog

Použít pouze pro akce s potenciální ztrátou změn nebo jiným destruktivním
dopadem. Text musí popsat následek, nabídnout bezpečné zrušení a zachovat
stávající default/keyboard chování.

### DropdownMenu

V cíleném auditu není současné `<details>/<summary>` action menu. Pokud se
později objeví skutečné akční menu, použít `DropdownMenu` s klávesovou navigací,
jasným triggerem a bez přesunu business logiky do UI vrstvy.

### Toast

Toast zatím nezavádět. Do budoucna má být jediný konzistentní kanál pro krátké
globální success/error feedback; dlouhé inline validační a workflow chyby musí
zůstat u příslušného formuláře.

## Migrační pořadí

1. Zavést pouze `@radix-ui/react-dialog` a tenkou sdílenou komponentu bez
   business logiky; pilotem je `InviteUserDialog`.
2. Migrovat rezervační drawery a route-driven drawer služby/kategorie. Ověřit
   URL lifecycle, sticky footery, availability a server actions.
3. Migrovat mobilní sheets a `AlertDialog` v planneru.
4. Veřejný `site-header` a certificate lightbox řešit odděleně, až bude jasné,
   že sdílený základ nenaruší veřejný branding.

## Test strategy

- Po každé implementační fázi: `npm run typecheck`.
- Cílený lint pouze na změněné soubory, například:
  `npm run lint -- src/features/admin/components/invite-user-dialog.tsx src/components/ui/dialog.tsx`.
- Spustit relevantní existující unit/integration testy pro booking actions,
  availability a stav komponent, pokud jsou v projektu k dispozici.
- Playwright použít cíleně pro modalní UX: otevření/zavření, Escape, focus
  trap/restoration, overlay, mobile viewport, route-driven URL a kritické
  success/error workflow. Nevytvářet plošný nový E2E suite.
- U rezervačních změn ověřit zejména, že Radix nezměnil server/client boundary,
  formulářové server actions, debounce/API lookup ani refresh po úspěchu.

## Fáze 0 – auditní nález

Relevantních je 11 UI míst v 12 zadaných souborech (jeden soubor je sdílený
helper). Největší překvapení: část drawerů nemá explicitní dialog semantics ani
focus trap, zatímco podobné mobilní sheets mají ruční focus management; dále
se v rozsahu nacházejí dva veřejné modalové vzory a `window.confirm` v planneru.
