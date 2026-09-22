import assert from "node:assert/strict";
import test from "node:test";
import type { VoucherTemplateBootstrapDependencies } from "./voucher-template-bootstrap";

process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

async function bootstrapVoucherTemplates(...args: Parameters<(typeof import("./voucher-template-bootstrap")) ["bootstrapVoucherTemplates"]>) {
  const { bootstrapVoucherTemplates: bootstrap } = await import("./voucher-template-bootstrap");
  return bootstrap(...args);
}

function createDb(options: { existing?: boolean; failTransaction?: boolean } = {}) {
  type FakeTemplate = { id: string; key: string; familyKey: string; version: number; label: string; status: "PUBLISHED" | "DRAFT"; masterStoragePath: string | null; masterSha256: string | null };
  let template: FakeTemplate | null = options.existing
    ? { id: "classic-template", key: "classic-v1", familyKey: "classic", version: 1, label: "Klasický", status: "PUBLISHED", masterStoragePath: "voucher-templates/classic-template/master-existing.pdf", masterSha256: "hash" }
    : null;
  let vouchers = [{ templateId: null as string | null, templateKey: "classic-v1" }];
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
      findUnique: async () => ({ voucherDefaultTemplateId: options.existing ? "classic-template" : null }),
      updateMany: async () => ({ count: 1 }),
    },
    voucherTemplateAuditLog: { create: async () => undefined },
    adminUser: { findFirst: async () => ({ id: "owner" }) },
    voucherTemplate: {
      findUnique: async () => template,
      create: async (): Promise<FakeTemplate> => {
        template = { id: "classic-template", key: "classic-v1", familyKey: "classic", version: 1, label: "Klasický", status: "DRAFT", masterStoragePath: null, masterSha256: null };
        return template;
      },
      update: async ({ data }: { data: Partial<FakeTemplate> }) => {
        template = { ...(template as FakeTemplate), ...data };
        return template;
      },
    },
  };
  const db = {
    voucherTemplate: {
      findUnique: async () => template,
      create: async (): Promise<FakeTemplate> => {
        template = { id: "classic-template", key: "classic-v1", familyKey: "classic", version: 1, label: "Klasický", status: "DRAFT", masterStoragePath: null, masterSha256: null };
        return template;
      },
      update: async ({ data }: { data: { masterStoragePath: string; masterSha256: string; status: string } }) => {
        template = { ...(template ?? { id: "classic-template", key: "classic-v1", status: "DRAFT" as const, masterStoragePath: null, masterSha256: null }), ...data } as FakeTemplate;
        return template;
      },
      delete: async () => { deletedTemplate = true; },
    },
    adminUser: { findFirst: async () => ({ id: "owner" }) },
    $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => {
      const result = await callback(transaction);
      if (options.failTransaction) throw new Error("simulated DB failure");
      return result;
    },
  } as unknown as NonNullable<VoucherTemplateBootstrapDependencies["db"]>;
  return { db, getVouchers: () => vouchers, wasTemplateDeleted: () => deletedTemplate };
}

test("bootstrap backfilluje legacy vouchery a druhý běh nemění žádný řádek", async () => {
  const context = createDb({ existing: true });
  const first = await bootstrapVoucherTemplates({ db: context.db, readMaster: async () => Buffer.from("%PDF-"), writeMaster: async () => ({ storagePath: "unused", sha256: "unused" }) });
  const second = await bootstrapVoucherTemplates({ db: context.db, readMaster: async () => Buffer.from("%PDF-"), writeMaster: async () => ({ storagePath: "unused", sha256: "unused" }) });

  assert.equal(first.backfilledVouchers, 1);
  assert.equal(first.remainingNulls, 0);
  assert.equal(second.backfilledVouchers, 0);
  assert.equal(second.remainingNulls, 0);
  assert.equal(context.getVouchers()[0]?.templateId, "classic-template");
});

test("bootstrap po úspěšném storage write a DB chybě odstraní pouze nový asset", async () => {
  const context = createDb({ failTransaction: true });
  const deleted: string[] = [];

  await assert.rejects(() => bootstrapVoucherTemplates({
    db: context.db,
    readMaster: async () => Buffer.from("%PDF-"),
    writeMaster: async () => ({ storagePath: "voucher-templates/classic-template/master-new.pdf", sha256: "new-hash" }),
    deleteAsset: async (storagePath) => { deleted.push(storagePath ?? ""); },
  }), /simulated DB failure/);

  assert.deepEqual(deleted, ["voucher-templates/classic-template/master-new.pdf"]);
  assert.equal(context.wasTemplateDeleted(), true);
});

test("souběžný bootstrap skončí jedním classic-v1 bez unique chyby", async () => {
  const context = createDb();
  let queue = Promise.resolve();
  let writes = 0;
  const transaction = context.db.$transaction;
  Object.defineProperty(context.db, "$transaction", {
    configurable: true,
    value: async (callback: unknown) => {
      let release!: () => void;
      const previous = queue;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        return await (transaction as (operation: unknown) => Promise<unknown>)(callback);
      } finally {
        release();
      }
    },
  });

  const [first, second] = await Promise.all([
    bootstrapVoucherTemplates({ db: context.db, readMaster: async () => Buffer.from("%PDF-"), writeMaster: async () => { writes += 1; return { storagePath: "unused", sha256: "unused" }; } }),
    bootstrapVoucherTemplates({ db: context.db, readMaster: async () => Buffer.from("%PDF-"), writeMaster: async () => { writes += 1; return { storagePath: "unused", sha256: "unused" }; } }),
  ]);

  assert.equal(writes, 1);
  assert.equal(first.remainingNulls, 0);
  assert.equal(second.remainingNulls, 0);
  assert.equal(context.getVouchers()[0]?.templateId, "classic-template");
});
