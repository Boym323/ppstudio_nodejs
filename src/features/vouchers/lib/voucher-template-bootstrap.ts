import { readFile } from "node:fs/promises";
import path from "node:path";

import { AdminRole, Prisma, VoucherTemplateStatus, VoucherType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultVoucherTemplateLayout } from "./voucher-template-defaults";
import { voucherTemplateLayoutSchema } from "./voucher-template-layout";
import { preflightVoucherTemplateForPublish } from "./voucher-template-publish-preflight";
import { preflightVoucherTemplateMaster } from "./voucher-template-preflight";
import { renderVoucherTemplatePreview } from "./voucher-template-preview";
import {
  deleteVoucherTemplateAsset,
  readVoucherTemplateMaster,
  readVoucherTemplatePreview,
  sha256,
  voucherTemplateMasterExists,
  writeVoucherTemplateMaster,
  writeVoucherTemplatePreview,
} from "./voucher-template-storage";
import { validateVoucherTemplatePreviewPng } from "./voucher-template-preview-validation";

const CLASSIC_TEMPLATE_KEY = "classic-v1";
const BOOTSTRAP_LOCK = "ppstudio:voucher-template-bootstrap:classic-v1";

export type VoucherTemplateBootstrapDependencies = {
  db?: typeof prisma;
  readMaster?: () => Promise<Buffer>;
  writeMaster?: typeof writeVoucherTemplateMaster;
  writePreview?: typeof writeVoucherTemplatePreview;
  readStoredMaster?: typeof readVoucherTemplateMaster;
  readStoredPreview?: typeof readVoucherTemplatePreview;
  masterExists?: typeof voucherTemplateMasterExists;
  preflightMaster?: typeof preflightVoucherTemplateMaster;
  preflightPublish?: typeof preflightVoucherTemplateForPublish;
  renderPreview?: typeof renderVoucherTemplatePreview;
  validatePreview?: typeof validateVoucherTemplatePreviewPng;
  deleteAsset?: typeof deleteVoucherTemplateAsset;
};

function isClassicUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2002"
    && (String(error.meta?.target ?? "").includes("key") || String(error.meta?.target ?? "").includes("familyKey"));
}

function assertPdfSignature(master: Buffer) {
  if (!master.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error("Bootstrap nalezl neplatný master PDF.");
  }
}

async function validateMaster(master: Buffer, preflightMaster: typeof preflightVoucherTemplateMaster) {
  assertPdfSignature(master);
  const preflight = await preflightMaster(master);
  if (preflight.errors.length) {
    throw new Error(preflight.errors[0] ?? "Bootstrap nalezl neplatný master PDF.");
  }
}

async function bootstrapOnce(dependencies: VoucherTemplateBootstrapDependencies) {
  const db = dependencies.db ?? prisma;
  const readMaster = dependencies.readMaster ?? (() => readFile(path.join(process.cwd(), "src", "features", "vouchers", "bootstrap-assets", "classic-v1.pdf")));
  const writeMaster = dependencies.writeMaster ?? writeVoucherTemplateMaster;
  const writePreview = dependencies.writePreview ?? writeVoucherTemplatePreview;
  const readStoredMaster = dependencies.readStoredMaster ?? readVoucherTemplateMaster;
  const readStoredPreview = dependencies.readStoredPreview ?? readVoucherTemplatePreview;
  const masterExists = dependencies.masterExists ?? voucherTemplateMasterExists;
  const preflightMaster = dependencies.preflightMaster ?? preflightVoucherTemplateMaster;
  const preflightPublish = dependencies.preflightPublish ?? preflightVoucherTemplateForPublish;
  const renderPreview = dependencies.renderPreview ?? renderVoucherTemplatePreview;
  const validatePreview = dependencies.validatePreview ?? validateVoucherTemplatePreviewPng;
  const deleteAsset = dependencies.deleteAsset ?? deleteVoucherTemplateAsset;
  const stagedAssets: string[] = [];
  let createdTemplateId: string | null = null;
  let repairedPreviewToCleanup: string | null = null;

  try {
    const result = await db.$transaction(async (tx) => {
      // Serializuje i první vytvoření classic-v1, takže dva bootstrap procesy
      // neuvidí současně prázdný namespace a nesoutěží o unique key.
      if (typeof tx.$queryRaw === "function") {
        // pg_advisory_xact_lock() vrací PostgreSQL typ `void`, který Prisma
        // neumí deserializovat jako výsledek dotazu. Vyhodnocení přes IS NULL
        // zachová blokující lock a vrátí běžný boolean.
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${BOOTSTRAP_LOCK})) IS NULL AS locked`);
      }

      let template = await tx.voucherTemplate.findUnique({ where: { key: CLASSIC_TEMPLATE_KEY } });
      let owner: { id: string } | null = null;
      let fresh = false;

      if (!template) {
        owner = await tx.adminUser.findFirst({ where: { role: AdminRole.OWNER, isActive: true }, select: { id: true } });
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
        createdTemplateId = template.id;
        fresh = true;
      }

      if (fresh) {
        const master = await readMaster();
        await validateMaster(master, preflightMaster);
        const preview = await renderPreview(master);

        const storedMaster = await writeMaster(template.id, master);
        stagedAssets.push(storedMaster.storagePath);
        const storedPreview = await writePreview(template.id, preview);
        stagedAssets.push(storedPreview.storagePath);

        const layout = voucherTemplateLayoutSchema.parse(template.layout);
        const finalPreflight = await preflightPublish({
          id: template.id,
          key: template.key,
          label: template.label,
          status: template.status,
          allowedTypes: template.allowedTypes,
          layout,
          masterSha256: storedMaster.sha256,
          masterBytes: master,
        });
        if (!finalPreflight.ok) throw new Error(finalPreflight.errors[0] ?? "Finální PDF preflight šablony neprošel.");

        template = await tx.voucherTemplate.update({
          where: { id: template.id },
          data: {
            status: VoucherTemplateStatus.PUBLISHED,
            masterStoragePath: storedMaster.storagePath,
            masterSha256: storedMaster.sha256,
            previewStoragePath: storedPreview.storagePath,
            publishedByUserId: owner!.id,
            publishedAt: new Date(),
          },
        });
      } else {
        if (template.status !== VoucherTemplateStatus.PUBLISHED || !template.masterStoragePath || !template.masterSha256) {
          throw new Error("Bootstrap nalezl classic-v1 bez publikovaného a platného masteru.");
        }

        if (!(await masterExists(template.masterStoragePath))) {
          throw new Error("Bootstrap nalezl chybějící master classic-v1.");
        }
        let master: Buffer;
        try {
          master = await readStoredMaster(template.masterStoragePath);
        } catch {
          throw new Error("Bootstrap nedokázal načíst master classic-v1.");
        }
        if (sha256(master) !== template.masterSha256) {
          throw new Error("Bootstrap nalezl nesouhlasící kontrolní součet masteru classic-v1.");
        }
        await validateMaster(master, preflightMaster);

        let previewIsValid = false;
        if (template.previewStoragePath) {
          try {
            const existingPreview = await readStoredPreview(template.previewStoragePath);
            previewIsValid = (await validatePreview(existingPreview)).ok;
          } catch {
            previewIsValid = false;
          }
        }

        if (!previewIsValid) {
          const previousPreviewStoragePath = template.previewStoragePath;
          const preview = await renderPreview(master);
          const storedPreview = await writePreview(template.id, preview);
          stagedAssets.push(storedPreview.storagePath);

          const updated = await tx.voucherTemplate.updateMany({
            where: {
              id: template.id,
              status: VoucherTemplateStatus.PUBLISHED,
              masterStoragePath: template.masterStoragePath,
              masterSha256: template.masterSha256,
              previewStoragePath: previousPreviewStoragePath,
            },
            data: { previewStoragePath: storedPreview.storagePath },
          });
          if (updated.count !== 1) {
            throw new Error("Bootstrap nemohl atomicky opravit preview classic-v1.");
          }
          repairedPreviewToCleanup = previousPreviewStoragePath;
          template = { ...template, previewStoragePath: storedPreview.storagePath };
        }
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
      if (fresh) {
        await tx.voucherTemplateAuditLog.create({
          data: {
            templateId: template.id,
            templateKey: template.key,
            familyKey: template.familyKey,
            version: template.version,
            label: template.label,
            actorUserId: owner!.id,
            operation: "PUBLISH",
            metadata: { bootstrap: true, backfilledVouchers: backfilled.count },
          },
        });
      }

      return { backfilledVouchers: backfilled.count, remainingNulls };
    }, { timeout: 30_000 });

    if (repairedPreviewToCleanup) {
      await deleteAsset(repairedPreviewToCleanup).catch((cleanupError) => {
        console.warn("Bootstrap cleanup starého preview selhal po úspěšném přepnutí", {
          storagePath: repairedPreviewToCleanup,
          cleanupError,
        });
      });
    }

    return result;
  } catch (error) {
    for (const storagePath of stagedAssets) {
      await deleteAsset(storagePath).catch((cleanupError) => {
        console.error("Bootstrap cleanup assetu selhal", { storagePath, cleanupError });
      });
    }
    if (createdTemplateId) {
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
