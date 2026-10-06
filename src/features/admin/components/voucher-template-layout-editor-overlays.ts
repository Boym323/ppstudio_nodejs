import { pdfBottomToBrowserTop, VOUCHER_PRINT_GEOMETRY } from "@/features/vouchers/lib/voucher-template-layout";

export function getVoucherEditorOverlayState({ showGuides, showBleed, isInteracting }: { showGuides: boolean; showBleed: boolean; isInteracting: boolean }) {
  return {
    guidesVisible: showGuides,
    guidesEmphasized: showGuides && isInteracting,
    bleedVisible: showBleed,
  };
}

// Visual orientation only; this inset does not constrain placement or printing.
const SAFE_ZONE_INSET_MM = 3;

export function getVoucherEditorGuideGeometry() {
  const geometry = VOUCHER_PRINT_GEOMETRY;
  const trim = { leftMm: geometry.trimXmm, topMm: pdfBottomToBrowserTop(geometry.trimYmm, geometry.trimHeightMm), widthMm: geometry.trimWidthMm, heightMm: geometry.trimHeightMm };
  return {
    trim,
    safe: { leftMm: trim.leftMm + SAFE_ZONE_INSET_MM, topMm: trim.topMm + SAFE_ZONE_INSET_MM, widthMm: trim.widthMm - 2 * SAFE_ZONE_INSET_MM, heightMm: trim.heightMm - 2 * SAFE_ZONE_INSET_MM },
    center: { xMm: trim.leftMm + trim.widthMm / 2, yMm: trim.topMm + trim.heightMm / 2 },
    safeInsetMm: SAFE_ZONE_INSET_MM,
  };
}
