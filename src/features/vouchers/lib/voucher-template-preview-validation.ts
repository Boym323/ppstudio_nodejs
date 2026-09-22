import sharp from "sharp";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC32_TABLE = new Uint32Array(256);

for (let index = 0; index < CRC32_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  CRC32_TABLE[index] = value >>> 0;
}

export const VOUCHER_TEMPLATE_PREVIEW_LIMITS = {
  maxWidth: 4096,
  maxHeight: 4096,
  maxPixels: 16_777_216,
} as const;

export const VOUCHER_TEMPLATE_PREVIEW_MAX_BYTES = 16 * 1024 * 1024;

type VoucherTemplatePreviewPngValidationFailure =
  | "empty"
  | "too-large"
  | "not-png"
  | "invalid-dimensions"
  | "dimensions-too-large"
  | "decode-failed";

export type VoucherTemplatePreviewPngValidation =
  | {
      ok: true;
      format: "png";
      width: number;
      height: number;
    }
  | {
      ok: false;
      reason: VoucherTemplatePreviewPngValidationFailure;
    };

function invalid(reason: VoucherTemplatePreviewPngValidationFailure): VoucherTemplatePreviewPngValidation {
  return { ok: false, reason };
}

function crc32(buffer: Buffer, start: number, end: number) {
  let value = 0xffffffff;
  for (let index = start; index < end; index += 1) value = CRC32_TABLE[(value ^ buffer[index]!) & 0xff]! ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function hasCompletePngContainer(buffer: Buffer) {
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return false;

  let offset = PNG_SIGNATURE.length;
  let hasIhdr = false;
  while (offset < buffer.length) {
    if (buffer.length - offset < 12) return false;
    const chunkLength = buffer.readUInt32BE(offset);
    const dataEnd = offset + 8 + chunkLength;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > buffer.length) return false;
    if (crc32(buffer, offset + 4, dataEnd) !== buffer.readUInt32BE(dataEnd)) return false;

    const chunkType = buffer.toString("ascii", offset + 4, offset + 8);
    if (chunkType === "IHDR") hasIhdr = true;
    if (chunkType === "IEND") return hasIhdr && chunkLength === 0 && chunkEnd === buffer.length;
    offset = chunkEnd;
  }

  return false;
}

export async function validateVoucherTemplatePreviewPng(buffer: Buffer): Promise<VoucherTemplatePreviewPngValidation> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return invalid("empty");
  if (buffer.length > VOUCHER_TEMPLATE_PREVIEW_MAX_BYTES) return invalid("too-large");

  try {
    const image = sharp(buffer, {
      animated: false,
      failOn: "error",
      limitInputPixels: VOUCHER_TEMPLATE_PREVIEW_LIMITS.maxPixels,
    });
    const metadata = await image.metadata();

    if (metadata.format !== "png") return invalid("not-png");
    if (!hasCompletePngContainer(buffer)) return invalid("decode-failed");

    const { width, height } = metadata;
    if (
      !Number.isSafeInteger(width)
      || !Number.isSafeInteger(height)
      || width < 1
      || height < 1
    ) {
      return invalid("invalid-dimensions");
    }
    if (
      width > VOUCHER_TEMPLATE_PREVIEW_LIMITS.maxWidth
      || height > VOUCHER_TEMPLATE_PREVIEW_LIMITS.maxHeight
      || width * height > VOUCHER_TEMPLATE_PREVIEW_LIMITS.maxPixels
    ) {
      return invalid("dimensions-too-large");
    }

    // metadata() alone can succeed for a truncated/corrupt image. Force libvips
    // to decode all pixels before accepting the stored preview.
    await image.raw().toBuffer();

    return { ok: true, format: "png", width, height };
  } catch {
    return invalid("decode-failed");
  }
}
