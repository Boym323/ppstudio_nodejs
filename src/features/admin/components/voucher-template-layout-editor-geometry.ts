import { browserTopToPdfBottom, pdfBottomToBrowserTop, VOUCHER_PRINT_GEOMETRY } from "@/features/vouchers/lib/voucher-template-layout";
import { getVoucherTextBaselineRangeMm, type VoucherTextFitArea } from "@/features/vouchers/lib/voucher-text-fit";

export type ResizeCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
type AreaBounds = { xMm: number; yMm: number; widthMm: number; heightMm: number };
type BaselineArea = Pick<VoucherTextFitArea, "yMm" | "heightMm"> & { typography: Pick<VoucherTextFitArea["typography"], "minFontSizePt"> };
export const KEYBOARD_NUDGE_MM = 0.1;
export const KEYBOARD_NUDGE_LARGE_MM = 1;

/** UI positions measure the area's top-left corner from the final trim. */
export function internalToUiPosition(area: Pick<AreaBounds, "xMm" | "yMm" | "heightMm">) {
  const trimTopMm = pdfBottomToBrowserTop(VOUCHER_PRINT_GEOMETRY.trimYmm, VOUCHER_PRINT_GEOMETRY.trimHeightMm);
  return { xMm: area.xMm - VOUCHER_PRINT_GEOMETRY.trimXmm, yMm: pdfBottomToBrowserTop(area.yMm, area.heightMm) - trimTopMm };
}

export function uiToInternalPosition(position: { xMm: number; yMm: number }, heightMm: number) {
  const trimTopMm = pdfBottomToBrowserTop(VOUCHER_PRINT_GEOMETRY.trimYmm, VOUCHER_PRINT_GEOMETRY.trimHeightMm);
  return { xMm: position.xMm + VOUCHER_PRINT_GEOMETRY.trimXmm, yMm: browserTopToPdfBottom(position.yMm + trimTopMm, heightMm) };
}

export function updateAreaFromUi(area: AreaBounds, field: keyof AreaBounds, value: number, minimumMm: number, lockAspectRatio: boolean) {
  const next = { ...internalToUiPosition(area), widthMm: area.widthMm, heightMm: area.heightMm, [field]: Math.round(value * 10) / 10 };
  if (field === "widthMm" || field === "heightMm") {
    next[field] = Math.max(minimumMm, next[field]);
    if (lockAspectRatio) next.widthMm = next.heightMm = Math.min(next[field], VOUCHER_PRINT_GEOMETRY.trimWidthMm, VOUCHER_PRINT_GEOMETRY.trimHeightMm);
  }
  const internal = uiToInternalPosition(next, next.heightMm);
  return constrainAreaToTrim({
    widthMm: next.widthMm,
    heightMm: next.heightMm,
    xMm: field === "xMm" ? internal.xMm : area.xMm,
    yMm: field === "yMm" || next.heightMm !== area.heightMm ? internal.yMm : area.yMm,
  });
}

export function centerAreaInTrim(area: AreaBounds, axis: "horizontal" | "vertical") {
  const trim = VOUCHER_PRINT_GEOMETRY;
  return constrainAreaToTrim({
    ...area,
    ...(axis === "horizontal" ? { xMm: trim.trimXmm + (trim.trimWidthMm - area.widthMm) / 2 } : { yMm: trim.trimYmm + (trim.trimHeightMm - area.heightMm) / 2 }),
  });
}

export function nudgeAreaInTrim(area: AreaBounds, direction: string, largeStep = false) {
  const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[direction];
  if (!delta) return null;
  const step = largeStep ? KEYBOARD_NUDGE_LARGE_MM : KEYBOARD_NUDGE_MM;
  return constrainAreaToTrim({
    ...area,
    xMm: Number((area.xMm + delta[0] * step).toFixed(10)),
    yMm: Number((area.yMm + delta[1] * step).toFixed(10)),
  });
}

export function constrainAreaToTrim(area: { xMm: number; yMm: number; widthMm: number; heightMm: number }) {
  const trim = VOUCHER_PRINT_GEOMETRY;
  const widthMm = Math.min(area.widthMm, trim.trimWidthMm);
  const heightMm = Math.min(area.heightMm, trim.trimHeightMm);
  return {
    widthMm,
    heightMm,
    xMm: Math.max(trim.trimXmm, Math.min(area.xMm, trim.trimXmm + trim.trimWidthMm - widthMm)),
    yMm: Math.max(trim.trimYmm, Math.min(area.yMm, trim.trimYmm + trim.trimHeightMm - heightMm)),
  };
}

export function snapToHalfMm(value: number) {
  return Math.round(value * 2) / 2;
}

export function getLockedResizeSize(widthMm: number, heightMm: number, minimumMm: number) {
  return Math.max(minimumMm, snapToHalfMm(Math.min(widthMm, heightMm)));
}

export function getResizeAnchor(
  area: Pick<{ xMm: number; yMm: number; widthMm: number; heightMm: number }, "xMm" | "yMm" | "widthMm" | "heightMm">,
  direction: string,
  widthMm: number,
  heightMm: number,
) {
  const rightMm = area.xMm + area.widthMm;
  const topMm = area.yMm + area.heightMm;

  if (direction === "bottomRight") return { xMm: area.xMm, yMm: topMm - heightMm };
  if (direction === "bottomLeft") return { xMm: rightMm - widthMm, yMm: topMm - heightMm };
  if (direction === "topRight") return { xMm: area.xMm, yMm: area.yMm };
  if (direction === "topLeft") return { xMm: rightMm - widthMm, yMm: area.yMm };
  return null;
}

/**
 * Keep a text baseline at the same relative distance from the area's top edge
 * when the area itself moves or changes height.
 */
export function getBaselineWithPreservedTopOffset(
  area: BaselineArea & { baselineMm: number },
  yMm: number,
  heightMm: number,
) {
  const topOffsetMm = area.yMm + area.heightMm - area.baselineMm;
  const baselineMm = yMm + heightMm - topOffsetMm;
  return constrainBaselineToArea({ ...area, yMm, heightMm }, baselineMm);
}

export function constrainBaselineToArea(
  area: BaselineArea,
  baselineMm: number,
) {
  // Preserve every baseline at which the permitted minimum can fit. Reserving
  // preferredFontSizePt or maxLines here would move otherwise valid layouts.
  const { minBaselineMm, maxBaselineMm } = getVoucherTextBaselineRangeMm(area, area.typography.minFontSizePt);
  if (minBaselineMm > maxBaselineMm) {
    // There is no safe baseline. Keep storage geometry valid; the editor must
    // report the insufficient height instead of silently lowering the font.
    return Math.min(area.yMm + area.heightMm, Math.max(area.yMm, baselineMm));
  }
  return Math.min(maxBaselineMm, Math.max(minBaselineMm, baselineMm));
}
