import { Prisma, VoucherTemplateStatus, VoucherType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { voucherTemplateLayoutSchema, voucherTemplateStoredLayoutSchema, type VoucherTemplateLayoutV1 } from "./voucher-template-layout";
import {
  deleteVoucherTemplateAsset,
  readVoucherTemplateMaster,
  readVoucherTemplatePreview,
  sha256,
  voucherTemplateMasterExists,
  writeVoucherTemplateMaster,
  writeVoucherTemplatePreview,
} from "./voucher-template-storage";
import { preflightVoucherTemplateMaster } from "./voucher-template-preflight";
import { renderVoucherTemplatePreview } from "./voucher-template-preview";
import { validateVoucherTemplatePreviewPng } from "./voucher-template-preview-validation";
import { VoucherTemplateDomainError } from "./voucher-template-errors";

export { VoucherTemplateDomainError } from "./voucher-template-errors";

export function templateKey(familyKey: string, version: number) {
  const family = familyKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!family || version < 1) throw new VoucherTemplateDomainError("INVALID_STATE", "Neplatná rodina nebo verze šablony.");
  return `${family}-v${version}`;
}

type AuditDb = Pick<Prisma.TransactionClient, "voucherTemplate" | "voucherTemplateAuditLog">;

async function audit(
  db: AuditDb,
  templateId: string,
  actorUserId: string | null,
  operation: Prisma.VoucherTemplateAuditLogCreateInput["operation"],
  metadata?: Prisma.VoucherTemplateAuditLogCreateInput["metadata"],
) {
  const template = await db.voucherTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, key: true, familyKey: true, version: true, label: true },
  });

  if (!template) {
    throw new VoucherTemplateDomainError("NOT_FOUND", "Šablona voucheru nebyla nalezena.");
  }

  await db.voucherTemplateAuditLog.create({
    data: {
      templateId: template.id,
      templateKey: template.key,
      familyKey: template.familyKey,
      version: template.version,
      label: template.label,
      actorUserId,
      operation,
      metadata: metadata ?? undefined,
    },
  });
}

export async function requireVoucherTemplate(id: string) {
  const template = await prisma.voucherTemplate.findUnique({ where: { id } });
  if (!template) throw new VoucherTemplateDomainError("NOT_FOUND", "Šablona voucheru nebyla nalezena.");
  return template;
}

export async function listPublishedVoucherTemplates(type?: VoucherType) {
  return prisma.voucherTemplate.findMany({
    where: { status: VoucherTemplateStatus.PUBLISHED, ...(type ? { allowedTypes: { has: type } } : {}) },
    orderBy: [{ familyKey: "asc" }, { version: "desc" }],
  });
}

export async function createVoucherTemplateDraft(input: {
  familyKey: string;
  label: string;
  allowedTypes: VoucherType[];
  layout: VoucherTemplateLayoutV1;
  actorUserId: string;
}) {
  const layout = voucherTemplateLayoutSchema.parse(input.layout);
  const familyKey = input.familyKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  try {
    return await runSerializableTransaction(async (tx) => {
      const latest = await tx.voucherTemplate.aggregate({ where: { familyKey }, _max: { version: true } });
      const version = (latest._max.version ?? 0) + 1;
      const result = await tx.voucherTemplate.create({
        data: {
          key: templateKey(familyKey, version),
          familyKey,
          version,
          label: input.label.trim(),
          allowedTypes: input.allowedTypes,
          layout,
          createdByUserId: input.actorUserId,
        },
      });
      await audit(tx, result.id, input.actorUserId, "CREATE_DRAFT");
      return result;
    }, { maxRetries: 0 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new VoucherTemplateDomainError("INVALID_STATE", "Souběžně vznikla nová verze; akci opakujte.");
    }
    throw error;
  }
}

export async function updateVoucherTemplateDraft(
  id: string,
  input: { layout: VoucherTemplateLayoutV1; allowedTypes: VoucherType[]; label: string; actorUserId: string; expectedUpdatedAt?: Date },
) {
  const layout = voucherTemplateLayoutSchema.parse(input.layout);

  return runSerializableTransaction(async (tx) => {
    const template = await tx.voucherTemplate.findUnique({ where: { id } });
    if (!template) throw new VoucherTemplateDomainError("NOT_FOUND", "Šablona voucheru nebyla nalezena.");
    if (template.status !== "DRAFT") throw new VoucherTemplateDomainError("IMMUTABLE", "Publikovanou šablonu nelze měnit.");

    let result;
    if (input.expectedUpdatedAt) {
      const updated = await tx.voucherTemplate.updateMany({
        where: { id, status: VoucherTemplateStatus.DRAFT, updatedAt: input.expectedUpdatedAt },
        data: { layout, allowedTypes: input.allowedTypes, label: input.label.trim() },
      });
      if (updated.count !== 1) {
        throw new VoucherTemplateDomainError("INVALID_STATE", "Draft byl mezitím změněn v jiném okně. Obnovte stránku a úpravy zopakujte.");
      }
      result = await tx.voucherTemplate.findUniqueOrThrow({ where: { id } });
    } else {
      result = await tx.voucherTemplate.update({
        where: { id },
        data: { layout, allowedTypes: input.allowedTypes, label: input.label.trim() },
      });
    }

    await audit(tx, id, input.actorUserId, "UPDATE_DRAFT");
    return result;
  }, { maxRetries: 0 });
}

export async function replaceVoucherTemplateMaster(id: string, master: Buffer, actorUserId: string) {
  const template = await requireVoucherTemplate(id);
  if (template.status !== "DRAFT") throw new VoucherTemplateDomainError("IMMUTABLE", "Master publikované šablony nelze nahradit.");
  if (!master.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new VoucherTemplateDomainError("MASTER_INVALID", "Master musí být platný PDF soubor.");

  const preflight = await preflightVoucherTemplateMaster(master);
  if (preflight.errors.length) throw new VoucherTemplateDomainError("MASTER_INVALID", preflight.errors[0] ?? "Master PDF není platný.");

  const preview = await renderVoucherTemplatePreview(master);
  let preparedMaster: Awaited<ReturnType<typeof writeVoucherTemplateMaster>> | null = null;
  let preparedPreview: Awaited<ReturnType<typeof writeVoucherTemplatePreview>> | null = null;

  try {
    preparedMaster = await writeVoucherTemplateMaster(id, master);
    preparedPreview = await writeVoucherTemplatePreview(id, preview);

    const result = await runSerializableTransaction(async (tx) => {
      const switched = await tx.voucherTemplate.updateMany({
        where: {
          id,
          status: VoucherTemplateStatus.DRAFT,
          version: template.version,
          masterStoragePath: template.masterStoragePath,
          masterSha256: template.masterSha256,
          previewStoragePath: template.previewStoragePath,
        },
        data: {
          masterStoragePath: preparedMaster!.storagePath,
          masterSha256: preparedMaster!.sha256,
          previewStoragePath: preparedPreview!.storagePath,
        },
      });

      if (switched.count !== 1) {
        throw new VoucherTemplateDomainError("INVALID_STATE", "Šablona se během nahrávání změnila; akci opakujte.");
      }

      await audit(tx, id, actorUserId, "UPLOAD_MASTER");
      return tx.voucherTemplate.findUniqueOrThrow({ where: { id } });
    }, { maxRetries: 0 });

    try {
      await deleteVoucherTemplateAsset(template.masterStoragePath);
    } catch (cleanupError) {
      console.warn("Úklid starého masteru šablony selhal po úspěšném přepnutí", { templateId: id, cleanupError });
    }
    try {
      await deleteVoucherTemplateAsset(template.previewStoragePath);
    } catch (cleanupError) {
      console.warn("Úklid starého preview šablony selhal po úspěšném přepnutí", { templateId: id, cleanupError });
    }

    return result;
  } catch (error) {
    await deleteVoucherTemplateAsset(preparedMaster?.storagePath).catch((cleanupError) => {
      console.error("Úklid nového masteru po neúspěšném přepnutí selhal", { templateId: id, cleanupError });
    });
    await deleteVoucherTemplateAsset(preparedPreview?.storagePath).catch((cleanupError) => {
      console.error("Úklid nového preview po neúspěšném přepnutí selhal", { templateId: id, cleanupError });
    });
    throw error;
  }
}

export async function publishVoucherTemplate(id: string, actorUserId: string) {
  const template = await requireVoucherTemplate(id);
  if (template.status !== "DRAFT") throw new VoucherTemplateDomainError("INVALID_STATE", "Publikovat lze jen draft.");
  if (!template.masterStoragePath || !template.masterSha256 || !(await voucherTemplateMasterExists(template.masterStoragePath))) throw new VoucherTemplateDomainError("MASTER_INVALID", "Master šablony chybí.");
  let master: Buffer;
  try {
    master = await readVoucherTemplateMaster(template.masterStoragePath);
  } catch {
    throw new VoucherTemplateDomainError("MASTER_INVALID", "Master šablony není dostupný.");
  }
  if (!master.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new VoucherTemplateDomainError("MASTER_INVALID", "Master musí být platný PDF soubor.");
  if (sha256(master) !== template.masterSha256) throw new VoucherTemplateDomainError("MASTER_INVALID", "Kontrolní součet masteru nesouhlasí.");
  const masterPreflight = await preflightVoucherTemplateMaster(master);
  if (masterPreflight.errors.length) throw new VoucherTemplateDomainError("MASTER_INVALID", masterPreflight.errors[0] ?? "Master PDF není platný.");
  if (!template.previewStoragePath) throw new VoucherTemplateDomainError("MASTER_INVALID", "Náhled šablony chybí nebo není dostupný.");
  let preview: Buffer;
  try {
    preview = await readVoucherTemplatePreview(template.previewStoragePath);
  } catch {
    throw new VoucherTemplateDomainError("MASTER_INVALID", "Náhled šablony není dostupný.");
  }
  const previewValidation = await validateVoucherTemplatePreviewPng(preview);
  if (!previewValidation.ok) {
    throw new VoucherTemplateDomainError("MASTER_INVALID", "Náhled šablony není platný PNG soubor.");
  }
  voucherTemplateLayoutSchema.parse(template.layout);

  const [{ resolveVoucherTemplate }, { preflightVoucherTemplateForPublish }] = await Promise.all([
    import("./voucher-template-repository"),
    import("./voucher-template-publish-preflight"),
  ]);
  const finalPreflight = await preflightVoucherTemplateForPublish(await resolveVoucherTemplate(template));
  if (!finalPreflight.ok) throw new VoucherTemplateDomainError("MASTER_INVALID", finalPreflight.errors[0] ?? "Finální PDF preflight šablony neprošel.");

  return runSerializableTransaction(async (tx) => {
    const current = await tx.voucherTemplate.findUnique({ where: { id } });
    if (!current) throw new VoucherTemplateDomainError("NOT_FOUND", "Šablona voucheru nebyla nalezena.");
    if (
      current.status !== VoucherTemplateStatus.DRAFT
      || current.version !== template.version
      || current.masterStoragePath !== template.masterStoragePath
      || current.masterSha256 !== template.masterSha256
      || current.previewStoragePath !== template.previewStoragePath
    ) {
      throw new VoucherTemplateDomainError("INVALID_STATE", "Master, preview nebo layout se během preflightu změnil; spusťte preflight znovu.");
    }

    const published = await tx.voucherTemplate.updateMany({
      where: {
        id,
        status: VoucherTemplateStatus.DRAFT,
        version: template.version,
        masterStoragePath: template.masterStoragePath,
        masterSha256: template.masterSha256,
        previewStoragePath: template.previewStoragePath,
        updatedAt: template.updatedAt,
      },
      data: { status: VoucherTemplateStatus.PUBLISHED, publishedByUserId: actorUserId, publishedAt: new Date() },
    });
    if (published.count !== 1) throw new VoucherTemplateDomainError("INVALID_STATE", "Šablona už byla změněna; obnovte stránku.");
    await audit(tx, id, actorUserId, "PUBLISH");
    return tx.voucherTemplate.findUniqueOrThrow({ where: { id } });
  }, { maxRetries: 0 });
}

export async function deactivateVoucherTemplate(id: string, actorUserId: string) {
  return runSerializableTransaction(async (tx) => {
    const settings = await tx.siteSettings.findUnique({ where: { id: "site-settings" }, select: { voucherDefaultTemplateId: true } });
    if (id === settings?.voucherDefaultTemplateId) throw new VoucherTemplateDomainError("DEFAULT_GUARD", "Nejprve nastavte jinou publikovanou výchozí šablonu.");

    const template = await tx.voucherTemplate.findUnique({ where: { id } });
    if (!template) throw new VoucherTemplateDomainError("NOT_FOUND", "Šablona voucheru nebyla nalezena.");
    if (template.status !== VoucherTemplateStatus.PUBLISHED) throw new VoucherTemplateDomainError("INVALID_STATE", "Deaktivovat lze jen publikovanou šablonu.");

    const deactivated = await tx.voucherTemplate.updateMany({ where: { id, status: VoucherTemplateStatus.PUBLISHED }, data: { status: VoucherTemplateStatus.INACTIVE, inactivatedByUserId: actorUserId, inactivatedAt: new Date() } });
    if (deactivated.count !== 1) throw new VoucherTemplateDomainError("INVALID_STATE", "Šablona už byla změněna; obnovte stránku.");
    await audit(tx, id, actorUserId, "DEACTIVATE");
  }, { maxRetries: 0 });
}

export async function cloneVoucherTemplateVersion(id: string, actorUserId: string) {
  try {
    return await runSerializableTransaction(async (tx) => {
      const source = await tx.voucherTemplate.findUnique({ where: { id } });
      if (!source) throw new VoucherTemplateDomainError("NOT_FOUND", "Šablona voucheru nebyla nalezena.");
      const latest = await tx.voucherTemplate.aggregate({ where: { familyKey: source.familyKey }, _max: { version: true } });
      const version = (latest._max.version ?? 0) + 1;
      const clone = await tx.voucherTemplate.create({
        data: {
          key: templateKey(source.familyKey, version),
          familyKey: source.familyKey,
          version,
          label: source.label,
          allowedTypes: source.allowedTypes,
          layout: voucherTemplateStoredLayoutSchema.parse(source.layout),
          createdByUserId: actorUserId,
          clonedFromId: source.id,
        },
      });
      await audit(tx, clone.id, actorUserId, "CLONE_VERSION");
      return clone;
    }, { maxRetries: 0 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new VoucherTemplateDomainError("INVALID_STATE", "Souběžně vznikla nová verze; akci opakujte.");
    throw error;
  }
}

export async function deleteVoucherTemplateDraft(id: string, actorUserId: string) {
  const deleted = await runSerializableTransaction(async (tx) => {
    const template = await tx.voucherTemplate.findUnique({ where: { id } });
    if (!template) throw new VoucherTemplateDomainError("NOT_FOUND", "Šablona voucheru nebyla nalezena.");
    if (template.status !== VoucherTemplateStatus.DRAFT) throw new VoucherTemplateDomainError("IMMUTABLE", "Smazat lze jen draft.");

    const [vouchers, batches] = await Promise.all([
      tx.voucher.count({ where: { templateId: id } }),
      tx.voucherPrintBatch.count({ where: { templateId: id } }),
    ]);
    if (vouchers || batches) throw new VoucherTemplateDomainError("INVALID_STATE", "Referencovanou šablonu nelze smazat.");

    await audit(tx, id, actorUserId, "DELETE_DRAFT");
    await tx.voucherTemplate.delete({ where: { id } });
    return { masterStoragePath: template.masterStoragePath, previewStoragePath: template.previewStoragePath };
  }, { maxRetries: 0 });

  for (const storagePath of [deleted.masterStoragePath, deleted.previewStoragePath]) {
    try {
      await deleteVoucherTemplateAsset(storagePath);
    } catch (cleanupError) {
      console.warn("Úklid assetu smazané šablony selhal po úspěšném DB commitu", { id, storagePath, cleanupError });
    }
  }
}
