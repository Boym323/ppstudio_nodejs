import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  AdminRole,
  EmailIncidentManualResolutionReason,
  EmailIncidentResolutionKind,
  EmailLogStatus,
  EmailLogType,
} from "@prisma/client";

import { getUnresolvedEmailDeliveryFailureWhere, getUnresolvedEmailDeliveryIncidentRootWhere } from "./incidents";

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
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: [root.id, child.id] } }, getUnresolvedEmailDeliveryIncidentRootWhere()] } }), 1);
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
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: [root.id, child.id] } }, getUnresolvedEmailDeliveryIncidentRootWhere()] } }), 0);
    assert.equal(detail?.incidentResolution?.label, "Ručně uzavřeno");
    assert.match(detail?.incidentResolution?.detail ?? "", /OWNER incidentu.*Již nerelevantní/);
  } finally {
    await prisma.emailLog.deleteMany({ where: { id: { in: [root.id, child.id] } } });
    await prisma.adminUser.deleteMany({ where: { id: { in: [owner.id, salon.id] } } });
  }
});

dbTest("read-model aktivních incidentů deduplikuje resend chain a historie zůstává po jednotlivých logách", async () => {
  const [{ prisma }, { getAdminLogsData }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/features/admin/lib/admin-data"),
  ]);
  const seed = randomUUID();
  const recipient = `incident-chain-${seed}@example.test`;
  const base = {
    type: EmailLogType.GENERIC,
    recipientEmail: recipient,
    subject: "Incident chain",
    templateKey: "incident-chain-test",
  };
  const ids: string[] = [];

  try {
    const root = await prisma.emailLog.create({
      data: { ...base, status: EmailLogStatus.SENT, trackingBouncedAt: new Date("2026-06-15T10:00:00.000Z") },
    });
    ids.push(root.id);
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: ids } }, getUnresolvedEmailDeliveryIncidentRootWhere()] } }), 1);

    const firstFailedResend = await prisma.emailLog.create({
      data: { ...base, status: EmailLogStatus.FAILED, resendOfId: root.id, resendRootId: root.id, errorMessage: "První resend selhal", createdAt: new Date("2026-06-15T10:01:00.000Z") },
    });
    const latestFailedResend = await prisma.emailLog.create({
      data: { ...base, status: EmailLogStatus.FAILED, resendOfId: firstFailedResend.id, resendRootId: root.id, errorMessage: "Druhý resend selhal", createdAt: new Date("2026-06-15T10:02:00.000Z") },
    });
    ids.push(firstFailedResend.id, latestFailedResend.id);
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: ids } }, getUnresolvedEmailDeliveryFailureWhere()] } }), 3);
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: ids } }, getUnresolvedEmailDeliveryIncidentRootWhere()] } }), 1);

    const suppressed = await prisma.emailLog.create({
      data: { ...base, recipientEmail: `suppressed-${seed}@example.test`, status: EmailLogStatus.SENT, trackingSuppressedAt: new Date("2026-06-15T10:03:00.000Z") },
    });
    ids.push(suppressed.id);
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: ids } }, getUnresolvedEmailDeliveryIncidentRootWhere()] } }), 2);

    const [attention, attentionError, history] = await Promise.all([
      getAdminLogsData({ area: "owner", view: "attention", source: "email", query: recipient }),
      getAdminLogsData({ area: "owner", view: "attention", source: "email", severity: "error", query: recipient }),
      getAdminLogsData({ area: "owner", view: "emails", source: "email", query: recipient }),
    ]);
    assert.equal(attention.total, 1);
    assert.equal(attention.items.length, 1);
    assert.equal(attention.items[0]?.emailLogId, latestFailedResend.id);
    assert.equal(attentionError.total, 1);
    assert.equal(attentionError.items[0]?.emailLogId, latestFailedResend.id);
    assert.equal(history.total, 3);
    assert.deepEqual(new Set(history.items.map((item) => item.emailLogId)), new Set([root.id, firstFailedResend.id, latestFailedResend.id]));

    await prisma.emailLog.update({ where: { id: root.id }, data: { incidentResolvedAt: new Date(), incidentResolutionKind: EmailIncidentResolutionKind.MANUAL } });
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: ids } }, getUnresolvedEmailDeliveryIncidentRootWhere()] } }), 1);

    const deliveredRoot = await prisma.emailLog.create({
      data: { ...base, recipientEmail: `delivered-${seed}@example.test`, status: EmailLogStatus.SENT, trackingBouncedAt: new Date("2026-06-15T10:04:00.000Z") },
    });
    ids.push(deliveredRoot.id);
    const deliveredResend = await prisma.emailLog.create({
      data: { ...base, recipientEmail: `delivered-${seed}@example.test`, status: EmailLogStatus.SENT, resendOfId: deliveredRoot.id, resendRootId: deliveredRoot.id },
    });
    ids.push(deliveredResend.id);
    await prisma.emailLog.update({ where: { id: deliveredRoot.id }, data: { incidentResolvedAt: new Date(), incidentResolvedByEmailLogId: deliveredResend.id, incidentResolutionKind: EmailIncidentResolutionKind.DELIVERED_RESEND } });
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: [deliveredRoot.id, deliveredResend.id] } }, getUnresolvedEmailDeliveryIncidentRootWhere()] } }), 0);
  } finally {
    await prisma.emailLog.deleteMany({ where: { id: { in: ids } } });
  }
});

dbTest("Pozornost filtruje rootové incidenty podle zobrazeného failed reprezentanta", async () => {
  const [{ prisma }, { getAdminLogsData }, { getAdminDashboardData }, { createHealthRouteApi }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/features/admin/lib/admin-data"),
    import("@/features/admin/lib/admin-dashboard"),
    import("@/app/api/health/route-api"),
  ]);
  const seed = randomUUID();
  const subject = `Datum incidentu ${seed}`;
  const base = {
    type: EmailLogType.GENERIC,
    recipientEmail: `incident-date-${seed}@example.test`,
    templateKey: "incident-date-filter-test",
  };
  const ids: string[] = [];

  try {
    // Root A je v rozsahu, jeho nejnovější child C nikoli.
    const firstRoot = await prisma.emailLog.create({
      data: { ...base, subject: `${subject} první`, status: EmailLogStatus.FAILED, createdAt: new Date("2026-08-10T12:00:00.000Z") },
    });
    const firstLatest = await prisma.emailLog.create({
      data: { ...base, subject: `${subject} první`, status: EmailLogStatus.FAILED, resendOfId: firstRoot.id, resendRootId: firstRoot.id, createdAt: new Date("2026-08-15T12:00:00.000Z") },
    });
    // Druhý chain obsahuje A + B v rozsahu a C mimo něj.
    const secondRoot = await prisma.emailLog.create({
      data: { ...base, subject: `${subject} druhý`, status: EmailLogStatus.FAILED, createdAt: new Date("2026-08-10T13:00:00.000Z") },
    });
    const secondInRange = await prisma.emailLog.create({
      data: { ...base, subject: `${subject} druhý`, status: EmailLogStatus.FAILED, resendOfId: secondRoot.id, resendRootId: secondRoot.id, createdAt: new Date("2026-08-11T12:00:00.000Z") },
    });
    const secondLatest = await prisma.emailLog.create({
      data: { ...base, subject: `${subject} druhý`, status: EmailLogStatus.FAILED, resendOfId: secondInRange.id, resendRootId: secondRoot.id, createdAt: new Date("2026-08-15T13:00:00.000Z") },
    });
    ids.push(firstRoot.id, firstLatest.id, secondRoot.id, secondInRange.id, secondLatest.id);

    const [onlyFirstRoot, bothInRange, noneInRange, onlySecondRoot, unfiltered] = await Promise.all([
      getAdminLogsData({ area: "owner", view: "attention", source: "email", query: `${subject} první`, dateFrom: "2026-08-10", dateTo: "2026-08-10" }),
      getAdminLogsData({ area: "owner", view: "attention", source: "email", query: subject, dateFrom: "2026-08-10", dateTo: "2026-08-12" }),
      getAdminLogsData({ area: "owner", view: "attention", source: "email", query: subject, dateFrom: "2026-08-12", dateTo: "2026-08-14" }),
      getAdminLogsData({ area: "owner", view: "attention", source: "email", query: subject, dateFrom: "2026-08-11", dateTo: "2026-08-11" }),
      getAdminLogsData({ area: "owner", view: "attention", source: "email", query: subject }),
    ]);

    assert.deepEqual(onlyFirstRoot.items.map((item) => item.emailLogId), [firstRoot.id]);
    assert.equal(onlyFirstRoot.total, onlyFirstRoot.items.length);
    assert.deepEqual(new Set(bothInRange.items.map((item) => item.emailLogId)), new Set([firstRoot.id, secondInRange.id]));
    assert.equal(bothInRange.total, bothInRange.items.length);
    assert.equal(noneInRange.total, 0);
    assert.deepEqual(noneInRange.items, []);
    assert.deepEqual(onlySecondRoot.items.map((item) => item.emailLogId), [secondInRange.id]);
    assert.equal(onlySecondRoot.total, onlySecondRoot.items.length);
    assert.deepEqual(new Set(unfiltered.items.map((item) => item.emailLogId)), new Set([firstLatest.id, secondLatest.id]));
    assert.equal(unfiltered.total, unfiltered.items.length);

    const activeIncidentCount = await prisma.emailLog.count({ where: getUnresolvedEmailDeliveryIncidentRootWhere() });
    const [attention, dashboard, healthResponse] = await Promise.all([
      getAdminLogsData({ area: "owner", view: "attention", source: "email" }),
      getAdminDashboardData("owner"),
      createHealthRouteApi().GET(),
    ]);
    const health = await healthResponse.json() as { emailIncidents: { active: number } };
    const dashboardAlert = dashboard.alerts.find((alert) => alert.id === "email-failures");

    assert.equal(attention.attention.failed, activeIncidentCount);
    assert.equal(health.emailIncidents.active, activeIncidentCount);
    assert.match(dashboardAlert?.text ?? "", new RegExp(`^${activeIncidentCount} `));
  } finally {
    await prisma.emailLog.deleteMany({ where: { id: { in: ids } } });
  }
});
