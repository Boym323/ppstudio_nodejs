import assert from "node:assert/strict";
import test from "node:test";

import { defaultVoucherTemplateLayout } from "./voucher-template-defaults";

process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("domain lifecycle hlídá default, zachová historii a nepovolí hard-delete", async (t) => {
  let defaultTemplateId = "template-1";
  let currentTemplate: Record<string, unknown> | null = {
    id: "template-1",
    key: "classic-v1",
    familyKey: "classic",
    version: 1,
    label: "Klasický",
    status: "PUBLISHED",
    allowedTypes: ["VALUE", "SERVICE"],
    layout: defaultVoucherTemplateLayout,
    masterStoragePath: "voucher-templates/template-1/master-test.pdf",
    masterSha256: "hash",
  };
  const updates: unknown[] = [];
  const audits: unknown[] = [];
  const deletedAssets: Array<string | null | undefined> = [];
  const prisma = {
    siteSettings: { findUnique: async () => ({ voucherDefaultTemplateId: defaultTemplateId }) },
    voucherTemplate: {
      findUnique: async () => currentTemplate,
      update: async ({ data }: { data: unknown }) => { updates.push(data); currentTemplate = { ...(currentTemplate ?? {}), ...(data as object) }; return currentTemplate; },
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        currentTemplate = { ...(currentTemplate ?? {}), ...data };
        return { count: 1 };
      },
      aggregate: async () => ({ _max: { version: Number(currentTemplate?.version ?? 1) } }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        currentTemplate = { ...(currentTemplate ?? {}), ...data, id: "template-clone", status: "DRAFT" };
        return currentTemplate;
      },
      findUniqueOrThrow: async () => {
        if (!currentTemplate) throw new Error("missing template");
        return currentTemplate;
      },
      delete: async () => { currentTemplate = null; },
    },
    voucherTemplateAuditLog: { create: async ({ data }: { data: unknown }) => { audits.push(data); } },
    voucher: { count: async () => 0 },
    voucherPrintBatch: { count: async () => 0 },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma),
  };

  t.mock.module("@/lib/prisma", { exports: { prisma } });
  t.mock.module("@/features/vouchers/lib/voucher-template-storage", {
    exports: {
      deleteVoucherTemplateAsset: async (path: string | null | undefined) => { deletedAssets.push(path); },
      readVoucherTemplateMaster: async () => Buffer.from("master"),
      sha256: () => "hash",
      voucherTemplateMasterExists: async () => true,
      writeVoucherTemplateMaster: async () => ({ storagePath: "voucher-templates/template-1/master-new.pdf", sha256: "hash" }),
    },
  });
  t.mock.module("@/features/vouchers/lib/voucher-template-preflight", { exports: { preflightVoucherTemplateMaster: async () => ({ errors: [] }) } });

  const domain = await import("./voucher-template-domain");

  await assert.rejects(
    () => domain.deactivateVoucherTemplate("template-1", "owner-1"),
    (error: unknown) => error instanceof domain.VoucherTemplateDomainError && error.code === "DEFAULT_GUARD",
  );

  defaultTemplateId = "other-template";
  await domain.deactivateVoucherTemplate("template-1", "owner-1");
  assert.equal((updates.at(-1) as { status: string }).status, "INACTIVE");
  assert.equal((audits.at(-1) as { operation: string }).operation, "DEACTIVATE");

  currentTemplate = { ...currentTemplate, id: "template-1", status: "INACTIVE", version: 1 };
  const clone = await domain.cloneVoucherTemplateVersion("template-1", "owner-1");
  assert.equal(clone.id, "template-clone");
  assert.equal(clone.key, "classic-v2");
  assert.equal((audits.at(-1) as { operation: string }).operation, "CLONE_VERSION");

  currentTemplate = { ...(currentTemplate ?? {}), id: "draft-1", status: "DRAFT", masterStoragePath: "voucher-templates/draft-1/master-test.pdf", previewStoragePath: "voucher-templates/draft-1/preview-test.png" };
  await domain.deleteVoucherTemplateDraft("draft-1", "owner-1");
  assert.equal((audits.at(-1) as { operation: string }).operation, "DELETE_DRAFT");
  assert.deepEqual(deletedAssets, ["voucher-templates/draft-1/master-test.pdf", "voucher-templates/draft-1/preview-test.png"]);

  currentTemplate = { ...(currentTemplate ?? {}), id: "published-1", status: "PUBLISHED" };
  await assert.rejects(
    () => domain.deleteVoucherTemplateDraft("published-1", "owner-1"),
    (error: unknown) => error instanceof domain.VoucherTemplateDomainError && error.code === "IMMUTABLE",
  );
});
