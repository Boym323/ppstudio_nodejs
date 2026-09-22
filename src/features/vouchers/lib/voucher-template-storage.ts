import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getMediaVisibilityRoot } from "@/lib/media/media-config";

const pathPattern = /^voucher-templates\/[a-z0-9]+\/(master|preview)-[a-f0-9-]+\.(pdf|png)$/;
export class VoucherTemplateStorageError extends Error { constructor() { super("Soubor šablony voucheru není dostupný."); this.name = "VoucherTemplateStorageError"; } }
function absolute(storagePath: string) { if (!pathPattern.test(storagePath)) throw new VoucherTemplateStorageError(); const root = getMediaVisibilityRoot("PRIVATE"); const result = path.resolve(root, storagePath); if (!result.startsWith(`${root}${path.sep}`)) throw new VoucherTemplateStorageError(); return result; }
export function sha256(buffer: Buffer) { return createHash("sha256").update(buffer).digest("hex"); }
export function buildVoucherTemplateMasterPath(templateId: string) { return `voucher-templates/${templateId}/master-${randomUUID()}.pdf`; }
export async function writeVoucherTemplateMaster(templateId: string, buffer: Buffer) { const storagePath = buildVoucherTemplateMasterPath(templateId); const target = absolute(storagePath); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, buffer, { flag: "wx" }); return { storagePath, sha256: sha256(buffer) }; }
export async function readVoucherTemplateMaster(storagePath: string) { return readFile(absolute(storagePath)); }
export async function voucherTemplateMasterExists(storagePath: string) { try { await stat(absolute(storagePath)); return true; } catch { return false; } }
export async function deleteVoucherTemplateAsset(storagePath: string | null | undefined) { if (storagePath) await rm(absolute(storagePath), { force: true }); }
