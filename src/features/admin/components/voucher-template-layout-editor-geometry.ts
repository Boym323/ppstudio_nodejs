import { VOUCHER_PRINT_GEOMETRY } from "@/features/vouchers/lib/voucher-template-layout";

export type ResizeCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

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
  area: Pick<{ yMm: number; heightMm: number; baselineMm: number }, "yMm" | "heightMm" | "baselineMm">,
  yMm: number,
  heightMm: number,
) {
  const topOffsetMm = area.yMm + area.heightMm - area.baselineMm;
  return yMm + heightMm - topOffsetMm;
}
