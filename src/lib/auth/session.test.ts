import "dotenv/config";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminRole } from "@/generated/prisma/browser";

(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "bootstrap-owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "bootstrap-owner-password";
process.env.ADMIN_STAFF_EMAIL ??= "bootstrap-staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "bootstrap-staff-password";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("resolveSessionFromTokenValue rejects inactive admin users", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { createSessionToken, resolveSessionFromTokenValue } = await import("./session");
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.adminUser.create({
    data: {
      email: `inactive-${suffix}@example.com`,
      name: `Inactive ${suffix}`,
      role: AdminRole.OWNER,
      isActive: false,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  try {
    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    assert.equal(await resolveSessionFromTokenValue(token), null);
  } finally {
    await prisma.adminUser.deleteMany({ where: { id: user.id } });
  }
});

dbTest("resolveSessionFromTokenValue uses the current database role", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { createSessionToken, resolveSessionFromTokenValue } = await import("./session");
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.adminUser.create({
    data: {
      email: `role-change-${suffix}@example.com`,
      name: `Role Change ${suffix}`,
      role: AdminRole.OWNER,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  try {
    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await prisma.adminUser.update({
      where: { id: user.id },
      data: { role: AdminRole.SALON },
    });

    const session = await resolveSessionFromTokenValue(token);

    assert.ok(session);
    assert.equal(session.role, AdminRole.SALON);
    assert.equal(session.email, user.email);
  } finally {
    await prisma.adminUser.deleteMany({ where: { id: user.id } });
  }
});

dbTest("offline recovery creates a usable owner session", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { recoverAdminOwner } = await import("./admin-recovery");
  const { authenticateAdmin, createSessionToken, resolveSessionFromTokenValue } = await import("./session");
  const suffix = randomUUID().slice(0, 8);
  const email = `recovery-${suffix}@example.com`;
  const password = "recovery-password-123";

  try {
    const recovered = await recoverAdminOwner({
      email,
      name: "Recovered Owner",
      password,
    });
    const authenticated = await authenticateAdmin(email, password);

    assert.ok(authenticated);
    assert.equal(authenticated.id, recovered.id);
    assert.equal(authenticated.role, AdminRole.OWNER);

    const token = await createSessionToken({
      sub: authenticated.id,
      email: authenticated.email,
      name: authenticated.name,
      role: authenticated.role,
    });
    const session = await resolveSessionFromTokenValue(token);

    assert.equal(session?.sub, recovered.id);
    assert.equal(session?.role, AdminRole.OWNER);
  } finally {
    await prisma.bookingSubmissionLog.deleteMany({
      where: {
        failureCode: "ADMIN_RECOVERY_OWNER_RESTORED",
        emailHash: createHash("sha256").update(email).digest("hex"),
      },
    });
    await prisma.adminUser.deleteMany({ where: { email } });
  }
});
