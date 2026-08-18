import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminRole } from "@/generated/prisma/browser";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("role, invite resend, no-op and deactivation create an immutable OWNER-only admin audit", async () => {
  const [{ prisma }, { updateAdminUserWithOwnerProtection }, { reissueAdminInviteTokenWithAudit }, { getAdminLogsData }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-owner-protection"),
    import("./admin-user-invite"),
    import("./admin-data"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const actor = await prisma.adminUser.create({ data: { email: `audit-owner-${suffix}@example.com`, name: `Audit owner ${suffix}`, role: AdminRole.OWNER } });
  const target = await prisma.adminUser.create({ data: { email: `audit-salon-${suffix}@example.com`, name: `Audit target ${suffix}`, role: AdminRole.SALON } });

  try {
    assert.equal(await updateAdminUserWithOwnerProtection({ userId: target.id, actorUserId: actor.id, role: AdminRole.OWNER }), "updated");
    assert.equal(await updateAdminUserWithOwnerProtection({ userId: target.id, actorUserId: actor.id, role: AdminRole.OWNER }), "updated");
    const { inviteUrl } = await reissueAdminInviteTokenWithAudit({ userId: target.id, actorUserId: actor.id });
    assert.equal(await updateAdminUserWithOwnerProtection({ userId: target.id, actorUserId: actor.id, isActive: false }), "updated");

    const rows = await prisma.adminUserAuditEvent.findMany({ where: { targetUserId: target.id }, orderBy: { createdAt: "asc" } });
    assert.equal(rows.length, 3);
    assert.equal(rows[0].operation, "CHANGE_ROLE");
    assert.deepEqual(rows[0].before, { role: "SALON" });
    assert.deepEqual(rows[0].after, { role: "OWNER" });
    assert.equal(rows[1].operation, "INVITE_RESEND");
    assert.equal(rows[2].operation, "DEACTIVATE");
    assert.deepEqual(rows[2].before, { isActive: true });
    assert.deepEqual(rows[2].after, { isActive: false });
    assert.equal(rows.every((row) => row.actorUserId === actor.id), true);
    assert.doesNotMatch(JSON.stringify(rows), /token|secret|password/i);
    assert.equal(JSON.stringify(rows).includes(inviteUrl), false);

    const ownerView = await getAdminLogsData({ area: "owner", view: "system", source: "admin", query: suffix });
    assert.equal(ownerView.items.filter((item) => item.sourceType === "admin").length, 3);
    const salonView = await getAdminLogsData({ area: "salon", view: "system", source: "admin", query: suffix });
    assert.equal(salonView.items.some((item) => item.sourceType === "admin"), false);
  } finally {
    await prisma.adminUserAuditEvent.deleteMany({ where: { targetUserId: target.id } });
    await prisma.adminUser.deleteMany({ where: { id: { in: [target.id, actor.id] } } });
  }
});
