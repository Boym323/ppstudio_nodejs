import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("issuance query vybírá jen PUBLISHED šablony s aktuální strict validation policy", async (t) => {
  let query: Record<string, unknown> | null = null;
  t.mock.module("@/lib/prisma", {
    exports: {
      prisma: {
        voucherTemplate: {
          findMany: async (args: { where: Record<string, unknown> }) => {
            query = args.where;
            return [];
          },
        },
      },
    },
  });

  const repository = await import("./voucher-template-repository");
  await repository.listVoucherTemplatesForIssuance();

  assert.deepEqual(query, {
    status: "PUBLISHED",
    validationPolicy: "STRICT_V1",
  });
});
