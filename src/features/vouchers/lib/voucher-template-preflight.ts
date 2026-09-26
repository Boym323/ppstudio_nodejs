import { PDFDocument } from "pdf-lib";

import { VOUCHER_PRINT_GEOMETRY } from "./voucher-template-layout";

const MM_TO_PT = 72 / 25.4;
const tolerancePt = MM_TO_PT * 0.35;
type PdfBox = { x: number; y: number; width: number; height: number };

export type VoucherTemplatePreflight = {
  pageCount: number;
  mediaBox: PdfBox | null;
  trimBox: PdfBox | null;
  bleedBox: PdfBox | null;
  rotation: number | null;
  encrypted: boolean;
  geometryValid: boolean;
  outputIntentPresent: boolean;
  pdfXClaim: string | null;
  pdfXVerification: "NOT VERIFIED";
  warnings: string[];
  errors: string[];
};

function close(a: number, b: number) { return Math.abs(a - b) <= tolerancePt; }
function isExpected(box: PdfBox, expected: PdfBox) { return close(box.x, expected.x) && close(box.y, expected.y) && close(box.width, expected.width) && close(box.height, expected.height); }
function getBox(page: { getMediaBox(): PdfBox; getTrimBox(): PdfBox; getBleedBox(): PdfBox }, kind: "media" | "trim" | "bleed") { return kind === "media" ? page.getMediaBox() : kind === "trim" ? page.getTrimBox() : page.getBleedBox(); }

export async function preflightVoucherTemplateMaster(bytes: Buffer): Promise<VoucherTemplatePreflight> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let pdf: PDFDocument;
  try { pdf = await PDFDocument.load(bytes, { ignoreEncryption: false }); } catch { return { pageCount: 0, mediaBox: null, trimBox: null, bleedBox: null, rotation: null, encrypted: false, geometryValid: false, outputIntentPresent: false, pdfXClaim: null, pdfXVerification: "NOT VERIFIED", warnings, errors: ["PDF nelze načíst nebo je chráněné heslem."] }; }
  const pageCount = pdf.getPageCount();
  if (pageCount !== 1) errors.push("Master musí mít právě jednu stránku.");
  const page = pageCount ? pdf.getPage(0) : null;
  const mediaBox = page ? getBox(page, "media") : null;
  const trimBox = page ? getBox(page, "trim") : null;
  const bleedBox = page ? getBox(page, "bleed") : null;
  const rotation = page ? normalizeRotation(page.getRotation().angle) : null;
  if (rotation !== null && rotation !== 0) errors.push(`Master PDF má nepodporovanou rotaci ${rotation}°. Použijte rotaci 0°.`);
  const expectedMedia = { x: 0, y: 0, width: VOUCHER_PRINT_GEOMETRY.widthMm * MM_TO_PT, height: VOUCHER_PRINT_GEOMETRY.heightMm * MM_TO_PT };
  const expectedTrim = { x: VOUCHER_PRINT_GEOMETRY.trimXmm * MM_TO_PT, y: VOUCHER_PRINT_GEOMETRY.trimYmm * MM_TO_PT, width: VOUCHER_PRINT_GEOMETRY.trimWidthMm * MM_TO_PT, height: VOUCHER_PRINT_GEOMETRY.trimHeightMm * MM_TO_PT };
  const geometryValid = Boolean(mediaBox && trimBox && bleedBox && isExpected(mediaBox, expectedMedia) && isExpected(trimBox, expectedTrim) && isExpected(bleedBox, expectedMedia));
  if (!geometryValid) errors.push("PDF nemá požadovaný MediaBox 216 × 105 mm, TrimBox 210 × 99 mm na offsetu 3 mm a BleedBox stránky.");
  const raw = bytes.toString("latin1");
  const outputIntentPresent = raw.includes("/OutputIntent");
  const pdfXClaim = /\/GTS_PDFXVersion\s*\(([^)]+)\)/.exec(raw)?.[1] ?? null;
  if (pdfXClaim) warnings.push(`Master deklaruje ${pdfXClaim}; finální PDF/X-4 conformity se dostupným rendererem neověřuje.`);
  if (!outputIntentPresent) warnings.push("Master neobsahuje rozpoznatelný OutputIntent/ICC profil.");
  return { pageCount, mediaBox, trimBox, bleedBox, rotation, encrypted: false, geometryValid, outputIntentPresent, pdfXClaim, pdfXVerification: "NOT VERIFIED", warnings, errors };
}

function normalizeRotation(angle: number) {
  return ((angle % 360) + 360) % 360;
}

export async function preflightFinalVoucherPrint(bytes: Uint8Array) {
  return preflightVoucherTemplateMaster(Buffer.from(bytes));
}
