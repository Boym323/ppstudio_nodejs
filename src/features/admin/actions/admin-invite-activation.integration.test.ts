import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

async function loadModules() {
  const [prismaModule, prismaClientModule, tokenModule, inviteModule, actionModule] = await Promise.all([
    import("@/lib/prisma"),
    import("@/generated/prisma/browser"),
    import("@/features/admin/lib/admin-invite-token-db"),
    import("@/features/admin/lib/admin-invite-token"),
    import("./activate-admin-invite-action"),
  ]);

  return {
    prisma: prismaModule.prisma,
    AdminRole: prismaClientModule.AdminRole,
    deactivateAdminUserAndRevokeInviteTokens: tokenModule.deactivateAdminUserAndRevokeInviteTokens,
    hashAdminInviteToken: inviteModule.hashAdminInviteToken,
    activateAdminInviteAction: actionModule.activateAdminInviteAction,
  };
}

async function createInviteSeed() {
  const { prisma, AdminRole, hashAdminInviteToken } = await loadModules();
  const suffix = randomUUID();
  const rawToken = `invite-${suffix}-secure-token`;
  const user = await prisma.adminUser.create({
    data: {
      email: `invite-${suffix}@example.test`,
      name: "Invite test",
      role: AdminRole.SALON,
      isActive: true,
    },
    select: { id: true },
  });
  const invite = await prisma.adminUserInviteToken.create({
    data: {
      userId: user.id,
      tokenHash: hashAdminInviteToken(rawToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
    select: { id: true },
  });

  return { userId: user.id, inviteId: invite.id, rawToken };
}

function activationForm(rawToken: string) {
  const formData = new FormData();
  formData.set("token", rawToken);
  formData.set("password", "bezpecne-heslo-123");
  formData.set("confirmPassword", "bezpecne-heslo-123");
  return formData;
}

dbTest("deaktivace revokuje starou pozvánku a aktivace účet znovu nezapne", async () => {
  const { prisma, deactivateAdminUserAndRevokeInviteTokens, activateAdminInviteAction } = await loadModules();
  const seed = await createInviteSeed();

  try {
    await deactivateAdminUserAndRevokeInviteTokens(seed.userId, new Date());
    const result = await activateAdminInviteAction({ status: "idle" }, activationForm(seed.rawToken));
    const [user, invite] = await Promise.all([
      prisma.adminUser.findUniqueOrThrow({ where: { id: seed.userId }, select: { isActive: true, passwordHash: true } }),
      prisma.adminUserInviteToken.findUniqueOrThrow({ where: { id: seed.inviteId }, select: { usedAt: true, revokedAt: true } }),
    ]);

    assert.equal(result.status, "error");
    assert.equal(user.isActive, false);
    assert.equal(user.passwordHash, null);
    assert.equal(invite.usedAt, null);
    assert.ok(invite.revokedAt);
  } finally {
    await prisma.adminUser.deleteMany({ where: { id: seed.userId } });
  }
});

dbTest("souběžné použití stejné pozvánky uspěje právě jednou", async () => {
  const { prisma, activateAdminInviteAction } = await loadModules();
  const seed = await createInviteSeed();

  try {
    const results = await Promise.all([
      activateAdminInviteAction({ status: "idle" }, activationForm(seed.rawToken)),
      activateAdminInviteAction({ status: "idle" }, activationForm(seed.rawToken)),
    ]);
    const invite = await prisma.adminUserInviteToken.findUniqueOrThrow({
      where: { id: seed.inviteId },
      select: { usedAt: true, revokedAt: true },
    });

    assert.equal(results.filter((result) => result.status === "success").length, 1);
    assert.equal(results.filter((result) => result.status === "error").length, 1);
    assert.ok(invite.usedAt);
    assert.equal(invite.revokedAt, null);
  } finally {
    await prisma.adminUser.deleteMany({ where: { id: seed.userId } });
  }
});
