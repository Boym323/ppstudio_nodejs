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
const PDF_X4_VERSION = "PDF/X-4";

export type PdfOutputIntentInspection = {
  present: boolean;
  valid: boolean;
  count: number;
  profilePresent: boolean;
  profileValid: boolean;
  outputConditionIdentifier: string | null;
  info: string | null;
  iccProfile: IccProfileInspection | null;
};

export type IccProfileInspection = {
  valid: boolean;
  declaredSize: number | null;
  signatureValid: boolean;
  profileClass: string | null;
  colorSpace: string | null;
  pcs: string | null;
  version: string | null;
  description: string | null;
  copyright: string | null;
  manufacturer: string | null;
  model: string | null;
  renderingIntent: number | null;
  tagCount: number | null;
  errors: string[];
};

export type PdfXmpInspection = {
  present: boolean;
  valid: boolean;
  claim: string | null;
  pdfxidProperties: string[];
  hasConformanceProperty: boolean;
  raw: string | null;
};

export type PdfPrepressMetadataInspection = {
  outputIntent: PdfOutputIntentInspection;
  xmp: PdfXmpInspection;
  pdfXConformanceInfoPresent: boolean;
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

function readSignature(bytes: Uint8Array, offset: number) {
  return bytes.length >= offset + 4 ? Buffer.from(bytes.subarray(offset, offset + 4)).toString("ascii") : null;
}

function readUInt32(bytes: Uint8Array, offset: number) {
  return bytes.length >= offset + 4
    ? ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
    : null;
}

function readVersion(bytes: Uint8Array) {
  return bytes.length >= 12 ? `${bytes[8] >> 4}.${bytes[8] & 0x0f}.${bytes[9] >> 4}` : null;
}

function readTag(bytes: Uint8Array, tagSignature: string) {
  const tagCount = readUInt32(bytes, 128);
  if (tagCount === null || bytes.length < 132 + tagCount * 12) return null;
  for (let index = 0; index < tagCount; index += 1) {
    const offset = 132 + index * 12;
    if (readSignature(bytes, offset) !== tagSignature) continue;
    const tagOffset = readUInt32(bytes, offset + 4);
    const tagSize = readUInt32(bytes, offset + 8);
    if (tagOffset === null || tagSize === null || tagOffset + tagSize > bytes.length || tagSize < 12) return null;
    return { type: readSignature(bytes, tagOffset), offset: tagOffset, size: tagSize };
  }
  return null;
}

function readTagText(bytes: Uint8Array, tagSignature: string) {
  const tag = readTag(bytes, tagSignature);
  if (!tag) return null;
  if (tag.type === "text") {
    return Buffer.from(bytes.subarray(tag.offset + 8, tag.offset + tag.size)).toString("ascii").replace(/\0+$/, "").trim() || null;
  }
  if (tag.type === "desc") {
    const asciiLength = readUInt32(bytes, tag.offset + 8);
    if (asciiLength === null || asciiLength < 1 || tag.offset + 12 + asciiLength > bytes.length) return null;
    return Buffer.from(bytes.subarray(tag.offset + 12, tag.offset + 12 + asciiLength - 1)).toString("ascii");
  }
  return null;
}

/** Structural ICC sanity check for the CMYK print OutputIntent contract. */
export function inspectIccProfile(bytes: Uint8Array): IccProfileInspection {
  const errors: string[] = [];
  const declaredSize = readUInt32(bytes, 0);
  const signature = readSignature(bytes, 36);
  const profileClass = readSignature(bytes, 12);
  const colorSpace = readSignature(bytes, 16);
  const pcs = readSignature(bytes, 20);
  const version = readVersion(bytes);
  const tagCount = readUInt32(bytes, 128);
  const renderingIntent = readUInt32(bytes, 64);

  if (bytes.length < 128) errors.push("ICC profil je kratší než 128 bytes.");
  if (declaredSize === null || declaredSize < 128) errors.push("ICC header nemá platnou deklarovanou velikost.");
  else if (declaredSize > bytes.length) errors.push("Deklarovaná velikost ICC profilu přesahuje dostupná data.");
  if (signature !== "acsp") errors.push("ICC header nemá signature acsp.");
  if (!profileClass || !["scnr", "mntr", "prtr", "link", "spac", "abst", "nmcl"].includes(profileClass)) errors.push("ICC header nemá rozpoznatelnou device/profile class.");
  if (!colorSpace || !/^(GRAY|RGB |CMYK|CIE |[2-9A-F]CLR)$/.test(colorSpace)) errors.push("ICC header nemá rozpoznatelný data color space.");
  if (!pcs || !["XYZ ", "Lab "].includes(pcs)) errors.push("ICC header nemá rozpoznatelný PCS.");
  if (colorSpace !== "CMYK") errors.push("ICC profil není CMYK profil.");

  return {
    valid: errors.length === 0,
    declaredSize,
    signatureValid: signature === "acsp",
    profileClass,
    colorSpace,
    pcs,
    version,
    description: readTagText(bytes, "desc"),
    copyright: readTagText(bytes, "cprt"),
    manufacturer: readTagText(bytes, "dmnd"),
    model: readTagText(bytes, "dmdd"),
    renderingIntent,
    tagCount,
    errors,
  };
}

/** Reads document-level prepress objects through pdf-lib's parsed object graph. */
export function inspectPdfPrepressMetadata(pdf: PDFDocument): PdfPrepressMetadataInspection {
  const outputIntents = getCatalogArray(pdf);
  let validIntent: PDFDict | undefined;
  let profilePresent = false;
  let profileValid = false;
  let outputConditionIdentifier: string | null = null;
  let info: string | null = null;
  let iccProfile: IccProfileInspection | null = null;

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
      const inspectedProfile = profileBytes ? inspectIccProfile(profileBytes) : null;
      const hasValidProfile = Boolean(profile && profileN === 4 && inspectedProfile?.valid);

      if (type === OUTPUT_INTENT.asString() && subtype === "/GTS_PDFX" && hasProfile && hasValidProfile && !validIntent) {
        validIntent = intent;
        profilePresent = true;
        profileValid = true;
        iccProfile = inspectedProfile;
        outputConditionIdentifier = getStringValue(intent.lookupMaybe(PDFName.of("OutputConditionIdentifier"), PDFString, PDFHexString));
        info = getStringValue(intent.lookupMaybe(PDFName.of("Info"), PDFString, PDFHexString));
      } else if (hasProfile) {
        profilePresent = true;
        profileValid ||= hasValidProfile;
        if (!iccProfile && inspectedProfile) iccProfile = inspectedProfile;
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
    iccProfile,
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
  const pdfxidProperties = raw ? Array.from(raw.matchAll(/<pdfxid:([^>\s]+)[^>]*>/gi), (match) => match[1]) : [];
  const hasConformanceProperty = Boolean(raw && /GTS_PDFXConformance/i.test(raw));
  const pdfXConformanceInfoPresent = (() => {
    const infoDictionary = pdf.context.trailerInfo.Info
      ? pdf.context.lookupMaybe(pdf.context.trailerInfo.Info, PDFDict)
      : undefined;
    return Boolean(infoDictionary && Array.from(infoDictionary.keys()).some((key) => key.asString() === "/GTS_PDFXConformance"));
  })();

  const xmp: PdfXmpInspection = {
    present: Boolean(metadata && metadataType === "/Metadata" && metadataSubtype === XML.asString() && raw),
    valid: Boolean(
      metadata
      && metadataType === "/Metadata"
      && metadataSubtype === XML.asString()
      && claim === PDF_X4_VERSION
      && pdfxidProperties.length === 1
      && pdfxidProperties[0] === "GTS_PDFXVersion"
      && !hasConformanceProperty,
    ),
    claim,
    pdfxidProperties,
    hasConformanceProperty,
    raw,
  };

  return { outputIntent, xmp, pdfXConformanceInfoPresent };
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
