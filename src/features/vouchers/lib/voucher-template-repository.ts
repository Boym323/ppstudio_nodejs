import { VoucherTemplateStatus, VoucherType } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import { VoucherTemplateDomainError } from "./voucher-template-domain";
import { readVoucherTemplateMaster, sha256, voucherTemplateMasterExists } from "./voucher-template-storage";
import { voucherTemplateLayoutSchema, type VoucherTemplateLayoutV1 } from "./voucher-template-layout";

export type ResolvedVoucherTemplate = {
  id: string;
  key: string;
  status: VoucherTemplateStatus;
  allowedTypes: VoucherType[];
  label: string;
  layout: VoucherTemplateLayoutV1;
  masterSha256: string;
  masterBytes: Buffer;
};

export async function getVoucherTemplateById(id: string) {
  return prisma.voucherTemplate.findUnique({ where: { id } });
}

export async function getVoucherTemplateByKey(key: string) {
  return prisma.voucherTemplate.findUnique({ where: { key } });
}

export async function requireVoucherTemplateById(id: string) {
  const template = await getVoucherTemplateById(id);
  if (!template) throw new VoucherTemplateDomainError("NOT_FOUND", "Šablona voucheru nebyla nalezena.");
  return template;
}

export async function requireVoucherTemplateByKey(key: string) {
  const template = await getVoucherTemplateByKey(key);
  if (!template) throw new VoucherTemplateDomainError("NOT_FOUND", "Šablona voucheru nebyla nalezena.");
  return template;
}

export async function listOwnerVoucherTemplates() {
  return prisma.voucherTemplate.findMany({ orderBy: [{ familyKey: "asc" }, { version: "desc" }] });
}

export async function listPublishedVoucherTemplates(type?: VoucherType) {
  return prisma.voucherTemplate.findMany({
    where: { status: VoucherTemplateStatus.PUBLISHED, ...(type ? { allowedTypes: { has: type } } : {}) },
    orderBy: [{ familyKey: "asc" }, { version: "desc" }],
  });
}

export function isVoucherTemplateAllowedForType(
  template: { allowedTypes: VoucherType[]; status: VoucherTemplateStatus },
  type: VoucherType,
  historical = false,
) {
  return template.allowedTypes.includes(type) && (historical || template.status === VoucherTemplateStatus.PUBLISHED);
}

export async function loadVoucherTemplateMaster(template: { masterStoragePath: string | null; masterSha256: string | null }) {
  if (!template.masterStoragePath || !template.masterSha256 || !(await voucherTemplateMasterExists(template.masterStoragePath))) {
    throw new VoucherTemplateDomainError("MASTER_INVALID", "Master šablony není dostupný.");
  }
  const master = await readVoucherTemplateMaster(template.masterStoragePath);
  if (sha256(master) !== template.masterSha256) throw new VoucherTemplateDomainError("MASTER_INVALID", "Kontrolní součet masteru nesouhlasí.");
  return master;
}

export async function resolveVoucherTemplate(template: { id: string; key: string; status: VoucherTemplateStatus; allowedTypes: VoucherType[]; label: string; layout: unknown; masterStoragePath: string | null; masterSha256: string | null }): Promise<ResolvedVoucherTemplate> {
  const masterBytes = await loadVoucherTemplateMaster(template);
  if (!template.masterSha256) throw new VoucherTemplateDomainError("MASTER_INVALID", "Master šablony není dostupný.");
  return { id: template.id, key: template.key, status: template.status, allowedTypes: template.allowedTypes, label: template.label, layout: voucherTemplateLayoutSchema.parse(template.layout), masterSha256: template.masterSha256, masterBytes };
}

export async function resolveVoucherTemplateForVoucher(voucherId: string) {
  const voucher = await prisma.voucher.findUnique({ where: { id: voucherId }, include: { template: true } });
  if (!voucher?.template) throw new VoucherTemplateDomainError("NOT_FOUND", "Voucher nemá přiřazenou šablonu.");
  return { voucher, template: await resolveVoucherTemplate(voucher.template) };
}

export async function resolveVoucherTemplateForPrintBatch(batchId: string) {
  const batch = await prisma.voucherPrintBatch.findUnique({ where: { id: batchId }, include: { template: true } });
  if (!batch?.template) throw new VoucherTemplateDomainError("NOT_FOUND", "Tisková série nemá přiřazenou šablonu.");
  return { batch, template: await resolveVoucherTemplate(batch.template) };
}
