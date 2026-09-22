import { readFile } from "node:fs/promises";
import path from "node:path";

import { AdminRole, Prisma, VoucherTemplateStatus, VoucherType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultVoucherTemplateLayout } from "./voucher-template-defaults";
import { deleteVoucherTemplateAsset, writeVoucherTemplateMaster } from "./voucher-template-storage";

const CLASSIC_TEMPLATE_KEY = "classic-v1";
const BOOTSTRAP_LOCK = "ppstudio:voucher-template-bootstrap:classic-v1";

export type VoucherTemplateBootstrapDependencies = {
  db?: typeof prisma;
  readMaster?: () => Promise<Buffer>;
  writeMaster?: typeof writeVoucherTemplateMaster;
  deleteAsset?: typeof deleteVoucherTemplateAsset;
};

function isClassicUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2002"
    && (String(error.meta?.target ?? "").includes("key") || String(error.meta?.target ?? "").includes("familyKey"));
}

async function bootstrapOnce(
  dependencies: VoucherTemplateBootstrapDependencies,
) {
  const db = dependencies.db ?? prisma;
  const readMaster = dependencies.readMaster ?? (() => readFile(path.join(process.cwd(), "src", "features", "vouchers", "bootstrap-assets", "classic-v1.pdf")));
  const writeMaster = dependencies.writeMaster ?? writeVoucherTemplateMaster;
  const deleteAsset = dependencies.deleteAsset ?? deleteVoucherTemplateAsset;
  let createdTemplate = false;
  let createdTemplateId: string | null = null;
  let createdStoragePath: string | null = null;

  try {
    return await db.$transaction(async (tx) => {
      // Serializuje i první vytvoření classic-v1, takže dva bootstrap procesy
      // neuvidí současně prázdný namespace a nesoutěží o unique key.
      if (typeof tx.$queryRaw === "function") {
        // pg_advisory_xact_lock() vrací PostgreSQL typ `void`, který Prisma
        // neumí deserializovat jako výsledek dotazu. Vyhodnocení přes IS NULL
        // zachová blokující lock a vrátí běžný boolean.
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${BOOTSTRAP_LOCK})) IS NULL AS locked`);
      }

      let template = await tx.voucherTemplate.findUnique({ where: { key: CLASSIC_TEMPLATE_KEY } });
      if (!template) {
        const owner = await tx.adminUser.findFirst({ where: { role: AdminRole.OWNER, isActive: true }, select: { id: true } });
        if (!owner) throw new Error("Bootstrap vyžaduje aktivního OWNER uživatele.");

        template = await tx.voucherTemplate.create({
          data: {
            key: CLASSIC_TEMPLATE_KEY,
            familyKey: "classic",
            version: 1,
            label: "Klasický",
            status: VoucherTemplateStatus.DRAFT,
            allowedTypes: [VoucherType.VALUE, VoucherType.SERVICE],
            layout: defaultVoucherTemplateLayout,
            createdByUserId: owner.id,
          },
        });
        createdTemplate = true;
        createdTemplateId = template.id;

        const stored = await writeMaster(template.id, await readMaster());
        createdStoragePath = stored.storagePath;
        template = await tx.voucherTemplate.update({
          where: { id: template.id },
          data: {
            status: VoucherTemplateStatus.PUBLISHED,
            masterStoragePath: stored.storagePath,
            masterSha256: stored.sha256,
            publishedByUserId: owner.id,
            publishedAt: new Date(),
          },
        });
      }

      if (template.status !== VoucherTemplateStatus.PUBLISHED || !template.masterStoragePath || !template.masterSha256) {
        throw new Error("Bootstrap nalezl classic-v1 bez publikovaného a platného masteru.");
      }

      const legacyVouchers = await tx.voucher.findMany({ where: { templateId: null }, select: { templateKey: true } });
      const ambiguous = legacyVouchers.filter((voucher) => voucher.templateKey !== CLASSIC_TEMPLATE_KEY);
      if (ambiguous.length > 0) throw new Error(`Bootstrap nemůže bezpečně určit šablonu pro ${ambiguous.length} historických voucherů.`);

      const backfilled = await tx.voucher.updateMany({ where: { templateId: null, templateKey: CLASSIC_TEMPLATE_KEY }, data: { templateId: template.id } });
      const settings = await tx.siteSettings.findUnique({ where: { id: "site-settings" }, select: { voucherDefaultTemplateId: true } });
      if (!settings) throw new Error("Bootstrap nenalezl očekávaný singleton SiteSettings.");

      if (settings.voucherDefaultTemplateId === null) {
        const updatedSettings = await tx.siteSettings.updateMany({
          where: { id: "site-settings", voucherDefaultTemplateId: null },
          data: { voucherDefaultTemplateId: template.id },
        });
        if (updatedSettings.count !== 1) throw new Error("Bootstrap nedokázal nastavit výchozí šablonu v SiteSettings.");
      } else if (settings.voucherDefaultTemplateId !== template.id) {
        const configured = await tx.voucherTemplate.findUnique({ where: { id: settings.voucherDefaultTemplateId }, select: { status: true } });
        if (!configured || configured.status !== VoucherTemplateStatus.PUBLISHED) {
          throw new Error("SiteSettings odkazuje na neplatnou výchozí voucherovou šablonu.");
        }
      }

      const remainingNulls = await tx.voucher.count({ where: { templateId: null } });
      if (remainingNulls !== 0) throw new Error(`Bootstrap skončil s ${remainingNulls} voucher řádky bez templateId.`);
      if (createdTemplate) {
        const owner = await tx.adminUser.findFirst({ where: { role: AdminRole.OWNER, isActive: true }, select: { id: true } });
        await tx.voucherTemplateAuditLog.create({
          data: {
            templateId: template.id,
            templateKey: template.key,
            familyKey: template.familyKey,
            version: template.version,
            label: template.label,
            actorUserId: owner?.id ?? null,
            operation: "PUBLISH",
            metadata: { bootstrap: true, backfilledVouchers: backfilled.count },
          },
        });
      }

      return { backfilledVouchers: backfilled.count, remainingNulls };
    });
  } catch (error) {
    if (createdStoragePath) {
      await deleteAsset(createdStoragePath).catch((cleanupError) => {
        console.error("Bootstrap cleanup masteru selhal", { cleanupError });
      });
    }
    if (createdTemplate && createdTemplateId) {
      await db.voucherTemplate.delete({ where: { id: createdTemplateId } }).catch((cleanupError) => {
        console.error("Bootstrap cleanup DB šablony selhal", { cleanupError });
      });
    }
    throw error;
  }
}

export async function bootstrapVoucherTemplates(dependencies: VoucherTemplateBootstrapDependencies = {}) {
  try {
    return await bootstrapOnce(dependencies);
  } catch (error) {
    if (isClassicUniqueConflict(error)) {
      // Fallback pro databáze bez advisory-lock podpory; druhý proces už
      // pouze načte vítězný classic-v1 a provede idempotentní backfill.
      return bootstrapOnce(dependencies);
    }
    throw error;
  }
}
