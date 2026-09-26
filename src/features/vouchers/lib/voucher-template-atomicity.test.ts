import assert from "node:assert/strict";
import test from "node:test";

import { defaultVoucherTemplateLayout } from "./voucher-template-defaults";

process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("template mutation rollbackne při chybě auditu a DELETE_DRAFT nese snapshot identity", async (t) => {
  let template: Record<string, unknown> | null = {
    id: "template-1",
    key: "audit-v1",
    familyKey: "audit",
    version: 1,
    label: "Audit test",
    status: "DRAFT",
    allowedTypes: ["VALUE"],
    layout: defaultVoucherTemplateLayout,
    masterStoragePath: "voucher-templates/template-1/master.pdf",
    masterSha256: "hash",
    previewStoragePath: null,
    updatedAt: new Date("2026-09-26T08:00:00.000Z"),
  };
  let auditFailure = true;
  const audits: Array<Record<string, unknown>> = [];

  const db = {
    voucherTemplate: {
      findUnique: async () => template,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        template = { ...(template ?? {}), ...data };
        return template;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const expected = where.updatedAt;
        const current = template?.updatedAt;
        if (expected instanceof Date && current instanceof Date && expected.getTime() !== current.getTime()) return { count: 0 };
        template = { ...(template ?? {}), ...data, updatedAt: new Date("2026-09-26T08:02:00.000Z") };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => {
        if (!template) throw new Error("missing template");
        return template;
      },
      delete: async () => { template = null; },
    },
    voucherTemplateAuditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (auditFailure) throw new Error("audit failure");
        audits.push(data);
      },
    },
    voucher: { count: async () => 0 },
    voucherPrintBatch: { count: async () => 0 },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const before = template ? { ...template } : null;
      try {
        return await callback(db);
      } catch (error) {
        template = before;
        throw error;
      }
    },
  };

  t.mock.module("@/lib/prisma", { exports: { prisma: db } });
  t.mock.module("@/features/vouchers/lib/voucher-template-storage", { exports: { deleteVoucherTemplateAsset: async () => undefined } });
  t.mock.module("@/features/vouchers/lib/voucher-template-preflight", { exports: { preflightVoucherTemplateMaster: async () => ({ errors: [] }) } });

  const domain = await import("./voucher-template-domain");

  await assert.rejects(
    () => domain.updateVoucherTemplateDraft("template-1", { layout: defaultVoucherTemplateLayout, allowedTypes: ["VALUE"], label: "Změna", actorUserId: "owner-1" }),
    /audit failure/,
  );
  assert.equal(template?.label, "Audit test");
  assert.equal(audits.length, 0);

  auditFailure = false;
  template = { ...(template ?? {}), updatedAt: new Date("2026-09-26T08:01:00.000Z") };
  await assert.rejects(
    () => domain.updateVoucherTemplateDraft("template-1", {
      layout: defaultVoucherTemplateLayout,
      allowedTypes: ["VALUE"],
      label: "Stará změna",
      actorUserId: "owner-1",
      expectedUpdatedAt: new Date("2026-09-26T08:00:00.000Z"),
    }),
    (error: unknown) => error instanceof domain.VoucherTemplateDomainError && error.code === "INVALID_STATE",
  );
  assert.equal(template?.label, "Audit test");
  assert.equal(audits.length, 0);

  await domain.updateVoucherTemplateDraft("template-1", {
    layout: defaultVoucherTemplateLayout,
    allowedTypes: ["VALUE"],
    label: "Nová změna",
    actorUserId: "owner-1",
    expectedUpdatedAt: new Date("2026-09-26T08:01:00.000Z"),
  });
  assert.equal(template?.label, "Nová změna");
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.operation, "UPDATE_DRAFT");

  await domain.deleteVoucherTemplateDraft("template-1", "owner-1");
  assert.equal(template, null);
  assert.equal(audits.length, 2);
  assert.deepEqual(
    { templateId: audits[1]?.templateId, templateKey: audits[1]?.templateKey, familyKey: audits[1]?.familyKey, version: audits[1]?.version, operation: audits[1]?.operation },
    { templateId: "template-1", templateKey: "audit-v1", familyKey: "audit", version: 1, operation: "DELETE_DRAFT" },
  );
});
