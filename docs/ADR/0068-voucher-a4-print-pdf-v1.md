# ADR 0068: Voucher A4 print PDF v1

## Kontext
- Existující voucher PDF se používá pro běžné stažení v adminu i jako příloha voucher e-mailu.
- Pro fyzický tisk je potřeba samostatná A4 varianta, která nesmí změnit současný e-mailový ani běžný PDF layout.
- Tiskový arch A4 na výšku má voucher umístěný v horním vodorovném DL slotu 210 x 99 mm; samotný voucher je navržený jako DL portrait 99 x 210 mm a do slotu se vkládá otočený o 90 stupňů.

## Rozhodnutí
- Stávající `generateVoucherPdf(...)` zůstává beze změny a dál slouží e-mailu i běžnému stažení.
- Tisková varianta je samostatný worker-safe modul `src/features/vouchers/lib/voucher-print-a4-pdf-core.ts` s exportem `generateVoucherPrintA4Pdf(...)`.
- Modul definuje rozměrové konstanty v mm/pt, typ `VoucherPrintPosition = 1`, validaci horní pozice a helper `getVoucherPrintSlotBox(...)`.
- Portrait DL voucher se nejdřív vykreslí do samostatné 99 x 210 mm PDF stránky a do finální A4 stránky se vloží jako embedded page otočená o 90 stupňů.
- Admin má nové chráněné routy `/admin/vouchery/[voucherId]/pdf/tisk` a `/admin/provoz/vouchery/[voucherId]/pdf/tisk`; původní `/pdf` routy zůstávají zachované.
- Detail voucheru zobrazuje původní akci `Stáhnout voucher PDF` a vedle ní samostatný odkaz `Tisk A4`.

## Alternativy
- Přepsat současný voucher PDF layout: zamítnuto kvůli riziku regrese e-mailových příloh a běžného stažení.
- Kreslit A4 variantu stejnými souřadnicemi přímo v otočeném kontextu: odloženo, protože embedded portrait stránka dává jednodušší a testovatelnější izolaci souřadnic.
- Volitelné sloty na A4: zamítnuto po provozním upřesnění, protože smysl má pouze horní slot a zbytek A4 má zůstat čistý bez voucherového pozadí.

## Důsledky
- Tiskové PDF má vlastní layout a vlastní route handler; změny v něm nesmí měnit `generateVoucherPdf(...)`.
- Testy ověřují A4 rozměr, horní slot souřadnice, odmítnutí jiné pozice a dostupnost stávajícího generátoru.
- Tisková varianta používá stejné bezpečné voucher údaje, stejné logo helpery, QR ověření a kontakty ze `SiteSettings`.
- Do budoucna lze přidat hromadný A4 arch nebo jiné rozmístění, ale má to být samostatný export/endpoint, ne změna tohoto horního tiskového výstupu.

## Stav
- schváleno
