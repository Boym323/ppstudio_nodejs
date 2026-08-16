import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  AdminRole,
  EmailIncidentManualResolutionReason,
  EmailLogStatus,
  EmailLogType,
} from "@prisma/client";

import { getUnresolvedEmailDeliveryFailureWhere } from "./incidents";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("OWNER ručně uzavře root incident přes resend child bez změny historie ani side effectů", async () => {
  const [{ prisma }, { manuallyResolveEmailIncident }, { getEmailLogDetailData }] = await Promise.all([
    import("@/lib/prisma"),
    import("./incident-resolution"),
    import("@/features/admin/lib/admin-data"),
  ]);
  const seed = randomUUID();
  const owner = await prisma.adminUser.create({ data: { email: `incident-owner-${seed}@example.test`, name: "OWNER incidentu", role: AdminRole.OWNER } });
  const salon = await prisma.adminUser.create({ data: { email: `incident-salon-${seed}@example.test`, name: "SALON incidentu", role: AdminRole.SALON } });
  const bouncedAt = new Date("2026-06-15T10:00:00.000Z");
  const root = await prisma.emailLog.create({
    data: {
      type: EmailLogType.GENERIC,
      status: EmailLogStatus.SENT,
      recipientEmail: `legacy-${seed}@example.test`,
      subject: "Historický bounce",
      templateKey: "incident-test",
      trackingBouncedAt: bouncedAt,
      trackingLastEvent: "email.bounced",
      trackingLastEventAt: bouncedAt,
    },
  });
  const child = await prisma.emailLog.create({
    data: {
      type: EmailLogType.GENERIC,
      status: EmailLogStatus.FAILED,
      recipientEmail: `resend-${seed}@example.test`,
      subject: "Resend",
      templateKey: "incident-test",
      resendOfId: root.id,
      resendRootId: root.id,
      errorMessage: "Druhý pokus selhal",
    },
  });

  try {
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: [root.id, child.id] } }, getUnresolvedEmailDeliveryFailureWhere()] } }), 2);
    const emailCountBefore = await prisma.emailLog.count();

    const forbidden = await manuallyResolveEmailIncident({
      emailLogId: child.id,
      actorUserId: salon.id,
      actorRole: AdminRole.SALON,
      reason: EmailIncidentManualResolutionReason.HISTORICAL,
      note: null,
    });
    assert.equal(forbidden.outcome, "forbidden");

    const first = await manuallyResolveEmailIncident({
      emailLogId: child.id,
      actorUserId: owner.id,
      actorRole: AdminRole.OWNER,
      reason: EmailIncidentManualResolutionReason.NO_LONGER_RELEVANT,
      note: "Vyřešeno mimo e-mail.",
    });
    const second = await manuallyResolveEmailIncident({
      emailLogId: child.id,
      actorUserId: owner.id,
      actorRole: AdminRole.OWNER,
      reason: EmailIncidentManualResolutionReason.HISTORICAL,
      note: null,
    });
    const [storedRoot, storedChild, detail] = await Promise.all([
      prisma.emailLog.findUniqueOrThrow({ where: { id: root.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: child.id } }),
      getEmailLogDetailData(child.id),
    ]);

    assert.deepEqual(first, { outcome: "resolved", rootId: root.id });
    assert.deepEqual(second, { outcome: "already_resolved", rootId: root.id });
    assert.equal(storedRoot.status, EmailLogStatus.SENT);
    assert.equal(storedRoot.recipientEmail, root.recipientEmail);
    assert.equal(storedRoot.trackingBouncedAt?.toISOString(), bouncedAt.toISOString());
    assert.equal(storedChild.status, EmailLogStatus.FAILED);
    assert.equal(storedRoot.incidentResolutionKind, "MANUAL");
    assert.equal(storedRoot.incidentManualResolvedByUserId, owner.id);
    assert.equal(storedRoot.incidentManualResolutionReason, EmailIncidentManualResolutionReason.NO_LONGER_RELEVANT);
    assert.equal(storedRoot.incidentManualResolutionNote, "Vyřešeno mimo e-mail.");
    assert.ok(storedRoot.incidentResolvedAt);
    assert.equal(storedRoot.incidentResolvedByEmailLogId, null);
    assert.equal(await prisma.emailLog.count(), emailCountBefore);
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: [root.id, child.id] } }, getUnresolvedEmailDeliveryFailureWhere()] } }), 0);
    assert.equal(detail?.incidentResolution?.label, "Ručně uzavřeno");
    assert.match(detail?.incidentResolution?.detail ?? "", /OWNER incidentu.*Již nerelevantní/);
  } finally {
    await prisma.emailLog.deleteMany({ where: { id: { in: [root.id, child.id] } } });
    await prisma.adminUser.deleteMany({ where: { id: { in: [owner.id, salon.id] } } });
  }
});
