import path from "node:path";

import { createCanvas } from "@napi-rs/canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { VoucherTemplateDomainError } from "./voucher-template-errors";
import { VOUCHER_TEMPLATE_PREVIEW_LIMITS } from "./voucher-template-preview-validation";

export { VOUCHER_TEMPLATE_PREVIEW_LIMITS } from "./voucher-template-preview-validation";

const RENDER_SCALE = 3;

function assertPreviewDimensions(width: number, height: number) {
  const pixels = width * height;
  if (
    !Number.isSafeInteger(width)
    || !Number.isSafeInteger(height)
    || width < 1
    || height < 1
    || width > VOUCHER_TEMPLATE_PREVIEW_LIMITS.maxWidth
    || height > VOUCHER_TEMPLATE_PREVIEW_LIMITS.maxHeight
    || !Number.isSafeInteger(pixels)
    || pixels > VOUCHER_TEMPLATE_PREVIEW_LIMITS.maxPixels
  ) {
    throw new VoucherTemplateDomainError("MASTER_INVALID", "PDF má příliš velké rozměry pro bezpečný náhled.");
  }
}

export async function renderVoucherTemplatePreview(master: Buffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(master),
    disableFontFace: true,
    standardFontDataUrl: `${path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts")}${path.sep}`,
    useSystemFonts: false,
  });
  const pdf = await loadingTask.promise;

  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    assertPreviewDimensions(width, height);
    const canvas = createCanvas(width, height);

    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    return canvas.toBuffer("image/png");
  } finally {
    await loadingTask.destroy();
  }
}
