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
  await domain.deleteVoucherTemplateDraft("template-1", "owner-1");
  assert.equal(template, null);
  assert.equal(audits.length, 1);
  assert.deepEqual(
    { templateId: audits[0]?.templateId, templateKey: audits[0]?.templateKey, familyKey: audits[0]?.familyKey, version: audits[0]?.version, operation: audits[0]?.operation },
    { templateId: "template-1", templateKey: "audit-v1", familyKey: "audit", version: 1, operation: "DELETE_DRAFT" },
  );
});
