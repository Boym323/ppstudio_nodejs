import assert from "node:assert/strict";
import test from "node:test";

import { PDFDocument, PDFName, PDFString, degrees } from "pdf-lib";

import { VOUCHER_PRINT_GEOMETRY } from "./voucher-template-layout";
import { preflightVoucherTemplateMaster } from "./voucher-template-preflight";
import { ensurePrintPdfMetadata } from "./voucher-pdf-prepress";

const mm = (value: number) => value * 72 / 25.4;

// TEST ONLY: minimal deterministic ICC v4 CMYK header for structural tests.
function makeTestCmykIccProfile() {
  const bytes = Buffer.alloc(128);
  bytes.writeUInt32BE(bytes.length, 0);
  bytes[8] = 0x43;
  bytes.write("prtr", 12, "ascii");
  bytes.write("CMYK", 16, "ascii");
  bytes.write("XYZ ", 20, "ascii");
  bytes.write("acsp", 36, "ascii");
  return bytes;
}

async function makeMaster(rotation: number, withPrepress = true) {
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
  if (withPrepress) addTestOutputIntent(pdf);
  return Buffer.from(await pdf.save());
}

async function makeMasterWithoutExplicitBleedBox() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([mm(VOUCHER_PRINT_GEOMETRY.widthMm), mm(VOUCHER_PRINT_GEOMETRY.heightMm)]);
  page.setTrimBox(
    mm(VOUCHER_PRINT_GEOMETRY.trimXmm),
    mm(VOUCHER_PRINT_GEOMETRY.trimYmm),
    mm(VOUCHER_PRINT_GEOMETRY.trimWidthMm),
    mm(VOUCHER_PRINT_GEOMETRY.trimHeightMm),
  );
  addTestOutputIntent(pdf);
  return Buffer.from(await pdf.save());
}

function addTestOutputIntent(pdf: PDFDocument) {
  const profile = pdf.context.stream(makeTestCmykIccProfile(), { N: 4 });
  const profileRef = pdf.context.register(profile);
  const outputIntent = pdf.context.obj({
    Type: "OutputIntent",
    S: "GTS_PDFX",
    OutputConditionIdentifier: PDFString.of("Test CMYK"),
    DestOutputProfile: profileRef,
  });
  pdf.catalog.set(PDFName.of("OutputIntents"), pdf.context.obj([pdf.context.register(outputIntent)]));
  ensurePrintPdfMetadata(pdf);
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

test("preflight masteru přijme BleedBox odvozený z MediaBoxu", async () => {
  const result = await preflightVoucherTemplateMaster(await makeMasterWithoutExplicitBleedBox());

  assert.equal(result.geometryValid, true);
  assert.deepEqual(result.errors, []);
});

test("preflight masteru odmítne chybějící OutputIntent", async () => {
  const result = await preflightVoucherTemplateMaster(await makeMaster(0, false));

  assert.equal(result.outputIntentPresent, false);
  assert.equal(result.pdfXVerification, "DECLARED");
  assert.match(result.errors.join(" "), /OutputIntent/);
  assert.match(result.errors.join(" "), /XMP/);
});

test("preflight odmítne OutputIntent bez DestOutputProfile", async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([mm(VOUCHER_PRINT_GEOMETRY.widthMm), mm(VOUCHER_PRINT_GEOMETRY.heightMm)]);
  page.setTrimBox(mm(3), mm(3), mm(210), mm(99));
  page.setBleedBox(0, 0, mm(216), mm(105));
  const outputIntent = pdf.context.obj({ Type: "OutputIntent", S: "GTS_PDFX" });
  pdf.catalog.set(PDFName.of("OutputIntents"), pdf.context.obj([pdf.context.register(outputIntent)]));

  const result = await preflightVoucherTemplateMaster(Buffer.from(await pdf.save()));

  assert.equal(result.outputIntentPresent, true);
  assert.equal(result.outputIntentValid, false);
  assert.match(result.errors.join(" "), /DestOutputProfile/);
});

test("preflight finalu kontroluje všechny stránky a očekávaný počet", async () => {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < 2; index += 1) {
    const page = pdf.addPage([mm(VOUCHER_PRINT_GEOMETRY.widthMm), mm(VOUCHER_PRINT_GEOMETRY.heightMm)]);
    page.setCropBox(0, 0, mm(216), mm(105));
    page.setBleedBox(0, 0, mm(216), mm(105));
    page.setTrimBox(mm(3), mm(3), mm(210), mm(99));
  }
  addTestOutputIntent(pdf);
  const { preflightFinalVoucherPrint } = await import("./voucher-template-preflight");
  const result = await preflightFinalVoucherPrint(await pdf.save(), 3);

  assert.equal(result.pageCount, 2);
  assert.equal(result.geometryValid, true);
  assert.match(result.errors.join(" "), /3 strán/);
  assert.equal(result.pdfXVerification, "DECLARED");
});

test("preflight odmítne neplatné PDF", async () => {
  const result = await preflightVoucherTemplateMaster(Buffer.from("not a PDF"));

  assert.equal(result.geometryValid, false);
  assert.match(result.errors.join(" "), /nelze načíst/);
});
