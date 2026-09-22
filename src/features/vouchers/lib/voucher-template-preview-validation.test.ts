import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";
import {
  validateVoucherTemplatePreviewPng,
  VOUCHER_TEMPLATE_PREVIEW_LIMITS,
} from "./voucher-template-preview-validation";
import { validVoucherTemplatePreviewPng } from "./voucher-template-test-fixtures";

test("validator přijme skutečný PNG a odmítne nevalidní nebo nadlimitní obrázky", async () => {
  const jpeg = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
  const oversizedPng = await sharp({
    create: {
      width: VOUCHER_TEMPLATE_PREVIEW_LIMITS.maxWidth + 1,
      height: 1,
      channels: 3,
      background: "#ffffff",
    },
  }).png().toBuffer();
  const corruptPng = Buffer.from(validVoucherTemplatePreviewPng);
  const idatOffset = corruptPng.indexOf(Buffer.from("IDAT"));
  corruptPng[idatOffset + 4] ^= 0xff;

  assert.deepEqual(await validateVoucherTemplatePreviewPng(validVoucherTemplatePreviewPng), {
    ok: true,
    format: "png",
    width: 1,
    height: 1,
  });
  for (const buffer of [
    validVoucherTemplatePreviewPng.subarray(0, 8),
    validVoucherTemplatePreviewPng.subarray(0, validVoucherTemplatePreviewPng.length - 1),
    Buffer.from("random bytes"),
    corruptPng,
    jpeg,
    oversizedPng,
  ]) {
    const result = await validateVoucherTemplatePreviewPng(buffer);
    assert.equal(result.ok, false);
  }
});
