import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFObjectCopier,
  PDFRawStream,
  PDFStream,
  PDFString,
  decodePDFRawStream,
} from "pdf-lib";

const OUTPUT_INTENTS = PDFName.of("OutputIntents");
const OUTPUT_INTENT = PDFName.of("OutputIntent");
const METADATA = PDFName.of("Metadata");
const TYPE = PDFName.of("Type");
const SUBTYPE = PDFName.of("Subtype");
const XML = PDFName.of("XML");
const PDF_X4_VERSION = "PDF/X-4:2010";

export type PdfOutputIntentInspection = {
  present: boolean;
  valid: boolean;
  count: number;
  profilePresent: boolean;
  profileValid: boolean;
  outputConditionIdentifier: string | null;
  info: string | null;
};

export type PdfXmpInspection = {
  present: boolean;
  valid: boolean;
  claim: string | null;
  raw: string | null;
};

export type PdfPrepressMetadataInspection = {
  outputIntent: PdfOutputIntentInspection;
  xmp: PdfXmpInspection;
};

function getCatalogArray(pdf: PDFDocument) {
  return pdf.catalog.lookupMaybe(OUTPUT_INTENTS, PDFArray);
}

function getStringValue(value: PDFString | PDFHexString | undefined) {
  return value?.decodeText() ?? null;
}

function decodeStream(stream: PDFStream) {
  try {
    if (stream instanceof PDFRawStream) return decodePDFRawStream(stream).decode();
    return stream.getContents();
  } catch {
    return null;
  }
}

function getStreamType(stream: PDFStream, key: PDFName) {
  return stream.dict.lookupMaybe(key, PDFName);
}

/** Reads document-level prepress objects through pdf-lib's parsed object graph. */
export function inspectPdfPrepressMetadata(pdf: PDFDocument): PdfPrepressMetadataInspection {
  const outputIntents = getCatalogArray(pdf);
  let validIntent: PDFDict | undefined;
  let profilePresent = false;
  let profileValid = false;
  let outputConditionIdentifier: string | null = null;
  let info: string | null = null;

  if (outputIntents) {
    for (let index = 0; index < outputIntents.size(); index += 1) {
      const intent = pdf.context.lookupMaybe(outputIntents.get(index), PDFDict);
      if (!intent) continue;

      const type = intent.lookupMaybe(TYPE, PDFName)?.asString();
      const subtype = intent.lookupMaybe(PDFName.of("S"), PDFName)?.asString();
      const profile = pdf.context.lookupMaybe(intent.get(PDFName.of("DestOutputProfile")), PDFStream);
      const profileN = profile?.dict.lookupMaybe(PDFName.of("N"), PDFNumber)?.asNumber();
      const profileBytes = profile ? decodeStream(profile) : null;
      const hasProfile = Boolean(profile);
      const hasValidProfile = Boolean(profile && profileN && profileN >= 1 && profileN <= 4 && profileBytes && profileBytes.length > 0);

      if (type === OUTPUT_INTENT.asString() && subtype === "/GTS_PDFX" && hasProfile && hasValidProfile && !validIntent) {
        validIntent = intent;
        profilePresent = true;
        profileValid = true;
        outputConditionIdentifier = getStringValue(intent.lookupMaybe(PDFName.of("OutputConditionIdentifier"), PDFString, PDFHexString));
        info = getStringValue(intent.lookupMaybe(PDFName.of("Info"), PDFString, PDFHexString));
      } else if (hasProfile) {
        profilePresent = true;
        profileValid ||= hasValidProfile;
      }
    }
  }

  const outputIntent: PdfOutputIntentInspection = {
    present: Boolean(outputIntents && outputIntents.size() > 0),
    valid: Boolean(validIntent),
    count: outputIntents?.size() ?? 0,
    profilePresent,
    profileValid,
    outputConditionIdentifier,
    info,
  };

  const metadata = pdf.context.lookupMaybe(pdf.catalog.get(METADATA), PDFStream);
  const metadataType = metadata ? getStreamType(metadata, TYPE)?.asString() : undefined;
  const metadataSubtype = metadata ? getStreamType(metadata, SUBTYPE)?.asString() : undefined;
  const metadataBytes = metadata ? decodeStream(metadata) : null;
  const raw = metadataBytes ? Buffer.from(metadataBytes).toString("utf8") : null;
  const claim = raw
    ? /<[^>]*GTS_PDFXVersion[^>]*>([^<]+)</i.exec(raw)?.[1]?.trim()
      ?? /GTS_PDFXVersion\s*=\s*["']([^"']+)["']/i.exec(raw)?.[1]?.trim()
      ?? null
    : null;

  const xmp: PdfXmpInspection = {
    present: Boolean(metadata && metadataType === "/Metadata" && metadataSubtype === XML.asString() && raw),
    valid: Boolean(metadata && metadataType === "/Metadata" && metadataSubtype === XML.asString() && claim?.startsWith("PDF/X-4")),
    claim,
    raw,
  };

  return { outputIntent, xmp };
}

function buildPdfX4Xmp() {
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="PP Studio pdf-lib prepress">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/">
      <pdfxid:GTS_PDFXVersion>${PDF_X4_VERSION}</pdfxid:GTS_PDFXVersion>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function setPdfX4Metadata(pdf: PDFDocument) {
  const stream = pdf.context.stream(Buffer.from(buildPdfX4Xmp(), "utf8"), {
    Type: "Metadata",
    Subtype: "XML",
  });
  pdf.catalog.set(METADATA, pdf.context.register(stream));
}

/**
 * Copies catalog OutputIntents without copying page resources a second time.
 * The optional copier must be shared with page copying for STOCK exports.
 */
export function applyPdfOutputIntent(
  source: PDFDocument,
  destination: PDFDocument,
  copier = source === destination ? undefined : PDFObjectCopier.for(source.context, destination.context),
) {
  const outputIntents = getCatalogArray(source);
  if (!outputIntents) return inspectPdfPrepressMetadata(destination).outputIntent;

  const copied = source === destination ? outputIntents : copier!.copy(outputIntents);
  destination.catalog.set(OUTPUT_INTENTS, copied);
  return inspectPdfPrepressMetadata(destination).outputIntent;
}

/**
 * Ensures that a print document carries the master's real OutputIntent and a
 * matching PDF/X-4 XMP packet. It never invents an ICC profile when the master
 * does not provide a structurally usable one.
 */
export function ensurePrintPdfMetadata(
  document: PDFDocument,
  master: PDFDocument = document,
  copier?: PDFObjectCopier,
) {
  const sourceInspection = inspectPdfPrepressMetadata(master);
  applyPdfOutputIntent(master, document, copier);
  if (sourceInspection.outputIntent.valid) setPdfX4Metadata(document);
  return inspectPdfPrepressMetadata(document);
}

export const PDF_X4_DECLARATION = PDF_X4_VERSION;
