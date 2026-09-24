export type ResizeCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

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
