import assert from "node:assert/strict";
import test from "node:test";

import { defaultVoucherTemplateLayout } from "./voucher-template-defaults";

process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("master upload má bezpečný commit point a publish odmítne změněný master", async (t) => {
  const state: {
    template: Record<string, unknown>;
    auditFail: boolean;
    updateFail: boolean;
    oldDeleteFail: boolean;
    publishRace: boolean;
    deleted: string[];
  } = {
    template: {
      id: "template-1",
      key: "classic-v1",
      familyKey: "classic",
      version: 1,
      label: "Klasický",
      status: "DRAFT",
      allowedTypes: ["VALUE", "SERVICE"],
      layout: defaultVoucherTemplateLayout,
      masterStoragePath: "voucher-templates/template-1/master-old.pdf",
      masterSha256: "old-hash",
    },
    auditFail: false,
    updateFail: false,
    oldDeleteFail: false,
    publishRace: false,
    deleted: [],
  };

  const reset = () => {
    state.template = {
      id: "template-1",
      key: "classic-v1",
      familyKey: "classic",
      version: 1,
      label: "Klasický",
      status: "DRAFT",
      allowedTypes: ["VALUE", "SERVICE"],
      layout: defaultVoucherTemplateLayout,
      masterStoragePath: "voucher-templates/template-1/master-old.pdf",
      masterSha256: "old-hash",
    };
    state.auditFail = false;
    state.updateFail = false;
    state.oldDeleteFail = false;
    state.publishRace = false;
    state.deleted = [];
  };

  const db = {
    voucherTemplate: {
      findUnique: async () => state.template,
      findUniqueOrThrow: async () => state.template,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        if (state.updateFail) throw new Error("db update failed");
        state.template = { ...state.template, ...data };
        return { count: 1 };
      },
    },
    voucherTemplateAuditLog: {
      create: async () => {
        if (state.auditFail) throw new Error("audit failed");
      },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const before = { ...state.template };
      if (state.publishRace) state.template = { ...state.template, masterStoragePath: "voucher-templates/template-1/master-raced.pdf", masterSha256: "raced-hash" };
      try {
        return await callback(db);
      } catch (error) {
        state.template = before;
        throw error;
      }
    },
  };

  t.mock.module("@/lib/prisma", { exports: { prisma: db } });
  t.mock.module("@/features/vouchers/lib/voucher-template-storage", {
    exports: {
      deleteVoucherTemplateAsset: async (path: string | null | undefined) => {
        if (path) state.deleted.push(path);
        if (path?.includes("master-old") && state.oldDeleteFail) throw new Error("old cleanup failed");
      },
      readVoucherTemplateMaster: async () => Buffer.from("master"),
      sha256: () => "old-hash",
      voucherTemplateMasterExists: async () => true,
      writeVoucherTemplateMaster: async () => ({ storagePath: "voucher-templates/template-1/master-new.pdf", sha256: "new-hash" }),
    },
  });
  t.mock.module("@/features/vouchers/lib/voucher-template-preflight", { exports: { preflightVoucherTemplateMaster: async () => ({ errors: [] }) } });
  t.mock.module("@/features/vouchers/lib/voucher-template-repository", {
    exports: {
      resolveVoucherTemplate: async (template: typeof state.template) => ({ ...template, masterBytes: Buffer.from("master") }),
    },
  });
  t.mock.module("@/features/vouchers/lib/voucher-template-publish-preflight", { exports: { preflightVoucherTemplateForPublish: async () => ({ ok: true, errors: [] }) } });

  const domain = await import("./voucher-template-domain");

  state.updateFail = true;
  await assert.rejects(() => domain.replaceVoucherTemplateMaster("template-1", Buffer.from("%PDF-master"), "owner-1"), /db update failed/);
  assert.equal(state.template.masterStoragePath, "voucher-templates/template-1/master-old.pdf");
  assert.deepEqual(state.deleted, ["voucher-templates/template-1/master-new.pdf"]);

  reset();
  state.oldDeleteFail = true;
  const switched = await domain.replaceVoucherTemplateMaster("template-1", Buffer.from("%PDF-master"), "owner-1");
  assert.equal(switched.masterStoragePath, "voucher-templates/template-1/master-new.pdf");
  assert.equal(state.template.masterStoragePath, "voucher-templates/template-1/master-new.pdf");
  assert.deepEqual(state.deleted, ["voucher-templates/template-1/master-old.pdf"]);

  reset();
  state.auditFail = true;
  await assert.rejects(() => domain.replaceVoucherTemplateMaster("template-1", Buffer.from("%PDF-master"), "owner-1"), /audit failed/);
  assert.equal(state.template.masterStoragePath, "voucher-templates/template-1/master-old.pdf");
  assert.deepEqual(state.deleted, ["voucher-templates/template-1/master-new.pdf"]);

  reset();
  state.publishRace = true;
  await assert.rejects(() => domain.publishVoucherTemplate("template-1", "owner-1"), /změnil/);
  assert.equal(state.template.status, "DRAFT");
});
