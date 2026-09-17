import assert from "node:assert/strict";
import test from "node:test";

import { AdminRole, VoucherPrintBatchStatus } from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

const ownerSession = {
  sub: "owner-1",
  email: "owner@example.com",
  name: "Owner",
  role: AdminRole.OWNER,
  iat: 1,
  exp: 999999,
};

function createBatch(status: VoucherPrintBatchStatus) {
  return {
    batchNumber: "2027-001",
    templateKey: "classic-v1",
    status,
    items: [{ code: "PP-2027-ABC234" }, { code: "PP-2027-DEF567" }],
  };
}

async function createRoute(getBatch: () => ReturnType<typeof createBatch>) {
  const { createAdminVoucherStockPdfRoute } = await import("./admin-voucher-stock-pdf-route");
  const generatedBatches: Array<{ batchNumber: string; templateKey: string; items: readonly { code: string }[] }> = [];
  const route = createAdminVoucherStockPdfRoute({
    getSession: async () => ownerSession,
    findBatch: async () => getBatch(),
    generatePdf: async (batch) => {
      generatedBatches.push(batch);
      return Uint8Array.from([37, 80, 68, 70]);
    },
  });

  return { route, generatedBatches };
}

function requestContext() {
  return { params: Promise.resolve({ batchId: "batch-1" }) };
}

test("PENDING_PRINT umožní opakované stažení stejného batch PDF", async () => {
  const { route, generatedBatches } = await createRoute(() => createBatch(VoucherPrintBatchStatus.PENDING_PRINT));

  const first = await route(new Request("https://example.com"), requestContext());
  const second = await route(new Request("https://example.com"), requestContext());

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(generatedBatches.length, 2);
  assert.deepEqual(generatedBatches[0], generatedBatches[1]);
  assert.deepEqual(generatedBatches[0]?.items.map((item) => item.code), ["PP-2027-ABC234", "PP-2027-DEF567"]);
});

for (const status of [VoucherPrintBatchStatus.RECEIVED, VoucherPrintBatchStatus.CLOSED]) {
  test(`${status} odmítne batch PDF před generováním`, async () => {
    const { route, generatedBatches } = await createRoute(() => createBatch(status));
    const response = await route(new Request("https://example.com"), requestContext());

    assert.equal(response.status, 409);
    assert.equal(generatedBatches.length, 0);
  });
}

test("přechod PENDING_PRINT → RECEIVED okamžitě zablokuje další request", async () => {
  let status: VoucherPrintBatchStatus = VoucherPrintBatchStatus.PENDING_PRINT;
  const { route, generatedBatches } = await createRoute(() => createBatch(status));

  assert.equal((await route(new Request("https://example.com"), requestContext())).status, 200);
  status = VoucherPrintBatchStatus.RECEIVED;
  assert.equal((await route(new Request("https://example.com"), requestContext())).status, 409);
  assert.equal(generatedBatches.length, 1);
});
