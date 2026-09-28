import { PDFDocument } from "pdf-lib";

import { inspectPdfPrepressMetadata } from "./voucher-pdf-prepress";
import { VOUCHER_PRINT_GEOMETRY } from "./voucher-template-layout";

const MM_TO_PT = 72 / 25.4;
const tolerancePt = MM_TO_PT * 0.35;
type PdfBox = { x: number; y: number; width: number; height: number };
type PdfPreflightMode = "MASTER" | "FINAL_PRINT";

export type PdfXVerification = "DECLARED" | "STRUCTURALLY_VALIDATED" | "EXTERNALLY_VERIFIED";

export type VoucherTemplatePreflight = {
  pageCount: number;
  mediaBox: PdfBox | null;
  cropBox: PdfBox | null;
  trimBox: PdfBox | null;
  bleedBox: PdfBox | null;
  rotation: number | null;
  encrypted: boolean;
  geometryValid: boolean;
  pageGeometryValid: boolean;
  outputIntentPresent: boolean;
  outputIntentValid: boolean;
  iccProfilePresent: boolean;
  iccProfileValid: boolean;
  outputConditionIdentifier: string | null;
  pdfXClaim: string | null;
  pdfXMetadataPresent: boolean;
  pdfXMetadataValid: boolean;
  pdfXVerification: PdfXVerification;
  warnings: string[];
  errors: string[];
};

function close(a: number, b: number) {
  return Math.abs(a - b) <= tolerancePt;
}

function isExpected(box: PdfBox, expected: PdfBox) {
  return close(box.x, expected.x) && close(box.y, expected.y) && close(box.width, expected.width) && close(box.height, expected.height);
}

function normalizeRotation(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function emptyPreflight(overrides: Partial<VoucherTemplatePreflight> = {}): VoucherTemplatePreflight {
  return {
    pageCount: 0,
    mediaBox: null,
    cropBox: null,
    trimBox: null,
    bleedBox: null,
    rotation: null,
    encrypted: false,
    geometryValid: false,
    pageGeometryValid: false,
    outputIntentPresent: false,
    outputIntentValid: false,
    iccProfilePresent: false,
    iccProfileValid: false,
    outputConditionIdentifier: null,
    pdfXClaim: null,
    pdfXMetadataPresent: false,
    pdfXMetadataValid: false,
    pdfXVerification: "DECLARED",
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function formatBox(name: string, box: PdfBox | null) {
  return box
    ? `${name} ${[box.x, box.y, box.width, box.height].map((value) => (value / MM_TO_PT).toFixed(2)).join(" × ")} mm`
    : `${name} chybí`;
}

async function inspectVoucherPdf(bytes: Buffer, mode: PdfPreflightMode, expectedPageCount?: number): Promise<VoucherTemplatePreflight> {
  let pdf: PDFDocument;
  try {
    // ignoreEncryption lets us report encryption explicitly instead of
    // collapsing it into the generic invalid-PDF error.
    pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    return emptyPreflight({ errors: ["PDF nelze načíst nebo je neplatné."] });
  }

  if (pdf.isEncrypted) return emptyPreflight({ encrypted: true, errors: ["PDF je zašifrované; tiskové PDF nesmí být šifrované."] });

  const pageCount = pdf.getPageCount();
  const errors: string[] = [];
  const warnings: string[] = [];
  const expectedPageCountForMode = mode === "MASTER" ? 1 : expectedPageCount;
  if (expectedPageCountForMode !== undefined && pageCount !== expectedPageCountForMode) {
    errors.push(`${mode === "MASTER" ? "Master" : "Finální tiskové PDF"} má mít ${expectedPageCountForMode} ${expectedPageCountForMode === 1 ? "stránku" : "stránky"}, zjištěno ${pageCount}.`);
  }
  if (pageCount === 0) errors.push("PDF nemá žádnou stránku.");

  const expectedMedia = { x: 0, y: 0, width: VOUCHER_PRINT_GEOMETRY.widthMm * MM_TO_PT, height: VOUCHER_PRINT_GEOMETRY.heightMm * MM_TO_PT };
  const expectedTrim = { x: VOUCHER_PRINT_GEOMETRY.trimXmm * MM_TO_PT, y: VOUCHER_PRINT_GEOMETRY.trimYmm * MM_TO_PT, width: VOUCHER_PRINT_GEOMETRY.trimWidthMm * MM_TO_PT, height: VOUCHER_PRINT_GEOMETRY.trimHeightMm * MM_TO_PT };
  const pages = Array.from({ length: pageCount }, (_, index) => pdf.getPage(index));
  const firstPage = pages[0];
  const mediaBox = firstPage?.getMediaBox() ?? null;
  const cropBox = firstPage?.getCropBox() ?? null;
  const trimBox = firstPage?.getTrimBox() ?? null;
  const bleedBox = firstPage?.getBleedBox() ?? null;
  const rotation = firstPage ? normalizeRotation(firstPage.getRotation().angle) : null;
  const pageGeometryValid = pages.length > 0 && pages.every((page) => {
    const pageRotation = normalizeRotation(page.getRotation().angle);
    return pageRotation === 0
      && isExpected(page.getMediaBox(), expectedMedia)
      && isExpected(page.getCropBox(), expectedMedia)
      && isExpected(page.getBleedBox(), expectedMedia)
      && isExpected(page.getTrimBox(), expectedTrim);
  });
  const geometryValid = pageGeometryValid;

  if (pages.some((page) => normalizeRotation(page.getRotation().angle) !== 0)) {
    errors.push(`PDF má nepodporovanou rotaci ${rotation ?? "?"}°. Použijte rotaci 0°.`);
  }
  if (!geometryValid) {
    errors.push(`PDF nemá požadovanou geometrii (MediaBox/CropBox/BleedBox 216 × 105 mm, TrimBox 210 × 99 mm na offsetu 3 mm). Zjištěno: ${formatBox("MediaBox", mediaBox)}, ${formatBox("CropBox", cropBox)}, ${formatBox("TrimBox", trimBox)}, ${formatBox("BleedBox", bleedBox)}.`);
  }

  const metadata = inspectPdfPrepressMetadata(pdf);
  if (!metadata.outputIntent.present) errors.push("PDF nemá dokumentový OutputIntent.");
  else if (!metadata.outputIntent.valid) errors.push("PDF má neúplný OutputIntent; musí obsahovat /S /GTS_PDFX a DestOutputProfile s ICC streamem.");
  if (!metadata.outputIntent.profilePresent) errors.push("PDF nemá DestOutputProfile/ICC profil.");
  else if (!metadata.outputIntent.profileValid) errors.push("DestOutputProfile není platný ICC stream.");
  if (!metadata.xmp.present) errors.push("PDF nemá katalogová PDF/X XMP metadata.");
  else if (!metadata.xmp.valid) errors.push("PDF/X XMP metadata nedeklarují PDF/X-4.");

  if (metadata.xmp.claim && !metadata.xmp.valid) warnings.push(`PDF obsahuje deklaraci ${metadata.xmp.claim}, ale neprošla interní kontrolou.`);
  if (metadata.outputIntent.outputConditionIdentifier) warnings.push(`Output condition: ${metadata.outputIntent.outputConditionIdentifier}.`);

  const structurallyValid = errors.length === 0;
  const pdfXVerification: PdfXVerification = structurallyValid ? "STRUCTURALLY_VALIDATED" : "DECLARED";

  return {
    pageCount,
    mediaBox,
    cropBox,
    trimBox,
    bleedBox,
    rotation,
    encrypted: false,
    geometryValid,
    pageGeometryValid,
    outputIntentPresent: metadata.outputIntent.present,
    outputIntentValid: metadata.outputIntent.valid,
    iccProfilePresent: metadata.outputIntent.profilePresent,
    iccProfileValid: metadata.outputIntent.profileValid,
    outputConditionIdentifier: metadata.outputIntent.outputConditionIdentifier,
    pdfXClaim: metadata.xmp.claim,
    pdfXMetadataPresent: metadata.xmp.present,
    pdfXMetadataValid: metadata.xmp.valid,
    pdfXVerification,
    warnings,
    errors,
  };
}

export async function preflightVoucherTemplateMaster(bytes: Buffer): Promise<VoucherTemplatePreflight> {
  return inspectVoucherPdf(bytes, "MASTER");
}

export async function preflightFinalVoucherPrint(bytes: Uint8Array, expectedPageCount?: number) {
  return inspectVoucherPdf(Buffer.from(bytes), "FINAL_PRINT", expectedPageCount);
}
