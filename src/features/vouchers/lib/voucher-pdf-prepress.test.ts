import assert from "node:assert/strict";
import test from "node:test";

import { PDFDocument, PDFName, PDFString } from "pdf-lib";

import { ensurePrintPdfMetadata, inspectIccProfile, inspectPdfPrepressMetadata } from "./voucher-pdf-prepress";

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

async function inspectXmpClaim(claim?: string, properties = ["GTS_PDFXVersion"]) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.addPage([100, 100]);
  const propertyMarkup = properties.map((property) => `<pdfxid:${property}>${property === "GTS_PDFXVersion" ? claim ?? "" : "PDF/X-4"}</pdfxid:${property}>`).join("");
  const xmp = `<?xpacket begin="\uFEFF"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/">${propertyMarkup}</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
  const metadata = pdf.context.stream(Buffer.from(xmp, "utf8"), { Type: "Metadata", Subtype: "XML" });
  pdf.catalog.set(PDFName.of("Metadata"), pdf.context.register(metadata));
  return inspectPdfPrepressMetadata(await PDFDocument.load(await pdf.save(), { updateMetadata: false }));
}

test("PDF/X-4 XMP identita přijímá přesně PDF/X-4", async () => {
  const inspected = await inspectXmpClaim("PDF/X-4");
  assert.equal(inspected.xmp.claim, "PDF/X-4");
  assert.equal(inspected.xmp.valid, true);
  assert.deepEqual(inspected.xmp.pdfxidProperties, ["GTS_PDFXVersion"]);
  assert.equal(inspected.xmp.hasConformanceProperty, false);
});

for (const claim of ["PDF/X-4:2010", "PDF/X-4p", "PDF/X-4-foo"]) {
  test(`PDF/X-4 XMP identita odmítá ${claim}`, async () => {
    const inspected = await inspectXmpClaim(claim);
    assert.equal(inspected.xmp.valid, false);
  });
}

test("PDF/X-4 XMP identita odmítá chybějící GTS_PDFXVersion", async () => {
  const inspected = await inspectXmpClaim(undefined, []);
  assert.equal(inspected.xmp.claim, null);
  assert.equal(inspected.xmp.valid, false);
});

test("PDF/X-4 XMP nepřidává conformance property ani Info key", async () => {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.addPage([100, 100]);
  const profileRef = pdf.context.register(pdf.context.stream(makeTestCmykIccProfile(), { N: 4 }));
  const intent = pdf.context.obj({ Type: "OutputIntent", S: "GTS_PDFX", OutputConditionIdentifier: PDFString.of("TEST ONLY CMYK"), DestOutputProfile: profileRef });
  pdf.catalog.set(PDFName.of("OutputIntents"), pdf.context.obj([pdf.context.register(intent)]));
  ensurePrintPdfMetadata(pdf);
  const inspected = inspectPdfPrepressMetadata(await PDFDocument.load(await pdf.save(), { updateMetadata: false }));
  assert.deepEqual(inspected.xmp.pdfxidProperties, ["GTS_PDFXVersion"]);
  assert.equal(inspected.xmp.hasConformanceProperty, false);
  assert.equal(inspected.pdfXConformanceInfoPresent, false);
});
