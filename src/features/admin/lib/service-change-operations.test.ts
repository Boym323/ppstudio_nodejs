import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("opakovaný pokus service flagu zachová požadovaný stav a vytvoří jediný audit", async (t) => {
  const [{ prisma }, { setServiceOperationalFlag }] = await Promise.all([
    import("@/lib/prisma"),
    import("./service-change-operations"),
  ]);
  let currentValue = true;
  let attempts = 0;
  const audits: Array<{ before: boolean; after: boolean }> = [];

  t.mock.method(global, "setTimeout", ((callback: () => void) => {
    queueMicrotask(callback);
    return {} as NodeJS.Timeout;
  }) as typeof setTimeout);
  const client = prisma as unknown as { $transaction: (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => Promise<unknown> };
  const originalTransaction = client.$transaction;
  Object.defineProperty(client, "$transaction", {
    configurable: true,
    value: async (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
      const initialValue = currentValue;
      let nextValue = initialValue;
      let audit: { before: boolean; after: boolean } | undefined;
      const tx = {
        service: {
          findUnique: async () => ({ id: "service-1", isActive: currentValue, isPubliclyBookable: true }),
          update: async ({ data }: { data: { isActive?: boolean } }) => { nextValue = data.isActive ?? nextValue; },
        },
        serviceChangeLog: {
          create: async ({ data }: { data: { before: { isActive: boolean }; after: { isActive: boolean } } }) => {
            audit = { before: data.before.isActive, after: data.after.isActive };
          },
        },
      } as unknown as Prisma.TransactionClient;

      await operation(tx);
      attempts += 1;
      if (attempts === 1) {
        currentValue = nextValue;
        throw new Prisma.PrismaClientKnownRequestError("serializační konflikt", { code: "P2034", clientVersion: "test" });
      }
      currentValue = nextValue;
      if (audit) audits.push(audit);
      return true;
    },
    writable: true,
  });
  t.after(() => Object.defineProperty(client, "$transaction", {
    configurable: true,
    value: originalTransaction,
    writable: true,
  }));

  assert.equal(await setServiceOperationalFlag({ serviceId: "service-1", actorUserId: "admin-1", field: "isActive", value: false }), true);
  assert.equal(currentValue, false);
  assert.equal(attempts, 2);
  assert.deepEqual(audits, []);
});
