import assert from "node:assert/strict";
import test from "node:test";

import { inspectIccProfile } from "./voucher-pdf-prepress";

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

test("ICC random bytes jsou neplatné", () => {
  const result = inspectIccProfile(Buffer.from("test ICC profile"));
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /128|acsp|CMYK/);
});

test("ICC příliš krátký stream je neplatný", () => {
  const result = inspectIccProfile(Buffer.alloc(127));
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /128/);
});

test("ICC bez acsp signature je neplatný", () => {
  const bytes = makeTestCmykIccProfile();
  bytes.write("xxxx", 36, "ascii");
  const result = inspectIccProfile(bytes);
  assert.equal(result.valid, false);
  assert.equal(result.signatureValid, false);
});

test("ICC deklarovaná velikost nesmí přesahovat data", () => {
  const bytes = makeTestCmykIccProfile();
  bytes.writeUInt32BE(bytes.length + 1, 0);
  const result = inspectIccProfile(bytes);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /přesahuje/);
});

test("ICC RGB profil je pro PP Studio tiskový contract neplatný", () => {
  const bytes = makeTestCmykIccProfile();
  bytes.write("RGB ", 16, "ascii");
  const result = inspectIccProfile(bytes);
  assert.equal(result.valid, false);
  assert.equal(result.colorSpace, "RGB ");
  assert.match(result.errors.join(" "), /CMYK/);
});

test("ICC TEST ONLY CMYK profil se strukturálně ověří", () => {
  const result = inspectIccProfile(makeTestCmykIccProfile());
  assert.equal(result.valid, true);
  assert.equal(result.declaredSize, 128);
  assert.equal(result.signatureValid, true);
  assert.equal(result.profileClass, "prtr");
  assert.equal(result.colorSpace, "CMYK");
  assert.equal(result.pcs, "XYZ ");
});

test("CMYK ICC profil s OutputIntent N != 4 musí být odmítnut", async () => {
  const { PDFDocument, PDFName, PDFString } = await import("pdf-lib");
  const { inspectPdfPrepressMetadata } = await import("./voucher-pdf-prepress");
  const pdf = await PDFDocument.create();
  pdf.addPage([100, 100]);
  const profileRef = pdf.context.register(pdf.context.stream(makeTestCmykIccProfile(), { N: 3 }));
  const intent = pdf.context.obj({
    Type: "OutputIntent",
    S: "GTS_PDFX",
    OutputConditionIdentifier: PDFString.of("TEST ONLY CMYK"),
    DestOutputProfile: profileRef,
  });
  pdf.catalog.set(PDFName.of("OutputIntents"), pdf.context.obj([pdf.context.register(intent)]));
  const inspected = inspectPdfPrepressMetadata(await PDFDocument.load(await pdf.save()));
  assert.equal(inspected.outputIntent.profilePresent, true);
  assert.equal(inspected.outputIntent.profileValid, false);
  assert.equal(inspected.outputIntent.valid, false);
});
