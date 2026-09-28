import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import { PDFDocument, PDFName, PDFString } from "pdf-lib";

import { ensurePrintPdfMetadata, inspectIccProfile, inspectPdfPrepressMetadata } from "../src/features/vouchers/lib/voucher-pdf-prepress.ts";

const [sourcePath, profilePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !profilePath || !outputPath) {
  console.error("Použití: node --conditions=react-server --import tsx scripts/prepare-voucher-classic-v2.mjs source.pdf profile.icc output.pdf");
  process.exit(2);
}

const sourceBytes = await readFile(sourcePath);
const profileBytes = await readFile(profilePath);
const profile = inspectIccProfile(profileBytes);
if (!profile.valid) throw new Error(`ICC profil neprošel strukturální kontrolou: ${profile.errors.join("; ")}`);

const pdf = await PDFDocument.load(sourceBytes, { updateMetadata: false });
const profileRef = pdf.context.register(pdf.context.stream(profileBytes, { N: 4 }));
const outputIntent = pdf.context.obj({
  Type: "OutputIntent",
  S: "GTS_PDFX",
  OutputConditionIdentifier: PDFString.of(profile.description ?? "Fujifilm Revoria ColorPoint uncoated"),
  Info: PDFString.of(profile.description ?? "Fujifilm Revoria ColorPoint uncoated"),
  DestOutputProfile: profileRef,
});
pdf.catalog.set(PDFName.of("OutputIntents"), pdf.context.obj([pdf.context.register(outputIntent)]));
ensurePrintPdfMetadata(pdf);

const outputBytes = Buffer.from(await pdf.save({ useObjectStreams: false }));
Buffer.from("%PDF-1.7").copy(outputBytes, 0);
const inspection = inspectPdfPrepressMetadata(await PDFDocument.load(outputBytes, { updateMetadata: false }));
if (!inspection.outputIntent.valid || !inspection.xmp.valid || inspection.pdfXConformanceInfoPresent) {
  throw new Error("Nový classic-v2 master neprošel prepress metadata kontrolou.");
}

await writeFile(outputPath, outputBytes);
console.log(JSON.stringify({
  outputPath,
  pdfBytes: outputBytes.length,
  pdfSha256: createHash("sha256").update(outputBytes).digest("hex"),
  profileSha256: createHash("sha256").update(profileBytes).digest("hex"),
  outputConditionIdentifier: profile.description,
  pdfXVersion: inspection.xmp.claim,
}, null, 2));
