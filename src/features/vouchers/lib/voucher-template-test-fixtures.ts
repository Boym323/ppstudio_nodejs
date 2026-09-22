import { createHash } from "node:crypto";
import test from "node:test";

import { defaultVoucherTemplateLayout } from "./voucher-template-defaults";

const unitMasterBytes = Buffer.from("%PDF-1.4\n% PP Studio unit-test master\n", "utf8");
const unitPrisma = {
  $transaction: async () => {
    throw new Error("Unit test transaction mock was not installed.");
  },
};

export const voucherTemplateUnitFixture = {
  id: "voucher-template-unit-test",
  key: "classic-v1",
  familyKey: "classic",
  version: 1,
  label: "Klasický unit test",
  status: "PUBLISHED" as const,
  allowedTypes: ["VALUE", "SERVICE"] as const,
  layout: defaultVoucherTemplateLayout,
  masterStoragePath: "voucher-templates/voucher-template-unit-test/master-unit-test.pdf",
  masterSha256: createHash("sha256").update(unitMasterBytes).digest("hex"),
  masterBytes: unitMasterBytes,
};

export function mockVoucherTemplateRepository(t: test.TestContext) {
  t.mock.module("@/features/vouchers/lib/voucher-template-repository", {
    exports: {
      getVoucherTemplateByKey: async () => voucherTemplateUnitFixture,
      isVoucherTemplateAllowedForType: (
        template: { allowedTypes: readonly string[]; status: string },
        type: string,
      ) => template.status === "PUBLISHED" && template.allowedTypes.includes(type),
    },
  });
}

export function mockVoucherPrisma(t: test.TestContext) {
  t.mock.module("@/lib/prisma", { exports: { prisma: unitPrisma } });
}
