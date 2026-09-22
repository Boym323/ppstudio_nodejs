import assert from "node:assert/strict";
import test from "node:test";

import { Prisma, VoucherType } from "@/generated/prisma/client";

import { mockVoucherPrisma, mockVoucherTemplateRepository } from "./voucher-template-test-fixtures";

process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`Prisma test ${code}`, { code, clientVersion: "test" });
}

function mockTransaction(t: test.TestContext, prisma: { $transaction: unknown }, implementation: (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => Promise<unknown>) {
  const client = prisma as { $transaction: typeof implementation };
  const original = client.$transaction;
  Object.defineProperty(client, "$transaction", { configurable: true, value: implementation, writable: true });
  t.after(() => Object.defineProperty(client, "$transaction", { configurable: true, value: original, writable: true }));
}

function valueVoucherInput() {
  return { type: VoucherType.VALUE, templateKey: "classic-v1", originalValueCzk: 1500 };
}

function successfulTransaction() {
  return {
    $queryRaw: async () => [{ locked: true }],
    voucherTemplate: { findUnique: async () => ({ ...mockTemplateForIssuance, status: "PUBLISHED", allowedTypes: ["VALUE", "SERVICE"] }) },
    voucher: { findUnique: async () => null, create: async () => ({ id: "voucher-test" }) },
    voucherStockItem: { findUnique: async () => null },
  } as unknown as Prisma.TransactionClient;
}

const mockTemplateForIssuance = {
  id: "template-test",
  key: "classic-v1",
};

async function loadManagementTestContext(t: test.TestContext) {
  mockVoucherPrisma(t);
  mockVoucherTemplateRepository(t);
  const [{ prisma }, management] = await Promise.all([import("@/lib/prisma"), import("./voucher-management")]);
  return { prisma, management };
}

test("createVoucher po P2028 neprovede retry a vrátí bezpečnou operation error", async (t) => {
  t.mock.method(console, "warn", () => undefined);
  const { prisma, management } = await loadManagementTestContext(t);
  let attempts = 0;
  mockTransaction(t, prisma, async () => { attempts += 1; throw prismaError("P2028"); });

  await assert.rejects(
    () => management.createVoucher(valueVoucherInput(), null),
    (error: unknown) => error instanceof management.VoucherManagementError
      && error.code === management.voucherManagementErrorCodes.operationFailed
      && !/P2028|Prisma/i.test(error.message),
  );
  assert.equal(attempts, 1);
});

test("createVoucher po P2034 zachová retry a po transient konfliktu uspěje", async (t) => {
  t.mock.method(global, "setTimeout", ((callback: () => void) => { queueMicrotask(callback); return {} as NodeJS.Timeout; }) as unknown as typeof setTimeout);
  const { prisma, management } = await loadManagementTestContext(t);
  let attempts = 0;
  mockTransaction(t, prisma, async (operation) => {
    attempts += 1;
    if (attempts === 1) throw prismaError("P2034");
    return operation(successfulTransaction());
  });

  const voucher = await management.createVoucher(valueVoucherInput(), null);
  assert.equal(voucher.id, "voucher-test");
  assert.equal(attempts, 2);
});

test("createVoucher nereaguje retry na neočekávanou Prisma chybu", async (t) => {
  const { prisma, management } = await loadManagementTestContext(t);
  const unexpected = prismaError("P2002");
  let attempts = 0;
  mockTransaction(t, prisma, async () => { attempts += 1; throw unexpected; });

  await assert.rejects(() => management.createVoucher(valueVoucherInput(), null), unexpected);
  assert.equal(attempts, 1);
});

test("createVoucher odmítne template deaktivovanou mezi preflightem a transakcí", async (t) => {
  const { prisma, management } = await loadManagementTestContext(t);
  let created = false;
  mockTransaction(t, prisma, async (operation) => operation({
    ...successfulTransaction(),
    voucherTemplate: { findUnique: async () => ({ ...mockTemplateForIssuance, status: "INACTIVE", allowedTypes: ["VALUE"] }) },
    voucher: { findUnique: async () => null, create: async () => { created = true; return { id: "unexpected" }; } },
  } as unknown as Prisma.TransactionClient));

  await assert.rejects(
    () => management.createVoucher(valueVoucherInput(), null),
    (error: unknown) => error instanceof management.VoucherManagementError
      && error.code === management.voucherManagementErrorCodes.templateUnavailable,
  );
  assert.equal(created, false);
});
