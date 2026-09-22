import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("deaktivace čte default uvnitř transakce i při souběžném přepnutí", async (t) => {
  const state = {
    defaultTemplateId: "other-template",
    template: { id: "template-1", key: "new-v1", familyKey: "new", version: 1, label: "Nová", status: "PUBLISHED" },
  };
  let transactionDefault = "template-1";
  const db = {
    siteSettings: { findUnique: async () => ({ voucherDefaultTemplateId: state.defaultTemplateId }) },
    voucherTemplate: {
      findUnique: async () => state.template,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => { state.template = { ...state.template, ...data } as typeof state.template; return { count: 1 }; },
    },
    voucherTemplateAuditLog: { create: async () => undefined },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      state.defaultTemplateId = transactionDefault;
      return callback(db);
    },
  };

  t.mock.module("@/lib/prisma", { exports: { prisma: db } });
  const domain = await import("./voucher-template-domain");

  await assert.rejects(
    () => domain.deactivateVoucherTemplate("template-1", "owner-1"),
    (error: unknown) => error instanceof domain.VoucherTemplateDomainError && error.code === "DEFAULT_GUARD",
  );
  assert.equal(state.template.status, "PUBLISHED");

  transactionDefault = "other-template";
  await domain.deactivateVoucherTemplate("template-1", "owner-1");
  assert.equal(state.template.status, "INACTIVE");
});
