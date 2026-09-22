import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import type { VoucherTemplateBootstrapDependencies } from "./voucher-template-bootstrap";
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
  previewStoragePath?: string | null;
  failAfterTransaction?: boolean;
} = {}) {
  type FakeTemplate = {
    id: string;
    key: string;
    familyKey: string;
    version: number;
    label: string;
    status: "PUBLISHED" | "DRAFT";
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
        status: "PUBLISHED",
        masterStoragePath: "voucher-templates/classic-template/master-existing.pdf",
        masterSha256,
        previewStoragePath: options.previewStoragePath ?? null,
        publishedAt: new Date("2026-09-22T10:00:00.000Z"),
        publishedByUserId: "owner",
      }
    : null;
  let vouchers = [{ templateId: null as string | null, templateKey: "classic-v1" }];
  let settings = { voucherDefaultTemplateId: options.existing ? "classic-template" : null as string | null };
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
          status: "DRAFT",
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
        if (!template || Object.entries(where).some(([key, value]) => template?.[key as keyof FakeTemplate] !== value)) return { count: 0 };
        template = { ...template, ...data };
        return { count: 1 };
      },
    },
  };
  const db = {
    voucherTemplate: { delete: async () => { deletedTemplate = true; template = null; } },
    $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => {
      const before = { template: template ? { ...template } : null, vouchers: vouchers.map((voucher) => ({ ...voucher })), settings: { ...settings }, auditCount, updateCount };
      try {
        const result = await callback(transaction);
        if (options.failAfterTransaction) throw new Error("simulated DB failure");
        return result;
      } catch (error) {
        template = before.template;
        vouchers = before.vouchers;
        settings = before.settings;
        auditCount = before.auditCount;
        updateCount = before.updateCount;
        throw error;
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
    masterExists: async () => true,
    preflightMaster: async () => ({ errors: [] } as never),
    renderPreview: async () => png,
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
  assert.equal(template?.status, "PUBLISHED");
  assert.equal(template?.masterStoragePath, "voucher-templates/classic-template/master-new.pdf");
  assert.equal(template?.masterSha256, masterSha256);
  assert.equal(template?.previewStoragePath, "voucher-templates/classic-template/preview-1.png");
  assert.equal(context.getSettings().voucherDefaultTemplateId, "classic-template");
  assert.equal(context.getAuditCount(), 1);
  assert.deepEqual(prepared.deleted, []);
});

test("existující PUBLISHED classic-v1 doplní preview bez změny masteru a published metadat", async () => {
  const context = createDb({ existing: true });
  const before = { ...context.getTemplate()! };
  const prepared = dependencies(context);

  await bootstrapVoucherTemplates(prepared.deps);
  const after = context.getTemplate()!;
  assert.equal(after.masterStoragePath, before.masterStoragePath);
  assert.equal(after.masterSha256, before.masterSha256);
  assert.equal(after.publishedAt?.toISOString(), before.publishedAt?.toISOString());
  assert.equal(after.publishedByUserId, before.publishedByUserId);
  assert.equal(after.previewStoragePath, "voucher-templates/classic-template/preview-1.png");
  assert.equal(prepared.getMasterWrites(), 0);
  assert.equal(prepared.getPreviewWrites(), 1);
  assert.deepEqual(prepared.deleted, []);
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

test("master SHA mismatch bootstrap zastaví a publikovaný master nepřepíše", async () => {
  const context = createDb({ existing: true });
  const before = { ...context.getTemplate()! };
  const prepared = dependencies(context, { readStoredMaster: async () => Buffer.from("%PDF-1.4\nchanged") });

  await assert.rejects(() => bootstrapVoucherTemplates(prepared.deps), /kontrolní součet/);
  assert.deepEqual(context.getTemplate(), before);
  assert.equal(prepared.getPreviewWrites(), 0);
  assert.deepEqual(prepared.deleted, []);
});
