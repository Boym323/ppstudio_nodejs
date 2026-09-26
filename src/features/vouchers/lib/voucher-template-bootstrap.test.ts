import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import type { VoucherTemplateBootstrapDependencies } from "./voucher-template-bootstrap";
import { defaultVoucherTemplateLayout } from "./voucher-template-defaults";
import { validVoucherTemplatePreviewPng } from "./voucher-template-test-fixtures";

process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

const master = Buffer.from("%PDF-1.4\nunit master\n", "utf8");
const masterSha256 = createHash("sha256").update(master).digest("hex");
const png = validVoucherTemplatePreviewPng;

async function bootstrapVoucherTemplates(...args: Parameters<(typeof import("./voucher-template-bootstrap"))["bootstrapVoucherTemplates"]>) {
  const { bootstrapVoucherTemplates: bootstrap } = await import("./voucher-template-bootstrap");
  return bootstrap(...args);
}

function createDb(options: {
  existing?: boolean;
  existingStatus?: "PUBLISHED" | "INACTIVE";
  defaultTemplateId?: string | null;
  previewStoragePath?: string | null;
  failAfterTransaction?: boolean;
  previewUpdateConflict?: boolean;
  advisoryLock?: boolean;
} = {}) {
  type FakeTemplate = {
    id: string;
    key: string;
    familyKey: string;
    version: number;
    label: string;
    layout: typeof defaultVoucherTemplateLayout;
    status: "PUBLISHED" | "DRAFT" | "INACTIVE";
    validationPolicy: string | null;
    masterStoragePath: string | null;
    masterSha256: string | null;
    previewStoragePath: string | null;
    publishedAt: Date | null;
    publishedByUserId: string | null;
  };
  let template: FakeTemplate | null = options.existing
    ? {
        id: "classic-template",
        key: "classic-v1",
        familyKey: "classic",
        version: 1,
        label: "Klasický",
        layout: defaultVoucherTemplateLayout,
        status: options.existingStatus ?? "PUBLISHED",
        validationPolicy: null,
        masterStoragePath: "voucher-templates/classic-template/master-existing.pdf",
        masterSha256,
        previewStoragePath: options.previewStoragePath ?? null,
        publishedAt: new Date("2026-09-22T10:00:00.000Z"),
        publishedByUserId: "owner",
      }
    : null;
  let vouchers = [{ templateId: null as string | null, templateKey: "classic-v1" }];
  let settings = { voucherDefaultTemplateId: options.defaultTemplateId ?? (options.existing ? "classic-template" : null as string | null) };
  let auditCount = 0;
  let updateCount = 0;
  let deletedTemplate = false;

  const transaction = {
    voucher: {
      findMany: async () => vouchers.filter((voucher) => voucher.templateId === null),
      updateMany: async ({ data }: { data: { templateId: string } }) => {
        const count = vouchers.filter((voucher) => voucher.templateId === null && voucher.templateKey === "classic-v1").length;
        vouchers = vouchers.map((voucher) => voucher.templateId === null ? { ...voucher, templateId: data.templateId } : voucher);
        return { count };
      },
      count: async () => vouchers.filter((voucher) => voucher.templateId === null).length,
    },
    siteSettings: {
      findUnique: async () => settings,
      updateMany: async ({ data }: { data: { voucherDefaultTemplateId: string } }) => {
        settings = { ...settings, ...data };
        return { count: 1 };
      },
    },
    voucherTemplateAuditLog: { create: async () => { auditCount += 1; } },
    adminUser: { findFirst: async () => ({ id: "owner" }) },
    voucherTemplate: {
      findUnique: async ({ where }: { where: { key?: string; id?: string } }) => {
        if (where.id === "other-published-template") return { status: "PUBLISHED" };
        if (where.id && where.id !== "classic-template") return null;
        return template;
      },
      create: async (): Promise<FakeTemplate> => {
        template = {
          id: "classic-template",
          key: "classic-v1",
          familyKey: "classic",
          version: 1,
          label: "Klasický",
          layout: defaultVoucherTemplateLayout,
          status: "DRAFT",
          validationPolicy: null,
          masterStoragePath: null,
          masterSha256: null,
          previewStoragePath: null,
          publishedAt: null,
          publishedByUserId: null,
        };
        return template;
      },
      update: async ({ data }: { data: Partial<FakeTemplate> }) => {
        template = { ...(template as FakeTemplate), ...data };
        return template;
      },
      updateMany: async ({ where, data }: { where: Partial<FakeTemplate>; data: Partial<FakeTemplate> }) => {
        updateCount += 1;
        if (options.previewUpdateConflict && Object.prototype.hasOwnProperty.call(where, "previewStoragePath")) return { count: 0 };
        if (!template || Object.entries(where).some(([key, value]) => template?.[key as keyof FakeTemplate] !== value)) return { count: 0 };
        template = { ...template, ...data };
        return { count: 1 };
      },
    },
  };
  let advisoryLockHeld = false;
  const advisoryLockWaiters: Array<() => void> = [];
  const acquireAdvisoryLock = async () => {
    if (advisoryLockHeld) await new Promise<void>((resolve) => advisoryLockWaiters.push(resolve));
    advisoryLockHeld = true;
  };
  const releaseAdvisoryLock = () => {
    const next = advisoryLockWaiters.shift();
    if (next) next();
    else advisoryLockHeld = false;
  };
  const db = {
    voucherTemplate: { delete: async () => { deletedTemplate = true; template = null; } },
    $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => {
      const before = { template: template ? { ...template } : null, vouchers: vouchers.map((voucher) => ({ ...voucher })), settings: { ...settings }, auditCount, updateCount };
      let ownsAdvisoryLock = false;
      const tx = options.advisoryLock
        ? {
            ...transaction,
            $queryRaw: async () => {
              await acquireAdvisoryLock();
              ownsAdvisoryLock = true;
              return [];
            },
          }
        : transaction;
      try {
        const result = await callback(tx);
        if (options.failAfterTransaction) throw new Error("simulated DB failure");
        return result;
      } catch (error) {
        template = before.template;
        vouchers = before.vouchers;
        settings = before.settings;
        auditCount = before.auditCount;
        updateCount = before.updateCount;
        throw error;
      } finally {
        if (ownsAdvisoryLock) releaseAdvisoryLock();
      }
    },
  } as unknown as NonNullable<VoucherTemplateBootstrapDependencies["db"]>;
  return {
    db,
    getTemplate: () => template,
    getVouchers: () => vouchers,
    getSettings: () => settings,
    getAuditCount: () => auditCount,
    getUpdateCount: () => updateCount,
    wasTemplateDeleted: () => deletedTemplate,
  };
}

function dependencies(
  context: ReturnType<typeof createDb>,
  overrides: Partial<VoucherTemplateBootstrapDependencies> = {},
) {
  const deleted: string[] = [];
  let masterWrites = 0;
  let previewWrites = 0;
  const deps: VoucherTemplateBootstrapDependencies = {
    db: context.db,
    readMaster: async () => master,
    readStoredMaster: async () => master,
    readStoredPreview: async () => png,
    masterExists: async () => true,
    preflightMaster: async () => ({ errors: [] } as never),
    preflightPublish: async () => ({ ok: true, errors: [] }),
    renderPreview: async () => png,
    validatePreview: async () => ({ ok: true, format: "png", width: 1, height: 1 }),
    writeMaster: async () => {
      masterWrites += 1;
      return { storagePath: "voucher-templates/classic-template/master-new.pdf", sha256: masterSha256 };
    },
    writePreview: async () => {
      previewWrites += 1;
      return { storagePath: `voucher-templates/classic-template/preview-${previewWrites}.png` };
    },
    deleteAsset: async (storagePath) => { if (storagePath) deleted.push(storagePath); },
    ...overrides,
  };
  return { deps, deleted, getMasterWrites: () => masterWrites, getPreviewWrites: () => previewWrites };
}

test("fresh bootstrap vytvoří publikovaný master i PNG preview, audit, backfill a default", async () => {
  const context = createDb();
  const prepared = dependencies(context);

  const result = await bootstrapVoucherTemplates(prepared.deps);
  const template = context.getTemplate();
  assert.equal(result.backfilledVouchers, 1);
  assert.equal(result.remainingNulls, 0);
  assert.equal(context.getTemplate()?.validationPolicy, "STRICT_V1");
  assert.equal(template?.status, "PUBLISHED");
  assert.equal(template?.masterStoragePath, "voucher-templates/classic-template/master-new.pdf");
  assert.equal(template?.masterSha256, masterSha256);
  assert.equal(template?.previewStoragePath, "voucher-templates/classic-template/preview-1.png");
  assert.equal(context.getSettings().voucherDefaultTemplateId, "classic-template");
  assert.equal(context.getAuditCount(), 1);
  assert.deepEqual(prepared.deleted, []);
});

test("fresh bootstrap odmítne finální text overflow a uklidí připravené assety", async () => {
  const context = createDb();
  let preflightCalled = false;
  const prepared = dependencies(context, {
    preflightPublish: async (template) => {
      preflightCalled = true;
      assert.equal(template.layout.valueArea.baselineMm, 42);
      return { ok: false, errors: ["VALUE text overflow"] };
    },
  });

  await assert.rejects(() => bootstrapVoucherTemplates(prepared.deps), /VALUE text overflow/);
  assert.equal(preflightCalled, true);
  assert.equal(context.getTemplate(), null);
  assert.equal(context.getAuditCount(), 0);
  assert.equal(prepared.deleted.length, 2);
});

test("existující validní preview se znovu negeneruje a metadata zůstanou beze změny", async () => {
  const context = createDb({ existing: true, previewStoragePath: "voucher-templates/classic-template/preview-valid.png" });
  const before = { ...context.getTemplate()! };
  const prepared = dependencies(context);

  await bootstrapVoucherTemplates(prepared.deps);
  const after = context.getTemplate()!;
  assert.equal(after.masterStoragePath, before.masterStoragePath);
  assert.equal(after.masterSha256, before.masterSha256);
  assert.equal(after.publishedAt?.toISOString(), before.publishedAt?.toISOString());
  assert.equal(after.publishedByUserId, before.publishedByUserId);
  assert.equal(after.previewStoragePath, before.previewStoragePath);
  assert.equal(prepared.getMasterWrites(), 0);
  assert.equal(prepared.getPreviewWrites(), 0);
  assert.deepEqual(prepared.deleted, []);
});

test("historická neaktivní classic-v1 s validními assety neblokuje deploy ani se nemění", async () => {
  const context = createDb({
    existing: true,
    existingStatus: "INACTIVE",
    previewStoragePath: "voucher-templates/classic-template/preview-valid.png",
    defaultTemplateId: "other-published-template",
  });
  const before = { ...context.getTemplate()! };
  const prepared = dependencies(context);

  await bootstrapVoucherTemplates(prepared.deps);

  assert.deepEqual(context.getTemplate(), before);
  assert.equal(context.getSettings().voucherDefaultTemplateId, "other-published-template");
  assert.equal(prepared.getMasterWrites(), 0);
  assert.equal(prepared.getPreviewWrites(), 0);
});

test("existující preview s chybějícím souborem se opraví a starý pointer se uklidí až po commitu", async () => {
  const context = createDb({ existing: true, previewStoragePath: "voucher-templates/classic-template/preview-missing.png" });
  const prepared = dependencies(context, { readStoredPreview: async () => { throw new Error("preview missing"); } });

  await bootstrapVoucherTemplates(prepared.deps);

  assert.equal(context.getTemplate()?.previewStoragePath, "voucher-templates/classic-template/preview-1.png");
  assert.equal(prepared.getPreviewWrites(), 1);
  assert.deepEqual(prepared.deleted, ["voucher-templates/classic-template/preview-missing.png"]);
});

test("existující corrupt preview se opraví validovaným masterem", async () => {
  const context = createDb({ existing: true, previewStoragePath: "voucher-templates/classic-template/preview-corrupt.png" });
  const prepared = dependencies(context, {
    validatePreview: async () => ({ ok: false, reason: "decode-failed" }),
  });

  await bootstrapVoucherTemplates(prepared.deps);

  assert.equal(context.getTemplate()?.previewStoragePath, "voucher-templates/classic-template/preview-1.png");
  assert.equal(prepared.getPreviewWrites(), 1);
  assert.deepEqual(prepared.deleted, ["voucher-templates/classic-template/preview-corrupt.png"]);
});

test("selhání preview CAS po zápisu uklidí pouze nové preview a zachová starý pointer", async () => {
  const oldPreview = "voucher-templates/classic-template/preview-corrupt.png";
  const context = createDb({ existing: true, previewStoragePath: oldPreview, previewUpdateConflict: true });
  const prepared = dependencies(context, {
    validatePreview: async () => ({ ok: false, reason: "decode-failed" }),
  });

  await assert.rejects(() => bootstrapVoucherTemplates(prepared.deps), /atomicky opravit preview/);

  assert.equal(context.getTemplate()?.previewStoragePath, oldPreview);
  assert.deepEqual(prepared.deleted, ["voucher-templates/classic-template/preview-1.png"]);
});

test("druhý bootstrap je idempotentní a preview znovu nezapisuje", async () => {
  const context = createDb({ existing: true });
  const prepared = dependencies(context);

  await bootstrapVoucherTemplates(prepared.deps);
  const afterFirst = context.getTemplate();
  const firstUpdateCount = context.getUpdateCount();
  await bootstrapVoucherTemplates(prepared.deps);

  assert.equal(prepared.getPreviewWrites(), 1);
  assert.equal(context.getUpdateCount(), firstUpdateCount);
  assert.equal(context.getAuditCount(), 0);
  assert.equal(context.getVouchers()[0]?.templateId, "classic-template");
  assert.equal(context.getTemplate()?.previewStoragePath, afterFirst?.previewStoragePath);
});

test("selhání renderu fresh bootstrapu nezanechá DB ani asset", async () => {
  const context = createDb();
  const prepared = dependencies(context, { renderPreview: async () => { throw new Error("preview render failed"); } });

  await assert.rejects(() => bootstrapVoucherTemplates(prepared.deps), /preview render failed/);
  assert.equal(context.getTemplate(), null);
  assert.deepEqual(prepared.deleted, []);
  assert.equal(prepared.getMasterWrites(), 0);
  assert.equal(prepared.getPreviewWrites(), 0);
});

test("po zápisu assetů a DB chybě bootstrap uklidí master i preview a vrátí DB zpět", async () => {
  const context = createDb({ failAfterTransaction: true });
  const prepared = dependencies(context);

  await assert.rejects(() => bootstrapVoucherTemplates(prepared.deps), /simulated DB failure/);
  assert.equal(context.getTemplate(), null);
  assert.equal(context.wasTemplateDeleted(), true);
  assert.deepEqual(prepared.deleted, [
    "voucher-templates/classic-template/master-new.pdf",
    "voucher-templates/classic-template/preview-1.png",
  ]);
});

test("souběžný bootstrap sdílí advisory lock a druhá operace je idempotentní", async () => {
  const context = createDb({ advisoryLock: true });
  const prepared = dependencies(context);
  let firstWriteStartedResolve: (() => void) | null = null;
  let releaseFirstWrite: () => void = () => { throw new Error("releaseFirstWrite nebyl připraven"); };
  const firstWriteStarted = new Promise<void>((resolve) => { firstWriteStartedResolve = resolve; });
  const allowFirstWrite = new Promise<void>((resolve) => { releaseFirstWrite = () => resolve(); });
  let writes = 0;
  prepared.deps.writeMaster = async () => {
    writes += 1;
    if (writes === 1) {
      firstWriteStartedResolve?.();
      await allowFirstWrite;
    }
    return { storagePath: `voucher-templates/classic-template/master-${writes}.pdf`, sha256: masterSha256 };
  };

  const first = bootstrapVoucherTemplates(prepared.deps);
  await firstWriteStarted;
  const second = bootstrapVoucherTemplates(prepared.deps);
  await new Promise<void>((resolve) => setImmediate(resolve));
  releaseFirstWrite();
  await Promise.all([first, second]);

  assert.equal(context.getTemplate()?.key, "classic-v1");
  assert.equal(context.getTemplate()?.status, "PUBLISHED");
  assert.equal(context.getVouchers()[0]?.templateId, "classic-template");
  assert.equal(writes, 1);
  assert.equal(prepared.getPreviewWrites(), 1);
  assert.equal(context.getAuditCount(), 1);
  assert.deepEqual(prepared.deleted, []);
});

test("master SHA mismatch bootstrap zastaví a publikovaný master nepřepíše", async () => {
  const context = createDb({ existing: true });
  const before = { ...context.getTemplate()! };
  const prepared = dependencies(context, { readStoredMaster: async () => Buffer.from("%PDF-1.4\nchanged") });

  await assert.rejects(() => bootstrapVoucherTemplates(prepared.deps), /kontrolní součet/);
  assert.deepEqual(context.getTemplate(), before);
  assert.equal(prepared.getPreviewWrites(), 0);
  assert.deepEqual(prepared.deleted, []);
});
