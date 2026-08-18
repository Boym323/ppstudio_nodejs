import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminRole } from "@/generated/prisma/browser";

(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

test("nelze deaktivovat ani degradovat posledního aktivního OWNERa", async () => {
  const { wouldRemoveLastActiveOwner } = await import("./admin-owner-protection");

  assert.equal(
    wouldRemoveLastActiveOwner({
      currentRole: AdminRole.OWNER,
      currentIsActive: true,
      nextRole: AdminRole.OWNER,
      nextIsActive: false,
      activeOwnerCount: 1,
    }),
    true,
  );
  assert.equal(
    wouldRemoveLastActiveOwner({
      currentRole: AdminRole.OWNER,
      currentIsActive: true,
      nextRole: AdminRole.SALON,
      nextIsActive: true,
      activeOwnerCount: 1,
    }),
    true,
  );
});

dbTest("self-demotion je možná až při dalším aktivním OWNERovi", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { updateAdminUserWithOwnerProtection } = await import("./admin-owner-protection");
  const suffix = randomUUID().slice(0, 8);
  const [first, second] = await Promise.all(
    ["first", "second"].map((name) =>
      prisma.adminUser.create({
        data: {
          email: `${name}-owner-${suffix}@example.com`,
          name,
          role: AdminRole.OWNER,
          isActive: true,
        },
      }),
    ),
  );

  try {
    assert.equal(
      await updateAdminUserWithOwnerProtection({ userId: first.id, actorUserId: second.id, role: AdminRole.SALON }),
      "updated",
    );
    const demoted = await prisma.adminUser.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(demoted.role, AdminRole.SALON);
  } finally {
    await prisma.adminUserAuditEvent.deleteMany({ where: { targetUserId: { in: [first.id, second.id] } } });
    await prisma.adminUser.deleteMany({ where: { id: { in: [first.id, second.id] } } });
  }
});
