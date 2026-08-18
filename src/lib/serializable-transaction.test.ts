import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

async function loadTransactionHelper() {
  const [{ prisma }, { runSerializableTransaction }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/serializable-transaction"),
  ]);
  return { prisma, runSerializableTransaction };
}

function serializableConflict() {
  return new Prisma.PrismaClientKnownRequestError("serializační konflikt", {
    code: "P2034",
    clientVersion: "test",
  });
}

function mockTransaction(
  t: test.TestContext,
  prisma: { $transaction: unknown },
  implementation: (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => Promise<unknown>,
) {
  const client = prisma as { $transaction: typeof implementation };
  const original = client.$transaction;
  Object.defineProperty(client, "$transaction", { configurable: true, value: implementation, writable: true });
  t.after(() => Object.defineProperty(client, "$transaction", { configurable: true, value: original, writable: true }));
}

function skipRetryDelay(t: test.TestContext) {
  t.mock.method(global, "setTimeout", ((callback: () => void) => {
    queueMicrotask(callback);
    return {} as NodeJS.Timeout;
  }) as typeof setTimeout);
}

test("runSerializableTransaction uspěje na první pokus", async (t) => {
  let calls = 0;
  const { prisma, runSerializableTransaction } = await loadTransactionHelper();
  mockTransaction(t, prisma, async (operation) => operation({} as Prisma.TransactionClient));

  const result = await runSerializableTransaction(async () => {
    calls += 1;
    return "hotovo";
  });

  assert.equal(result, "hotovo");
  assert.equal(calls, 1);
});

test("runSerializableTransaction zopakuje P2034 a následně uspěje", async (t) => {
  let calls = 0;
  const { prisma, runSerializableTransaction } = await loadTransactionHelper();
  skipRetryDelay(t);
  mockTransaction(t, prisma, async (operation) => operation({} as Prisma.TransactionClient));

  assert.equal(await runSerializableTransaction(async () => {
    calls += 1;
    if (calls === 1) throw serializableConflict();
    return "hotovo";
  }), "hotovo");
  assert.equal(calls, 2);
});

test("runSerializableTransaction po vyčerpání limitu P2034 vyhodí", async (t) => {
  let calls = 0;
  const { prisma, runSerializableTransaction } = await loadTransactionHelper();
  skipRetryDelay(t);
  mockTransaction(t, prisma, async (operation) => operation({} as Prisma.TransactionClient));

  await assert.rejects(() => runSerializableTransaction(async () => {
    calls += 1;
    throw serializableConflict();
  }), { code: "P2034" });
  assert.equal(calls, 5);
});

test("runSerializableTransaction běžnou Prisma chybu neopakuje", async (t) => {
  let transactions = 0;
  const { prisma, runSerializableTransaction } = await loadTransactionHelper();
  const error = new Prisma.PrismaClientKnownRequestError("jiná chyba", { code: "P2002", clientVersion: "test" });
  mockTransaction(t, prisma, async () => {
    transactions += 1;
    throw error;
  });

  await assert.rejects(() => runSerializableTransaction(async () => "nikdy"), error);
  assert.equal(transactions, 1);
});

test("runSerializableTransaction běžnou Error neopakuje", async (t) => {
  let transactions = 0;
  const { prisma, runSerializableTransaction } = await loadTransactionHelper();
  const error = new Error("jiná chyba");
  mockTransaction(t, prisma, async () => {
    transactions += 1;
    throw error;
  });

  await assert.rejects(() => runSerializableTransaction(async () => "nikdy"), error);
  assert.equal(transactions, 1);
});
