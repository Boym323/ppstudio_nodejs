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
} from "@/generated/prisma/browser";

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
  const root = await prisma.emailLog.create({
    data: {
      type: EmailLogType.GENERIC,
      status: EmailLogStatus.SENT,
      recipientEmail: `legacy-${seed}@example.test`,
      subject: "Původní odeslaný e-mail",
      templateKey: "incident-test",
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
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: [root.id, child.id] } }, getUnresolvedEmailDeliveryFailureWhere()] } }), 1);
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

    const detailBeforeResolution = await getEmailLogDetailData(root.id);
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
    assert.equal(storedRoot.trackingBouncedAt, null);
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
    assert.equal(detailBeforeResolution?.canCloseIncident, true);
    assert.equal(detail?.incidentResolution?.label, "Ručně uzavřeno");
    assert.match(detail?.incidentResolution?.detail ?? "", /OWNER incidentu.*Již nerelevantní/);
  } finally {
    await prisma.emailLog.deleteMany({ where: { id: { in: [root.id, child.id] } } });
    await prisma.adminUser.deleteMany({ where: { id: { in: [owner.id, salon.id] } } });
  }
});

dbTest("resend po vyřešeném incidentu zakládá novou epochu bez přepsání historie", async () => {
  const [{ prisma }, { buildResendEmailLogCreateInput, resolveResendIncidentRootId }, { applyResendWebhookEvent }, { getAdminLogsData }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/features/admin/actions/email-log-action-helpers"),
    import("@/lib/email/resend-webhooks"),
    import("@/features/admin/lib/admin-data"),
  ]);
  const seed = randomUUID();
  const ids: string[] = [];
  const eventIds = [`epoch-b-${seed}`, `epoch-d-${seed}`];
  const base = {
    type: EmailLogType.GENERIC,
    recipientEmail: `incident-epoch-${seed}@example.test`,
    subject: `Incident epoch ${seed}`,
    templateKey: "incident-epoch-test",
  };

  try {
    const root = await prisma.emailLog.create({
      data: { ...base, status: EmailLogStatus.SENT, trackingBouncedAt: new Date("2026-08-16T10:00:00.000Z") },
    });
    ids.push(root.id);
    const deliveredResend = await prisma.emailLog.create({
      data: { ...base, status: EmailLogStatus.SENT, provider: "resend", providerMessageId: `epoch-b-message-${seed}`, resendOfId: root.id, resendRootId: root.id },
    });
    ids.push(deliveredResend.id);
    await applyResendWebhookEvent({
      event: { type: "email.delivered", created_at: "2026-08-16T10:01:00.000Z", data: { email_id: `epoch-b-message-${seed}` } },
      providerEventId: eventIds[0],
    });
    const resolvedRoot = await prisma.emailLog.findUniqueOrThrow({ where: { id: root.id } });
    const originalResolution = {
      incidentResolvedAt: resolvedRoot.incidentResolvedAt,
      incidentResolutionKind: resolvedRoot.incidentResolutionKind,
      incidentResolvedByEmailLogId: resolvedRoot.incidentResolvedByEmailLogId,
    };
    assert.ok(originalResolution.incidentResolvedAt);
    assert.equal(originalResolution.incidentResolutionKind, EmailIncidentResolutionKind.DELIVERED_RESEND);

    const failedResend = await prisma.emailLog.create({
      data: buildResendEmailLogCreateInput({
        resendOfId: deliveredResend.id,
        resendRootId: resolveResendIncidentRootId({ sourceEmailLogId: deliveredResend.id, sourceResendRootId: deliveredResend.resendRootId, incidentResolvedAt: resolvedRoot.incidentResolvedAt }),
        bookingId: null, clientId: null, actionTokenId: null, type: base.type,
        recipientEmail: base.recipientEmail, subject: base.subject, templateKey: base.templateKey, payload: null,
      }),
    });
    ids.push(failedResend.id);
    await prisma.emailLog.update({ where: { id: failedResend.id }, data: { status: EmailLogStatus.FAILED, errorMessage: "Nový failure" } });
    const [rootAfterFailure, failedAfterFailure, attention, history] = await Promise.all([
      prisma.emailLog.findUniqueOrThrow({ where: { id: root.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: failedResend.id } }),
      getAdminLogsData({ area: "owner", view: "attention", source: "email", query: base.subject }),
      getAdminLogsData({ area: "owner", view: "emails", source: "email", query: base.subject }),
    ]);
    assert.equal(failedAfterFailure.resendOfId, deliveredResend.id);
    assert.equal(failedAfterFailure.resendRootId, null);
    assert.deepEqual({ incidentResolvedAt: rootAfterFailure.incidentResolvedAt, incidentResolutionKind: rootAfterFailure.incidentResolutionKind, incidentResolvedByEmailLogId: rootAfterFailure.incidentResolvedByEmailLogId }, originalResolution);
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: ids } }, getUnresolvedEmailDeliveryIncidentRootWhere()] } }), 1);
    assert.deepEqual(attention.items.map((item) => item.emailLogId), [failedResend.id]);
    assert.deepEqual(new Set(history.items.map((item) => item.emailLogId)), new Set(ids));

    const finalResend = await prisma.emailLog.create({
      data: { ...base, status: EmailLogStatus.SENT, provider: "resend", providerMessageId: `epoch-d-message-${seed}`, resendOfId: failedResend.id, resendRootId: failedResend.id },
    });
    ids.push(finalResend.id);
    await applyResendWebhookEvent({
      event: { type: "email.delivered", created_at: "2026-08-16T10:03:00.000Z", data: { email_id: `epoch-d-message-${seed}` } },
      providerEventId: eventIds[1],
    });
    const [rootAfterDelivered, failedAfterDelivered] = await Promise.all([
      prisma.emailLog.findUniqueOrThrow({ where: { id: root.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: failedResend.id } }),
    ]);
    assert.deepEqual({ incidentResolvedAt: rootAfterDelivered.incidentResolvedAt, incidentResolutionKind: rootAfterDelivered.incidentResolutionKind, incidentResolvedByEmailLogId: rootAfterDelivered.incidentResolvedByEmailLogId }, originalResolution);
    assert.ok(failedAfterDelivered.incidentResolvedAt);
    assert.equal(failedAfterDelivered.incidentResolutionKind, EmailIncidentResolutionKind.DELIVERED_RESEND);
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: ids } }, getUnresolvedEmailDeliveryIncidentRootWhere()] } }), 0);
  } finally {
    await prisma.emailProviderWebhookEvent.deleteMany({ where: { providerEventId: { in: eventIds } } });
    for (const id of [...ids].reverse()) await prisma.emailLog.delete({ where: { id } });
  }
});

dbTest("ruční uzavření nové resend epochy nemění dříve vyřešený incident", async () => {
  const [{ prisma }, { manuallyResolveEmailIncident }] = await Promise.all([
    import("@/lib/prisma"),
    import("./incident-resolution"),
  ]);
  const seed = randomUUID();
  const owner = await prisma.adminUser.create({ data: { email: `epoch-manual-owner-${seed}@example.test`, name: "OWNER nové epochy", role: AdminRole.OWNER } });
  const ids: string[] = [];

  try {
    const oldRoot = await prisma.emailLog.create({
      data: { type: EmailLogType.GENERIC, status: EmailLogStatus.FAILED, recipientEmail: `epoch-manual-${seed}@example.test`, subject: "Stará epocha", templateKey: "incident-epoch-test", incidentResolvedAt: new Date("2026-08-16T10:00:00.000Z"), incidentResolutionKind: EmailIncidentResolutionKind.DELIVERED_RESEND, incidentResolvedByEmailLogId: "historical-delivered-resend" },
    });
    ids.push(oldRoot.id);
    const newFailure = await prisma.emailLog.create({
      data: { type: EmailLogType.GENERIC, status: EmailLogStatus.FAILED, recipientEmail: oldRoot.recipientEmail, subject: "Nová epocha", templateKey: "incident-epoch-test", resendOfId: oldRoot.id, resendRootId: null },
    });
    ids.push(newFailure.id);
    const oldResolution = { incidentResolvedAt: oldRoot.incidentResolvedAt, incidentResolutionKind: oldRoot.incidentResolutionKind, incidentResolvedByEmailLogId: oldRoot.incidentResolvedByEmailLogId };

    const result = await manuallyResolveEmailIncident({ emailLogId: newFailure.id, actorUserId: owner.id, actorRole: AdminRole.OWNER, reason: EmailIncidentManualResolutionReason.HISTORICAL, note: null });
    const [storedOldRoot, storedNewFailure] = await Promise.all([
      prisma.emailLog.findUniqueOrThrow({ where: { id: oldRoot.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: newFailure.id } }),
    ]);
    assert.deepEqual(result, { outcome: "resolved", rootId: newFailure.id });
    assert.deepEqual({ incidentResolvedAt: storedOldRoot.incidentResolvedAt, incidentResolutionKind: storedOldRoot.incidentResolutionKind, incidentResolvedByEmailLogId: storedOldRoot.incidentResolvedByEmailLogId }, oldResolution);
    assert.ok(storedNewFailure.incidentResolvedAt);
    assert.equal(storedNewFailure.incidentResolutionKind, EmailIncidentResolutionKind.MANUAL);
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: ids } }, getUnresolvedEmailDeliveryIncidentRootWhere()] } }), 0);
  } finally {
    for (const id of [...ids].reverse()) await prisma.emailLog.delete({ where: { id } });
    await prisma.adminUser.delete({ where: { id: owner.id } });
  }
});

dbTest("OWNER ručně uzavře SENT root po bounced a failed resend chainu", async () => {
  const [{ prisma }, { manuallyResolveEmailIncident }] = await Promise.all([
    import("@/lib/prisma"),
    import("./incident-resolution"),
  ]);
  const seed = randomUUID();
  const owner = await prisma.adminUser.create({ data: { email: `incident-chain-owner-${seed}@example.test`, name: "OWNER chainu", role: AdminRole.OWNER } });
  const ids: string[] = [];

  try {
    const root = await prisma.emailLog.create({ data: { type: EmailLogType.GENERIC, status: EmailLogStatus.SENT, recipientEmail: `root-${seed}@example.test`, subject: "Root", templateKey: "incident-chain-resolution" } });
    const bounced = await prisma.emailLog.create({ data: { type: EmailLogType.GENERIC, status: EmailLogStatus.SENT, recipientEmail: `bounce-${seed}@example.test`, subject: "Bounce resend", templateKey: "incident-chain-resolution", resendOfId: root.id, resendRootId: root.id, trackingBouncedAt: new Date("2026-08-16T10:01:00.000Z") } });
    const failed = await prisma.emailLog.create({ data: { type: EmailLogType.GENERIC, status: EmailLogStatus.FAILED, recipientEmail: `failed-${seed}@example.test`, subject: "Failed resend", templateKey: "incident-chain-resolution", resendOfId: bounced.id, resendRootId: root.id } });
    ids.push(root.id, bounced.id, failed.id);

    const first = await manuallyResolveEmailIncident({ emailLogId: failed.id, actorUserId: owner.id, actorRole: AdminRole.OWNER, reason: EmailIncidentManualResolutionReason.OTHER, note: "Prověřeno." });
    const second = await manuallyResolveEmailIncident({ emailLogId: failed.id, actorUserId: owner.id, actorRole: AdminRole.OWNER, reason: EmailIncidentManualResolutionReason.HISTORICAL, note: null });
    const [storedRoot, storedBounced, storedFailed] = await Promise.all(ids.map((id) => prisma.emailLog.findUniqueOrThrow({ where: { id } })));

    assert.deepEqual(first, { outcome: "resolved", rootId: root.id });
    assert.deepEqual(second, { outcome: "already_resolved", rootId: root.id });
    assert.equal(storedRoot.status, EmailLogStatus.SENT);
    assert.equal(storedBounced.status, EmailLogStatus.SENT);
    assert.equal(storedFailed.status, EmailLogStatus.FAILED);
    assert.ok(storedRoot.incidentResolvedAt);
    assert.equal(storedRoot.incidentResolutionKind, EmailIncidentResolutionKind.MANUAL);
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: ids } }, getUnresolvedEmailDeliveryIncidentRootWhere()] } }), 0);
  } finally {
    await prisma.emailLog.deleteMany({ where: { id: { in: ids } } });
    await prisma.adminUser.delete({ where: { id: owner.id } });
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

dbTest("Pozornost vybírá reprezentanta pouze z failure členů splňujících celý filtr", async () => {
  const [{ prisma }, { getAdminLogsData }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/features/admin/lib/admin-data"),
  ]);
  const seed = randomUUID();
  const ids: string[] = [];
  const base = { type: EmailLogType.GENERIC, status: EmailLogStatus.FAILED, recipientEmail: `filter-${seed}@example.test`, templateKey: "incident-filter-representative" };
  const createChain = async (subjects: string[], dates: string[]) => {
    const root = await prisma.emailLog.create({ data: { ...base, subject: subjects[0], createdAt: new Date(dates[0]) } });
    ids.push(root.id);
    let parent = root;
    for (let index = 1; index < subjects.length; index += 1) {
      parent = await prisma.emailLog.create({ data: { ...base, subject: subjects[index], createdAt: new Date(dates[index]), resendOfId: parent.id, resendRootId: root.id } });
      ids.push(parent.id);
    }
    return { root, latest: parent };
  };

  try {
    const rootOnly = await createChain([`root-only-${seed}`, "bez-dotazu"], ["2026-08-10T10:00:00.000Z", "2026-08-11T10:00:00.000Z"]);
    const childOnly = await createChain(["bez-dotazu", `child-only-${seed}`], ["2026-08-10T11:00:00.000Z", "2026-08-11T11:00:00.000Z"]);
    await createChain(["bez-dotazu", "stále-bez-dotazu"], ["2026-08-10T12:00:00.000Z", "2026-08-11T12:00:00.000Z"]);
    const both = await createChain([`both-${seed}`, `both-${seed}`, "bez-dotazu"], ["2026-08-10T13:00:00.000Z", "2026-08-11T13:00:00.000Z", "2026-08-12T13:00:00.000Z"]);
    const bothChild = await prisma.emailLog.findFirstOrThrow({ where: { resendRootId: both.root.id, subject: `both-${seed}` }, orderBy: { createdAt: "desc" } });

    const [rootOnlyResult, childOnlyResult, noMatchResult, bothResult, combinedResult] = await Promise.all([
      getAdminLogsData({ area: "owner", view: "attention", source: "email", query: `root-only-${seed}` }),
      getAdminLogsData({ area: "owner", view: "attention", source: "email", query: `child-only-${seed}` }),
      getAdminLogsData({ area: "owner", view: "attention", source: "email", query: `nenalezeno-${seed}` }),
      getAdminLogsData({ area: "owner", view: "attention", source: "email", query: `both-${seed}` }),
      getAdminLogsData({ area: "owner", view: "attention", source: "email", query: `both-${seed}`, dateFrom: "2026-08-11", dateTo: "2026-08-11" }),
    ]);

    assert.deepEqual(rootOnlyResult.items.map((item) => item.emailLogId), [rootOnly.root.id]);
    assert.deepEqual(childOnlyResult.items.map((item) => item.emailLogId), [childOnly.latest.id]);
    assert.equal(noMatchResult.total, 0);
    assert.deepEqual(noMatchResult.items, []);
    assert.deepEqual(bothResult.items.map((item) => item.emailLogId), [bothChild.id]);
    assert.deepEqual(combinedResult.items.map((item) => item.emailLogId), [bothChild.id]);
    for (const result of [rootOnlyResult, childOnlyResult, noMatchResult, bothResult, combinedResult]) {
      assert.equal(result.total, result.items.length);
    }
  } finally {
    await prisma.emailLog.deleteMany({ where: { id: { in: ids } } });
  }
});

dbTest("Pozornost filtruje rootové incidenty podle zobrazeného failed reprezentanta", async () => {
  const [{ prisma }, { getAdminLogsData }, { getAdminDashboardData }, { createHealthDiagnosticsRouteApi }] = await Promise.all([
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
      createHealthDiagnosticsRouteApi().GET(),
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
