import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import { defaultVoucherTemplateLayout } from "./voucher-template-defaults";
import { VOUCHER_TEMPLATE_PREVIEW_LIMITS } from "./voucher-template-preview-validation";
import { validVoucherTemplatePreviewPng } from "./voucher-template-test-fixtures";

process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("publish vyžaduje fyzicky dostupný validní PNG preview", async (t) => {
  const validPng = validVoucherTemplatePreviewPng;
  const jpeg = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
  const webp = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#ffffff" } }).webp().toBuffer();
  const oversizedPng = await sharp({
    create: {
      width: VOUCHER_TEMPLATE_PREVIEW_LIMITS.maxWidth + 1,
      height: 1,
      channels: 3,
      background: "#ffffff",
    },
  }).png().toBuffer();
  const corruptPng = Buffer.from(validPng);
  const idatOffset = corruptPng.indexOf(Buffer.from("IDAT"));
  corruptPng[idatOffset + 4] ^= 0xff;
  let preview: Buffer | null = null;
  const template = {
    id: "template-1",
    key: "classic-v1",
    familyKey: "classic",
    version: 1,
    label: "Klasický",
    status: "DRAFT" as "DRAFT" | "PUBLISHED",
    allowedTypes: ["VALUE", "SERVICE"] as const,
    layout: defaultVoucherTemplateLayout,
    masterStoragePath: "voucher-templates/template-1/master-test.pdf",
    masterSha256: "master-hash",
    previewStoragePath: "voucher-templates/template-1/preview-test.png" as string | null,
  };
  const db = {
    voucherTemplate: {
      findUnique: async () => template,
      updateMany: async () => { template.status = "PUBLISHED"; return { count: 1 }; },
      findUniqueOrThrow: async () => template,
    },
    voucherTemplateAuditLog: { create: async () => undefined },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  };

  t.mock.module("@/lib/prisma", { exports: { prisma: db } });
  t.mock.module("@/features/vouchers/lib/voucher-template-storage", {
    exports: {
      deleteVoucherTemplateAsset: async () => undefined,
      readVoucherTemplateMaster: async () => Buffer.from("%PDF-master"),
      readVoucherTemplatePreview: async () => {
        if (!preview) throw new Error("preview missing");
        return preview;
      },
      sha256: () => "master-hash",
      voucherTemplateMasterExists: async () => true,
      writeVoucherTemplateMaster: async () => ({ storagePath: "master", sha256: "master-hash" }),
      writeVoucherTemplatePreview: async () => ({ storagePath: "preview" }),
    },
  });
  t.mock.module("@/features/vouchers/lib/voucher-template-preflight", { exports: { preflightVoucherTemplateMaster: async () => ({ errors: [] }) } });
  t.mock.module("@/features/vouchers/lib/voucher-template-repository", { exports: { resolveVoucherTemplate: async () => ({ ...template, masterBytes: Buffer.from("%PDF-master") }) } });
  t.mock.module("@/features/vouchers/lib/voucher-template-publish-preflight", { exports: { preflightVoucherTemplateForPublish: async () => ({ ok: true, errors: [] }) } });
  t.mock.module("@/features/vouchers/lib/voucher-template-preview", { exports: { renderVoucherTemplatePreview: async () => validPng } });

  const domain = await import("./voucher-template-domain");
  const expectMasterInvalid = async (message: string) => {
    template.status = "DRAFT";
    await assert.rejects(
      () => domain.publishVoucherTemplate("template-1", "owner-1"),
      (error: unknown) => error instanceof domain.VoucherTemplateDomainError && error.code === "MASTER_INVALID" && error.message.includes(message),
    );
    assert.equal(template.status, "DRAFT");
  };

  template.previewStoragePath = null;
  await expectMasterInvalid("chybí");

  template.previewStoragePath = "voucher-templates/template-1/preview-test.png";
  preview = null;
  await expectMasterInvalid("dostupný");

  preview = Buffer.from("not-png");
  await expectMasterInvalid("PNG");

  preview = corruptPng;
  await expectMasterInvalid("PNG");

  preview = validPng.subarray(0, validPng.length - 1);
  await expectMasterInvalid("PNG");

  preview = validPng.subarray(0, 8);
  await expectMasterInvalid("PNG");

  preview = jpeg;
  await expectMasterInvalid("PNG");

  preview = webp;
  await expectMasterInvalid("PNG");

  preview = oversizedPng;
  await expectMasterInvalid("PNG");

  preview = validPng;
  await domain.publishVoucherTemplate("template-1", "owner-1");
  assert.equal(template.status, "PUBLISHED");
});
