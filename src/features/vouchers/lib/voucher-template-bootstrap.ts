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
import { CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY } from "./voucher-template-validation-policy";

const LEGACY_TEMPLATE_KEY = "classic-v1";
const CURRENT_TEMPLATE_KEY = "classic-v2";
const TEMPLATE_FAMILY_KEY = "classic";
const BOOTSTRAP_LOCK = "ppstudio:voucher-template-bootstrap:classic";

export type VoucherTemplateBootstrapDependencies = {
  db?: typeof prisma;
  /** Test/backward-compatible single-template override; production bootstrap ho nepoužívá. */
  readMaster?: () => Promise<Buffer>;
  readLegacyMaster?: () => Promise<Buffer>;
  readCurrentMaster?: () => Promise<Buffer>;
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

async function validateStrictMaster(master: Buffer, preflightMaster: typeof preflightVoucherTemplateMaster) {
  assertPdfSignature(master);
  const preflight = await preflightMaster(master);
  if (preflight.errors.length) {
    throw new Error(preflight.errors[0] ?? "Bootstrap nalezl neplatný master PDF.");
  }
}

async function readBundledMaster(fileName: string) {
  return readFile(path.join(process.cwd(), "src", "features", "vouchers", "bootstrap-assets", fileName));
}

async function bootstrapSingleTemplateCompatibility(dependencies: VoucherTemplateBootstrapDependencies) {
  const db = dependencies.db ?? prisma;
  const readMaster = dependencies.readMaster!;
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
      if (typeof tx.$queryRaw === "function") {
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${BOOTSTRAP_LOCK})) IS NULL AS locked`);
      }

      let template = await tx.voucherTemplate.findUnique({ where: { key: LEGACY_TEMPLATE_KEY } });
      let owner: { id: string } | null = null;
      let fresh = false;

      if (!template) {
        owner = await tx.adminUser.findFirst({ where: { role: AdminRole.OWNER, isActive: true }, select: { id: true } });
        if (!owner) throw new Error("Bootstrap vyžaduje aktivního OWNER uživatele.");
        template = await tx.voucherTemplate.create({
          data: {
            key: LEGACY_TEMPLATE_KEY,
            familyKey: TEMPLATE_FAMILY_KEY,
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
        await validateStrictMaster(master, preflightMaster);
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
            validationPolicy: CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY,
            masterStoragePath: storedMaster.storagePath,
            masterSha256: storedMaster.sha256,
            previewStoragePath: storedPreview.storagePath,
            publishedByUserId: owner!.id,
            publishedAt: new Date(),
          },
        });
      } else {
        const allowedStatus = template.status === VoucherTemplateStatus.PUBLISHED || template.status === VoucherTemplateStatus.INACTIVE;
        if (!allowedStatus || !template.masterStoragePath || !template.masterSha256) throw new Error("Bootstrap nalezl classic-v1 bez publikovaného a platného masteru.");
        if (!(await masterExists(template.masterStoragePath))) throw new Error("Bootstrap nalezl chybějící master classic-v1.");
        let master: Buffer;
        try { master = await readStoredMaster(template.masterStoragePath); }
        catch { throw new Error("Bootstrap nedokázal načíst master classic-v1."); }
        if (sha256(master) !== template.masterSha256) throw new Error("Bootstrap nalezl nesouhlasící kontrolní součet masteru classic-v1.");
        await validateStrictMaster(master, preflightMaster);

        let previewIsValid = false;
        if (template.previewStoragePath) {
          try { previewIsValid = (await validatePreview(await readStoredPreview(template.previewStoragePath))).ok; }
          catch { previewIsValid = false; }
        }
        if (!previewIsValid && template.status === VoucherTemplateStatus.INACTIVE) {
          throw new Error("Bootstrap nalezl neplatný nebo chybějící preview classic-v1.");
        }
        if (!previewIsValid) {
          const previousPreviewStoragePath = template.previewStoragePath;
          const storedPreview = await writePreview(template.id, await renderPreview(master));
          stagedAssets.push(storedPreview.storagePath);
          const updated = await tx.voucherTemplate.updateMany({
            where: { id: template.id, status: VoucherTemplateStatus.PUBLISHED, masterStoragePath: template.masterStoragePath, masterSha256: template.masterSha256, previewStoragePath: previousPreviewStoragePath },
            data: { previewStoragePath: storedPreview.storagePath },
          });
          if (updated.count !== 1) throw new Error("Bootstrap nemohl atomicky opravit preview classic-v1.");
          repairedPreviewToCleanup = previousPreviewStoragePath;
          template = { ...template, previewStoragePath: storedPreview.storagePath };
        }
      }

      const legacyVouchers = await tx.voucher.findMany({ where: { templateId: null }, select: { templateKey: true } });
      const ambiguous = legacyVouchers.filter((voucher) => voucher.templateKey !== LEGACY_TEMPLATE_KEY);
      if (ambiguous.length > 0) throw new Error(`Bootstrap nemůže bezpečně určit šablonu pro ${ambiguous.length} historických voucherů.`);
      const backfilled = await tx.voucher.updateMany({ where: { templateId: null, templateKey: LEGACY_TEMPLATE_KEY }, data: { templateId: template.id } });
      const settings = await tx.siteSettings.findUnique({ where: { id: "site-settings" }, select: { voucherDefaultTemplateId: true } });
      if (!settings) throw new Error("Bootstrap nenalezl očekávaný singleton SiteSettings.");

      if (settings.voucherDefaultTemplateId === null) {
        if (template.status === VoucherTemplateStatus.INACTIVE) throw new Error("Bootstrap nemůže nastavit neaktivní classic-v1 jako výchozí šablonu.");
        const updatedSettings = await tx.siteSettings.updateMany({ where: { id: "site-settings", voucherDefaultTemplateId: null }, data: { voucherDefaultTemplateId: template.id } });
        if (updatedSettings.count !== 1) throw new Error("Bootstrap nedokázal nastavit výchozí šablonu v SiteSettings.");
      } else if (settings.voucherDefaultTemplateId !== template.id) {
        const configured = await tx.voucherTemplate.findUnique({ where: { id: settings.voucherDefaultTemplateId }, select: { status: true } });
        if (!configured || configured.status !== VoucherTemplateStatus.PUBLISHED) throw new Error("SiteSettings odkazuje na neplatnou výchozí voucherovou šablonu.");
      }

      const remainingNulls = await tx.voucher.count({ where: { templateId: null } });
      if (remainingNulls !== 0) throw new Error(`Bootstrap skončil s ${remainingNulls} voucher řádky bez templateId.`);
      if (fresh) {
        await tx.voucherTemplateAuditLog.create({
          data: { templateId: template.id, templateKey: template.key, familyKey: template.familyKey, version: template.version, label: template.label, actorUserId: owner!.id, operation: "PUBLISH", metadata: { bootstrap: true, backfilledVouchers: backfilled.count } },
        });
      }
      return { backfilledVouchers: backfilled.count, remainingNulls, legacyTemplateId: template.id, currentTemplateId: template.id, defaultTemplateId: settings.voucherDefaultTemplateId ?? template.id };
    }, { timeout: 30_000 });

    if (repairedPreviewToCleanup) {
      await deleteAsset(repairedPreviewToCleanup).catch(() => undefined);
    }
    return result;
  } catch (error) {
    for (const storagePath of stagedAssets) await deleteAsset(storagePath).catch(() => undefined);
    if (createdTemplateId) await db.voucherTemplate.delete({ where: { id: createdTemplateId } }).catch(() => undefined);
    throw error;
  }
}

async function bootstrapOnce(dependencies: VoucherTemplateBootstrapDependencies) {
  if (dependencies.readMaster) return bootstrapSingleTemplateCompatibility(dependencies);
  const db = dependencies.db ?? prisma;
  const readLegacyMaster = dependencies.readLegacyMaster ?? (() => readBundledMaster("classic-v1.pdf"));
  const readCurrentMaster = dependencies.readCurrentMaster ?? (() => readBundledMaster("classic-v2.pdf"));
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
  const createdTemplateIds: string[] = [];
  const repairedPreviewsToCleanup: string[] = [];

  try {
    const result = await db.$transaction(async (tx) => {
      if (typeof tx.$queryRaw === "function") {
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${BOOTSTRAP_LOCK})) IS NULL AS locked`);
      }

      let owner: { id: string } | null = null;
      const requireOwner = async () => {
        if (owner) return owner;
        owner = await tx.adminUser.findFirst({
          where: { role: AdminRole.OWNER, isActive: true },
          select: { id: true },
        });
        if (!owner) throw new Error("Bootstrap vyžaduje aktivního OWNER uživatele.");
        return owner;
      };

      let legacyTemplate = await tx.voucherTemplate.findUnique({ where: { key: LEGACY_TEMPLATE_KEY } });
      let currentTemplate = await tx.voucherTemplate.findUnique({ where: { key: CURRENT_TEMPLATE_KEY } });
      let legacyFresh = false;
      let currentFresh = false;

      if (!legacyTemplate) {
        const actor = await requireOwner();
        legacyTemplate = await tx.voucherTemplate.create({
          data: {
            key: LEGACY_TEMPLATE_KEY,
            familyKey: TEMPLATE_FAMILY_KEY,
            version: 1,
            label: "Klasický (historický)",
            status: VoucherTemplateStatus.DRAFT,
            allowedTypes: [VoucherType.VALUE, VoucherType.SERVICE],
            layout: defaultVoucherTemplateLayout,
            createdByUserId: actor.id,
          },
        });
        createdTemplateIds.push(legacyTemplate.id);
        legacyFresh = true;
      }

      if (!currentTemplate) {
        const actor = await requireOwner();
        currentTemplate = await tx.voucherTemplate.create({
          data: {
            key: CURRENT_TEMPLATE_KEY,
            familyKey: TEMPLATE_FAMILY_KEY,
            version: 2,
            label: "Klasický",
            status: VoucherTemplateStatus.DRAFT,
            allowedTypes: [VoucherType.VALUE, VoucherType.SERVICE],
            layout: defaultVoucherTemplateLayout,
            createdByUserId: actor.id,
            clonedFromId: legacyTemplate.id,
          },
        });
        createdTemplateIds.push(currentTemplate.id);
        currentFresh = true;
      }

      if (legacyFresh) {
        const actor = await requireOwner();
        const master = await readLegacyMaster();
        // classic-v1 je záměrně historický PDF 1.4. Na first rollout jej
        // zachováme pro reprint starých voucherů, ale nikdy ho neoznačíme
        // STRICT_V1 ani nenabídneme pro nové vydání.
        assertPdfSignature(master);
        const preview = await renderPreview(master);
        const storedMaster = await writeMaster(legacyTemplate.id, master);
        stagedAssets.push(storedMaster.storagePath);
        const storedPreview = await writePreview(legacyTemplate.id, preview);
        stagedAssets.push(storedPreview.storagePath);
        const now = new Date();

        legacyTemplate = await tx.voucherTemplate.update({
          where: { id: legacyTemplate.id },
          data: {
            status: VoucherTemplateStatus.INACTIVE,
            validationPolicy: null,
            masterStoragePath: storedMaster.storagePath,
            masterSha256: storedMaster.sha256,
            previewStoragePath: storedPreview.storagePath,
            publishedByUserId: actor.id,
            publishedAt: now,
            inactivatedByUserId: actor.id,
            inactivatedAt: now,
          },
        });

        await tx.voucherTemplateAuditLog.create({
          data: {
            templateId: legacyTemplate.id,
            templateKey: legacyTemplate.key,
            familyKey: legacyTemplate.familyKey,
            version: legacyTemplate.version,
            label: legacyTemplate.label,
            actorUserId: actor.id,
            operation: "PUBLISH",
            metadata: { bootstrap: true, historical: true },
          },
        });
        await tx.voucherTemplateAuditLog.create({
          data: {
            templateId: legacyTemplate.id,
            templateKey: legacyTemplate.key,
            familyKey: legacyTemplate.familyKey,
            version: legacyTemplate.version,
            label: legacyTemplate.label,
            actorUserId: actor.id,
            operation: "DEACTIVATE",
            metadata: { bootstrap: true, historical: true },
          },
        });
      } else {
        const allowedStatus = legacyTemplate.status === VoucherTemplateStatus.PUBLISHED
          || legacyTemplate.status === VoucherTemplateStatus.INACTIVE;
        if (!allowedStatus || !legacyTemplate.masterStoragePath || !legacyTemplate.masterSha256) {
          throw new Error("Bootstrap nalezl classic-v1 bez publikovaného historického masteru.");
        }
        if (!(await masterExists(legacyTemplate.masterStoragePath))) {
          throw new Error("Bootstrap nalezl chybějící master classic-v1.");
        }

        let master: Buffer;
        try {
          master = await readStoredMaster(legacyTemplate.masterStoragePath);
        } catch {
          throw new Error("Bootstrap nedokázal načíst master classic-v1.");
        }
        if (sha256(master) !== legacyTemplate.masterSha256) {
          throw new Error("Bootstrap nalezl nesouhlasící kontrolní součet masteru classic-v1.");
        }

        if (legacyTemplate.validationPolicy === CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY) {
          await validateStrictMaster(master, preflightMaster);
        } else {
          assertPdfSignature(master);
        }

        let previewIsValid = false;
        if (legacyTemplate.previewStoragePath) {
          try {
            const existingPreview = await readStoredPreview(legacyTemplate.previewStoragePath);
            previewIsValid = (await validatePreview(existingPreview)).ok;
          } catch {
            previewIsValid = false;
          }
        }

        if (!previewIsValid) {
          const previousPreviewStoragePath = legacyTemplate.previewStoragePath;
          const preview = await renderPreview(master);
          const storedPreview = await writePreview(legacyTemplate.id, preview);
          stagedAssets.push(storedPreview.storagePath);

          const updated = await tx.voucherTemplate.updateMany({
            where: {
              id: legacyTemplate.id,
              status: legacyTemplate.status,
              masterStoragePath: legacyTemplate.masterStoragePath,
              masterSha256: legacyTemplate.masterSha256,
              previewStoragePath: previousPreviewStoragePath,
            },
            data: { previewStoragePath: storedPreview.storagePath },
          });
          if (updated.count !== 1) {
            throw new Error("Bootstrap nemohl atomicky opravit preview classic-v1.");
          }
          if (previousPreviewStoragePath) repairedPreviewsToCleanup.push(previousPreviewStoragePath);
          legacyTemplate = { ...legacyTemplate, previewStoragePath: storedPreview.storagePath };
        }
      }

      if (currentFresh) {
        const actor = await requireOwner();
        const master = await readCurrentMaster();
        await validateStrictMaster(master, preflightMaster);
        const preview = await renderPreview(master);

        const storedMaster = await writeMaster(currentTemplate.id, master);
        stagedAssets.push(storedMaster.storagePath);
        const storedPreview = await writePreview(currentTemplate.id, preview);
        stagedAssets.push(storedPreview.storagePath);

        const layout = voucherTemplateLayoutSchema.parse(currentTemplate.layout);
        const finalPreflight = await preflightPublish({
          id: currentTemplate.id,
          key: currentTemplate.key,
          label: currentTemplate.label,
          status: currentTemplate.status,
          allowedTypes: currentTemplate.allowedTypes,
          layout,
          masterSha256: storedMaster.sha256,
          masterBytes: master,
        });
        if (!finalPreflight.ok) {
          throw new Error(finalPreflight.errors[0] ?? "Finální PDF preflight šablony neprošel.");
        }

        currentTemplate = await tx.voucherTemplate.update({
          where: { id: currentTemplate.id },
          data: {
            status: VoucherTemplateStatus.PUBLISHED,
            validationPolicy: CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY,
            masterStoragePath: storedMaster.storagePath,
            masterSha256: storedMaster.sha256,
            previewStoragePath: storedPreview.storagePath,
            publishedByUserId: actor.id,
            publishedAt: new Date(),
          },
        });

        await tx.voucherTemplateAuditLog.create({
          data: {
            templateId: currentTemplate.id,
            templateKey: currentTemplate.key,
            familyKey: currentTemplate.familyKey,
            version: currentTemplate.version,
            label: currentTemplate.label,
            actorUserId: actor.id,
            operation: "PUBLISH",
            metadata: { bootstrap: true, current: true },
          },
        });
      } else {
        const allowedStatus = currentTemplate.status === VoucherTemplateStatus.PUBLISHED
          || currentTemplate.status === VoucherTemplateStatus.INACTIVE;
        if (!allowedStatus || !currentTemplate.masterStoragePath || !currentTemplate.masterSha256) {
          throw new Error("Bootstrap nalezl classic-v2 bez publikovaného a platného masteru.");
        }
        if (currentTemplate.validationPolicy !== CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY) {
          throw new Error("Bootstrap nalezl classic-v2 bez aktuální strict validation policy.");
        }
        if (!(await masterExists(currentTemplate.masterStoragePath))) {
          throw new Error("Bootstrap nalezl chybějící master classic-v2.");
        }

        let master: Buffer;
        try {
          master = await readStoredMaster(currentTemplate.masterStoragePath);
        } catch {
          throw new Error("Bootstrap nedokázal načíst master classic-v2.");
        }
        if (sha256(master) !== currentTemplate.masterSha256) {
          throw new Error("Bootstrap nalezl nesouhlasící kontrolní součet masteru classic-v2.");
        }
        await validateStrictMaster(master, preflightMaster);

        let previewIsValid = false;
        if (currentTemplate.previewStoragePath) {
          try {
            const existingPreview = await readStoredPreview(currentTemplate.previewStoragePath);
            previewIsValid = (await validatePreview(existingPreview)).ok;
          } catch {
            previewIsValid = false;
          }
        }

        if (!previewIsValid) {
          const previousPreviewStoragePath = currentTemplate.previewStoragePath;
          const preview = await renderPreview(master);
          const storedPreview = await writePreview(currentTemplate.id, preview);
          stagedAssets.push(storedPreview.storagePath);

          const updated = await tx.voucherTemplate.updateMany({
            where: {
              id: currentTemplate.id,
              status: currentTemplate.status,
              validationPolicy: CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY,
              masterStoragePath: currentTemplate.masterStoragePath,
              masterSha256: currentTemplate.masterSha256,
              previewStoragePath: previousPreviewStoragePath,
            },
            data: { previewStoragePath: storedPreview.storagePath },
          });
          if (updated.count !== 1) {
            throw new Error("Bootstrap nemohl atomicky opravit preview classic-v2.");
          }
          if (previousPreviewStoragePath) repairedPreviewsToCleanup.push(previousPreviewStoragePath);
          currentTemplate = { ...currentTemplate, previewStoragePath: storedPreview.storagePath };
        }
      }

      const legacyVouchers = await tx.voucher.findMany({
        where: { templateId: null },
        select: { templateKey: true },
      });
      const ambiguous = legacyVouchers.filter((voucher) => voucher.templateKey !== LEGACY_TEMPLATE_KEY);
      if (ambiguous.length > 0) {
        throw new Error(`Bootstrap nemůže bezpečně určit šablonu pro ${ambiguous.length} historických voucherů.`);
      }

      const backfilled = await tx.voucher.updateMany({
        where: { templateId: null, templateKey: LEGACY_TEMPLATE_KEY },
        data: { templateId: legacyTemplate.id },
      });

      const settings = await tx.siteSettings.findUnique({
        where: { id: "site-settings" },
        select: { voucherDefaultTemplateId: true },
      });
      if (!settings) throw new Error("Bootstrap nenalezl očekávaný singleton SiteSettings.");

      let defaultTemplateId = settings.voucherDefaultTemplateId;
      if (defaultTemplateId === null) {
        if (
          currentTemplate.status !== VoucherTemplateStatus.PUBLISHED
          || currentTemplate.validationPolicy !== CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY
        ) {
          throw new Error("Bootstrap nemůže nastavit classic-v2 jako výchozí šablonu.");
        }
        const updatedSettings = await tx.siteSettings.updateMany({
          where: { id: "site-settings", voucherDefaultTemplateId: null },
          data: { voucherDefaultTemplateId: currentTemplate.id },
        });
        if (updatedSettings.count !== 1) {
          throw new Error("Bootstrap nedokázal nastavit výchozí šablonu v SiteSettings.");
        }
        defaultTemplateId = currentTemplate.id;
      } else if (defaultTemplateId === legacyTemplate.id) {
        const legacyIsIssuable = legacyTemplate.status === VoucherTemplateStatus.PUBLISHED
          && legacyTemplate.validationPolicy === CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY;
        if (!legacyIsIssuable) {
          if (
            currentTemplate.status !== VoucherTemplateStatus.PUBLISHED
            || currentTemplate.validationPolicy !== CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY
          ) {
            throw new Error("Bootstrap nemá platnou strict šablonu pro změnu výchozího vzhledu.");
          }
          const updatedSettings = await tx.siteSettings.updateMany({
            where: { id: "site-settings", voucherDefaultTemplateId: legacyTemplate.id },
            data: { voucherDefaultTemplateId: currentTemplate.id },
          });
          if (updatedSettings.count !== 1) {
            throw new Error("Bootstrap nedokázal přepnout výchozí šablonu na classic-v2.");
          }
          defaultTemplateId = currentTemplate.id;
        }
      } else {
        const configured = await tx.voucherTemplate.findUnique({
          where: { id: defaultTemplateId },
          select: { status: true, validationPolicy: true },
        });
        if (
          !configured
          || configured.status !== VoucherTemplateStatus.PUBLISHED
          || configured.validationPolicy !== CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY
        ) {
          throw new Error("SiteSettings odkazuje na neplatnou výchozí voucherovou šablonu.");
        }
      }

      const remainingNulls = await tx.voucher.count({ where: { templateId: null } });
      if (remainingNulls !== 0) {
        throw new Error(`Bootstrap skončil s ${remainingNulls} voucher řádky bez templateId.`);
      }

      return {
        backfilledVouchers: backfilled.count,
        remainingNulls,
        legacyTemplateId: legacyTemplate.id,
        currentTemplateId: currentTemplate.id,
        defaultTemplateId,
      };
    }, { timeout: 30_000 });

    for (const storagePath of repairedPreviewsToCleanup) {
      await deleteAsset(storagePath).catch((cleanupError) => {
        console.warn("Bootstrap cleanup starého preview selhal po úspěšném přepnutí", {
          storagePath,
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
    for (const templateId of createdTemplateIds.reverse()) {
      await db.voucherTemplate.delete({ where: { id: templateId } }).catch((cleanupError) => {
        console.error("Bootstrap cleanup DB šablony selhal", { templateId, cleanupError });
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
      return bootstrapOnce(dependencies);
    }
    throw error;
  }
}
