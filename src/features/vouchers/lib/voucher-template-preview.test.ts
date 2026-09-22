import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { PDFDocument } from "pdf-lib";
import { VoucherTemplateDomainError } from "./voucher-template-errors";
import { renderVoucherTemplatePreview, VOUCHER_TEMPLATE_PREVIEW_LIMITS } from "./voucher-template-preview";
import { validateVoucherTemplatePreviewPng } from "./voucher-template-preview-validation";

test("renderer vrací PNG v limitu a odmítne extrémně velký canvas", async () => {
  const master = await readFile(path.join(process.cwd(), "src", "features", "vouchers", "bootstrap-assets", "classic-v1.pdf"));
  const preview = await renderVoucherTemplatePreview(master);
  assert.deepEqual([...preview.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const width = preview.readUInt32BE(16);
  const height = preview.readUInt32BE(20);
  assert.ok(width <= VOUCHER_TEMPLATE_PREVIEW_LIMITS.maxWidth);
  assert.ok(height <= VOUCHER_TEMPLATE_PREVIEW_LIMITS.maxHeight);
  assert.ok(width * height <= VOUCHER_TEMPLATE_PREVIEW_LIMITS.maxPixels);
  assert.equal((await validateVoucherTemplatePreviewPng(preview)).ok, true);

  const hugePdf = await PDFDocument.create();
  hugePdf.addPage([2000, 2000]);
  const hugePdfBytes = Buffer.from(await hugePdf.save());
  await assert.rejects(
    () => renderVoucherTemplatePreview(hugePdfBytes),
    (error: unknown) => error instanceof VoucherTemplateDomainError && error.code === "MASTER_INVALID" && error.message.includes("příliš velké"),
  );
});
