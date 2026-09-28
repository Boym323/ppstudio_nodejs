import { readFile } from "node:fs/promises";

import { PDFDict, PDFDocument, PDFName, PDFStream } from "pdf-lib";

import { inspectPdfPrepressMetadata } from "../src/features/vouchers/lib/voucher-pdf-prepress.ts";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Použití: npm run voucher:pdf:inspect -- file.pdf");
  process.exit(2);
}

const mm = (value) => value * 25.4 / 72;
const formatBox = (box) => `${mm(box.width).toFixed(2)}×${mm(box.height).toFixed(2)} mm @ ${mm(box.x).toFixed(2)}×${mm(box.y).toFixed(2)} mm`;

let pdf;
try {
  pdf = await PDFDocument.load(await readFile(filePath), { ignoreEncryption: true, updateMetadata: false });
} catch (error) {
  console.error(`PDF nelze načíst: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const metadata = inspectPdfPrepressMetadata(pdf);
const pages = pdf.getPages();
const objects = pdf.context.enumerateIndirectObjects();
const streams = objects.filter(([, object]) => object instanceof PDFStream);
const images = streams.filter(([, object]) => object.dict.lookupMaybe(PDFName.of("Subtype"), PDFName)?.asString() === "/Image");
const embeddedFontStreams = streams.filter(([, object]) => object.dict.get(PDFName.of("Length1")) || object.dict.get(PDFName.of("FontFile")) || object.dict.get(PDFName.of("FontFile2")) || object.dict.get(PDFName.of("FontFile3")));
const fontDictionaries = objects.filter(([, object]) => object instanceof PDFDict && object.lookupMaybe(PDFName.of("Type"), PDFName)?.asString() === "/Font");
const bytes = await readFile(filePath);
const first = pages[0];
const geometryValid = pages.length > 0 && pages.every((page) => {
  const media = page.getMediaBox();
  const trim = page.getTrimBox();
  const bleed = page.getBleedBox();
  const crop = page.getCropBox();
  return Math.abs(mm(media.width) - 216) < 0.01
    && Math.abs(mm(media.height) - 105) < 0.01
    && Math.abs(mm(crop.width) - 216) < 0.01
    && Math.abs(mm(crop.height) - 105) < 0.01
    && Math.abs(mm(bleed.width) - 216) < 0.01
    && Math.abs(mm(bleed.height) - 105) < 0.01
    && Math.abs(mm(trim.x) - 3) < 0.01
    && Math.abs(mm(trim.y) - 3) < 0.01
    && Math.abs(mm(trim.width) - 210) < 0.01
    && Math.abs(mm(trim.height) - 99) < 0.01
    && page.getRotation().angle === 0;
});
const pass = !pdf.isEncrypted && geometryValid && metadata.outputIntent.valid && metadata.xmp.valid;

console.log(`Pages: ${pages.length}`);
console.log(`PDF version: ${bytes.subarray(0, 12).toString("latin1").match(/^%PDF-(\d\.\d)/)?.[1] ?? "unknown"}`);
console.log(`MediaBox: ${first ? formatBox(first.getMediaBox()) : "missing"}`);
console.log(`TrimBox: ${first ? formatBox(first.getTrimBox()) : "missing"}`);
console.log(`BleedBox: ${first ? formatBox(first.getBleedBox()) : "missing"}`);
console.log(`CropBox: ${first ? formatBox(first.getCropBox()) : "missing"}`);
console.log(`Rotation: ${pages.every((page) => page.getRotation().angle === 0) ? "PASS" : "FAIL"}`);
console.log(`OutputIntent: ${metadata.outputIntent.valid ? "PASS" : "FAIL"} (${metadata.outputIntent.count})`);
console.log(`ICC profile: ${metadata.outputIntent.profileValid ? "PASS" : "FAIL"}${metadata.outputIntent.outputConditionIdentifier ? ` (${metadata.outputIntent.outputConditionIdentifier})` : ""}`);
console.log(`PDF/X declaration: ${metadata.xmp.claim ?? "missing"}`);
console.log(`PDF/X structural checks: ${pass ? "PASS" : "FAIL"}`);
console.log(`Fonts: ${fontDictionaries.length} dictionaries, ${embeddedFontStreams.length} embedded streams`);
console.log(`Images: ${images.length}`);
console.log(`File size: ${bytes.length} bytes`);
console.log(`ICC streams: ${objects.filter(([, object]) => object instanceof PDFStream && object.dict.get(PDFName.of("N"))).length}`);
console.log(`PDF objects: ${objects.length}, streams: ${streams.length}`);
console.log(`RESULT: ${pass ? "PASS" : "FAIL"}`);

if (!pass) process.exitCode = 1;
