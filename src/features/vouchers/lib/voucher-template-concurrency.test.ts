import assert from "node:assert/strict";
import test from "node:test";

import { defaultVoucherTemplateLayout } from "./voucher-template-defaults";
import { validVoucherTemplatePreviewPng } from "./voucher-template-test-fixtures";

process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("souběžný replace stejného draftu pustí jen jednu master+preview dvojici", async (t) => {
  const template = {
    id: "template-1",
    key: "classic-v1",
    familyKey: "classic",
    version: 1,
    label: "Klasický",
    status: "DRAFT" as const,
    allowedTypes: ["VALUE", "SERVICE"] as const,
    layout: defaultVoucherTemplateLayout,
    masterStoragePath: null,
    masterSha256: null,
    previewStoragePath: null,
  };
  let writes = 0;
  let previewWrites = 0;
  let waiting = 0;
  let releaseBarrier: (() => void) | null = null;
  const barrier = new Promise<void>((resolve) => { releaseBarrier = resolve; });
  let committed = false;
  const deleted: string[] = [];
  const db = {
    voucherTemplate: {
      findUnique: async () => ({ ...template }),
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        if (committed) return { count: 0 };
        committed = true;
        Object.assign(template, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...template }),
    },
    voucherTemplateAuditLog: { create: async () => undefined },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  };

  t.mock.module("@/lib/prisma", { exports: { prisma: db } });
  t.mock.module("@/features/vouchers/lib/voucher-template-storage", {
    exports: {
      deleteVoucherTemplateAsset: async (storagePath: string | null | undefined) => { if (storagePath) deleted.push(storagePath); },
      writeVoucherTemplateMaster: async () => {
        const id = ++writes;
        waiting += 1;
        if (waiting === 2) releaseBarrier?.();
        await barrier;
        return { storagePath: `voucher-templates/template-1/master-${id}.pdf`, sha256: `hash-${id}` };
      },
      writeVoucherTemplatePreview: async () => {
        const id = ++previewWrites;
        return { storagePath: `voucher-templates/template-1/preview-${id}.png` };
      },
    },
  });
  t.mock.module("@/features/vouchers/lib/voucher-template-preflight", { exports: { preflightVoucherTemplateMaster: async () => ({ errors: [] }) } });
  t.mock.module("@/features/vouchers/lib/voucher-template-preview", { exports: { renderVoucherTemplatePreview: async () => validVoucherTemplatePreviewPng } });

  const domain = await import("./voucher-template-domain");
  const results = await Promise.allSettled([
    domain.replaceVoucherTemplateMaster("template-1", Buffer.from("%PDF-one"), "owner-1"),
    domain.replaceVoucherTemplateMaster("template-1", Buffer.from("%PDF-two"), "owner-2"),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const winnerNumber = /master-(\d+)\.pdf/.exec(template.masterStoragePath ?? "")?.[1];
  const loserNumber = winnerNumber === "1" ? "2" : "1";
  assert.deepEqual(deleted, [
    `voucher-templates/template-1/master-${loserNumber}.pdf`,
    `voucher-templates/template-1/preview-${loserNumber}.png`,
  ]);
  assert.match(String(results.find((result) => result.status === "rejected")?.reason), /změnila/);
  assert.equal(template.previewStoragePath, `voucher-templates/template-1/preview-${winnerNumber}.png`);
});
