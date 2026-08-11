# Migrace administračního UI na Radix UI

## Rozsah a finální stav

Tento dokument uzavírá migraci administračních modalů, drawerů, mobilních
sheets, akčního menu a krátkého feedbacku. Finální audit pokryl pouze níže
uvedené komponenty, sdílené UI primitives a jejich lokální UI chování;
nesouvisející backendové oblasti nebyly auditovány.

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

| Komponenta | Výsledek | Stav | Poznámka |
|---|---|---|---|
| `components/ui/dialog.tsx` | Sdílený `Dialog` primitive | DONE | Portal, jednotný overlay, responsivní rozměry, focus lifecycle a animace. |
| `components/ui/sheet.tsx` | Bottom a levý sheet nad `Dialog` | DONE | Omezení `88dvh`, vnitřní scroll, safe-area, touch layout a slide animace. |
| `components/ui/alert-dialog.tsx` | Sdílený `AlertDialog` primitive | DONE | Použit pro potvrzení ztráty rozpracovaných změn. |
| `components/ui/dropdown-menu.tsx` | Sdílený `DropdownMenu` primitive | DONE | Portal na `z-index: 100`, klávesová navigace a highlighted stav. |
| `components/ui/toast.tsx` | Administrační `ToastProvider` | DONE | Success/error feedback, close action, safe-area viewport na `z-index: 110`. |
| `invite-user-dialog.tsx` | Radix `Dialog` | DONE | Accessible title/description, zavření overlayem/Escape a obnova fokusu. |
| `create-manual-booking-drawer.tsx` | Pravý Radix `Dialog` drawer | DONE | Sticky header/footer, oddělený scroll obsahu, safe-area a původní booking workflow. |
| `reschedule-booking-button.tsx` | Pravý Radix `Dialog` drawer | DONE | Sticky header/footer, safe-area, inline validace a původní booking workflow. |
| `CategoryDetailDrawer.tsx` | Pravý Radix `Dialog` drawer | DONE | Modal semantics, sticky hlavička a scroll/focus lifecycle zajišťuje Radix. |
| `admin-services-page.tsx` – detail služby | Route-driven Radix `Dialog` drawer | DONE | `admin-route-drawer.tsx` zachovává zavření navigací na `returnTo`. |
| `admin-clients-toolbar.tsx` – `MobileFiltersSheet` | Radix bottom sheet | DONE | Sticky actions, safe-area, dlouhý obsah a focus restoration. |
| `admin-logs-page.tsx` – `LogsFiltersDialog` | Radix bottom sheet | DONE | Sticky actions, safe-area a focus restoration. |
| `admin-shell.tsx` – mobilní navigace | Radix left sheet | DONE | Focus trap, Escape, obnova fokusu a uzavření při desktop breakpointu. |
| `admin-weekly-planner-lab-client.tsx` | Radix `AlertDialog` | DONE | Bezpečný počáteční fokus je na akci „Zpět“. |
| `service-actions-menu.tsx` | Radix `DropdownMenu` | DONE | Skutečné akční menu; technický `<details>` v logách není menu. |
| `site-header.tsx` – mobilní menu | Původní veřejný modalový vzor | INTENTIONALLY KEPT | Veřejný branding a UI jsou mimo administrační Radix migraci. |
| `about-certificates-gallery.tsx` – lightbox | Původní veřejný lightbox | INTENTIONALLY KEPT | Veřejná galerie je mimo administrační Radix migraci. |
| `admin-booking-payment-form.tsx` – storno platby | Nativní `window.confirm` | INTENTIONALLY KEPT | Samostatné platební workflow nebylo součástí migračního inventáře; změna by rozšířila scope. |

### Poznámky k finálnímu stavu

- Ruční `AdminEscapeKeyClose`, `useAdminModalFocus`, `FOCUSABLE_SELECTOR`,
  modal-specific portály a administrační globální keydown listenery byly
  odstraněny. `AdminRouteDrawer` zůstává pouze pro URL lifecycle detailu služby.
- Manuální vytvoření a přesun rezervace zachovávají availability,
  conflict handling, server actions, refresh, query parametry i výsledný booking
  stav; Radix řeší pouze modalní lifecycle a accessibility.
- `FullCalendar` a TanStack Table zůstaly pouze konzumenty dat/UI a migrace
  jejich business chování nezměnila.

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

Pro skutečná akční menu používat `DropdownMenu` s klávesovou navigací, jasným
triggerem, portálem nad drawerem/dialogem a bez přesunu business logiky do UI
vrstvy. Rozbalovací obsah formuláře nebo technický stav zůstává `<details>`.

### Toast

Pro krátký globální success/error feedback používat tenkou vrstvu nad Radix
`Toast`. Field validation a chyby přímo svázané s formulářem zůstávají inline.

## Vrstvení a vizuální konvence

- Overlay všech modalních primitives: `z-index: 80`, `bg-black/62`, blur a
  jednotný fade respektující `prefers-reduced-motion`.
- Dialog, drawer a sheet obsah: `z-index: 90`; dropdown: `100`; toast: `110`.
- Dialog a `AlertDialog` sdílejí titulkovou hierarchii, popis, radius a shadow;
  pravé drawery záměrně nemají radius na hraně viewportu a používají boční
  shadow. Bottom sheet má pouze horní radius.
- Primární akce je na desktopu vpravo od sekundární; destruktivní akce
  `AlertDialog` je vizuálně odlišená a bezpečný focus začíná na zrušení.

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

## Finální audit

- Všechny migrované `Dialog`, drawer, sheet a `AlertDialog` instance mají
  `Title`; všude, kde popis pomáhá, také `Description`. Ruční `role="dialog"`
  ani `aria-modal` v administračním migračním rozsahu nezůstaly.
- Escape, focus trap, focus restoration, zavření overlayem a klávesové
  ovládání menu zajišťují Radix primitives. Ikonový trigger menu a toast close
  mají accessible name; focus-visible stavy nebyly odstraněny bez náhrady.
- Mobilní sheets používají dynamickou výšku viewportu, omezení výšky,
  `overscroll-contain`, vnitřní scroll, sticky actions, safe-area a minimální
  44px touch targets. Drawery oddělují scroll dlouhého obsahu od hlavičky a
  paty; formulářové chyby zůstávají inline.
- Všechny čtyři přímé Radix dependencies mají konzumenta. `Sheet` sdílí
  `Dialog` namísto duplicitní implementace; nepoužité imports ani druhé UI
  primitives pro stejný účel nebyly nalezeny.
- Admin layout zůstává serverový a klientská hranice je pouze v malém
  `ToastProvider`; serverová stránka služeb nebyla přesunuta pod `"use client"`.

## Follow-up

Žádný follow-up uvnitř uzavírané administrační Radix migrace. Záměrně
ponechané veřejné modaly a samostatné storno platby jsou v inventáři označeny
`INTENTIONALLY KEPT`, nikoli jako nedokončená část této migrace.
