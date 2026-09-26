import assert from "node:assert/strict";
import test from "node:test";

import { PDFDocument, degrees } from "pdf-lib";

import { VOUCHER_PRINT_GEOMETRY } from "./voucher-template-layout";
import { preflightVoucherTemplateMaster } from "./voucher-template-preflight";

const mm = (value: number) => value * 72 / 25.4;

async function makeMaster(rotation: number) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([mm(VOUCHER_PRINT_GEOMETRY.widthMm), mm(VOUCHER_PRINT_GEOMETRY.heightMm)]);
  page.setTrimBox(
    mm(VOUCHER_PRINT_GEOMETRY.trimXmm),
    mm(VOUCHER_PRINT_GEOMETRY.trimYmm),
    mm(VOUCHER_PRINT_GEOMETRY.trimWidthMm),
    mm(VOUCHER_PRINT_GEOMETRY.trimHeightMm),
  );
  page.setBleedBox(0, 0, mm(VOUCHER_PRINT_GEOMETRY.widthMm), mm(VOUCHER_PRINT_GEOMETRY.heightMm));
  page.setRotation(degrees(rotation));
  return Buffer.from(await pdf.save());
}

test("preflight masteru přijme efektivní Rotate 0", async () => {
  const result = await preflightVoucherTemplateMaster(await makeMaster(0));

  assert.equal(result.rotation, 0);
  assert.deepEqual(result.errors, []);
});

test("preflight masteru odmítne Rotate 180", async () => {
  const result = await preflightVoucherTemplateMaster(await makeMaster(180));

  assert.equal(result.rotation, 180);
  assert.match(result.errors.join(" "), /nepodporovanou rotaci 180/);
});
