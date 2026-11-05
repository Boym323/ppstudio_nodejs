import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  AvailabilitySlotStatus,
  BookingActionTokenType,
  BookingSource,
  BookingStatus,
  EmailAudience,
  EmailLogStatus,
  EmailLogType,
} from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_URL ??= "https://example.test";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-characters";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.test";
process.env.EMAIL_DELIVERY_MODE = "background";
process.env.EMAIL_TRANSPORT = "smtp";
process.env.SMTP_HOST = "smtp.example.test";
process.env.SMTP_PORT = "2525";
process.env.SMTP_USER = "test-user";
process.env.SMTP_PASSWORD = "test-password";
process.env.SMTP_FROM_EMAIL = "noreply@example.test";
process.env.PUSHOVER_ENABLED = "false";
process.env.SITE_SETTINGS_SNAPSHOT_PATH = `/tmp/ppstudio-client-merge-test-${process.pid}.json`;

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("náhled chrání směr sloučení, kontakty, audit, pozdní webhook i starý výběr klientky", async (t) => {
  const databaseHost = new URL(process.env.DATABASE_URL!).hostname;
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(databaseHost), "Test vyžaduje izolovanou lokální databázi.");
  assert.equal(typeof t.mock?.module, "function", "Integrační test vyžaduje --experimental-test-module-mocks.");

  const { prisma } = await import("@/lib/prisma");
  const suffix = randomUUID();
  const owner = await prisma.adminUser.create({ data: { name: "Vlastník test", email: `owner-${suffix}@example.test`, role: "OWNER" } });
  t.mock.module("@/lib/auth/session", { exports: { requireAdminArea: async (area: string) => {
    assert.equal(area, "owner");
    return { sub: owner.id, email: owner.email, role: owner.role };
  } } });
  t.mock.module("next/cache", { exports: { revalidatePath: () => undefined } });
  const [{ mergeClientProfilesAction }, { applyResendWebhookEvent }, { CLIENT_MERGE_AUDIT_MARKER, isMergedClientProfile }, { createManualBooking }, { updateClientContactAction, updateClientNoteAction }, { getAdminClientDetailData }, { getManualBookingClientById }] = await Promise.all([
    import("@/features/admin/actions/client-merge-actions"),
    import("@/lib/email/resend-webhooks"),
    import("@/features/clients/lib/client-merge-marker"),
    import("@/features/booking/lib/booking-public"),
    import("@/features/admin/actions/client-actions"),
    import("@/features/admin/lib/admin-clients"),
    import("@/features/admin/lib/data/clients"),
  ]);

  const oldEmail = `old-${suffix}@example.test`;
  const correctEmail = `correct-${suffix}@example.test`;
  const category = await prisma.serviceCategory.create({ data: { name: "Sloučení test", slug: `merge-${suffix}` } });
  const service = await prisma.service.create({ data: { categoryId: category.id, name: "Ošetření", slug: `merge-service-${suffix}`, durationMinutes: 60, isActive: true, isPubliclyBookable: true } });
  const source = await prisma.client.create({ data: { fullName: "Veronika Celá", email: oldEmail, phone: "+420777111222", internalNote: "Poznámka zdroje" } });
  const target = await prisma.client.create({ data: { fullName: "Veronika C", email: correctEmail, phone: null, internalNote: "Poznámka cíle" } });
  const starts = new Date(Date.now() + 10 * 86400000);
  starts.setUTCHours(8, 0, 0, 0);
  const targetStart = new Date(starts.getTime() + 86400000);
  const staleStart = new Date(starts.getTime() + 2 * 86400000);
  const makeSlot = (start: Date) => prisma.availabilitySlot.create({ data: { startsAt: start, endsAt: new Date(start.getTime() + 3600000), status: AvailabilitySlotStatus.PUBLISHED, capacity: 1 } });
  const [sourceSlot, targetSlot, staleSlot] = await Promise.all([makeSlot(starts), makeSlot(targetStart), makeSlot(staleStart)]);
  const makeBooking = (clientId: string, slotId: string, start: Date, email: string, phone: string | null) => prisma.booking.create({ data: {
    clientId, slotId, serviceId: service.id, status: BookingStatus.CONFIRMED,
    clientNameSnapshot: "Veronika", clientEmailSnapshot: email, clientPhoneSnapshot: phone,
    serviceNameSnapshot: "Ošetření", serviceDurationMinutes: 60,
    scheduledStartsAt: start, scheduledEndsAt: new Date(start.getTime() + 3600000),
  } });
  const sourceBooking = await makeBooking(source.id, sourceSlot.id, starts, oldEmail, source.phone);
  const targetBooking = await makeBooking(target.id, targetSlot.id, targetStart, correctEmail, null);
  const oldToken = await prisma.bookingActionToken.create({ data: {
    bookingId: sourceBooking.id, type: BookingActionTokenType.CANCEL, tokenHash: `merge-token-${suffix}`, expiresAt: new Date(starts.getTime() + 3600000),
  } });
  const submission = await prisma.bookingSubmissionLog.create({ data: { clientId: source.id, bookingId: sourceBooking.id, outcome: "SUCCESS" } });
  const makeOldLog = (label: string, type: EmailLogType, bounced: boolean) => prisma.emailLog.create({ data: {
    clientId: source.id, bookingId: sourceBooking.id, type, audience: EmailAudience.CLIENT,
    status: EmailLogStatus.SENT, recipientEmail: oldEmail, subject: "Test", templateKey: "booking-approved-v1",
    provider: "resend", providerMessageId: `${label}-${suffix}`, trackingBouncedAt: bounced ? new Date() : null,
  } });
  const [oldBounce, oldEarly, oldLate, oldConcurrent, unrelated] = await Promise.all([
    makeOldLog("bounce", EmailLogType.BOOKING_CONFIRMED, true),
    makeOldLog("early", EmailLogType.BOOKING_CONFIRMED, false),
    makeOldLog("late", EmailLogType.BOOKING_CONFIRMED, false),
    makeOldLog("concurrent", EmailLogType.BOOKING_CONFIRMED, false),
    makeOldLog("cancel", EmailLogType.BOOKING_CANCELLED, true),
  ]);
  t.after(async () => {
    await prisma.emailProviderWebhookEvent.deleteMany({ where: { providerEventId: { contains: suffix } } });
    await prisma.emailLog.deleteMany({ where: { bookingId: { in: [sourceBooking.id, targetBooking.id] }, resendRootId: { not: null } } });
    await prisma.emailLog.deleteMany({ where: { bookingId: { in: [sourceBooking.id, targetBooking.id] } } });
    await prisma.bookingSubmissionLog.deleteMany({ where: { id: submission.id } });
    await prisma.bookingActionToken.deleteMany({ where: { bookingId: { in: [sourceBooking.id, targetBooking.id] } } });
    await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: { in: [sourceBooking.id, targetBooking.id] } } });
    await prisma.booking.deleteMany({ where: { id: { in: [sourceBooking.id, targetBooking.id] } } });
    await prisma.availabilitySlot.deleteMany({ where: { id: { in: [sourceSlot.id, targetSlot.id, staleSlot.id] } } });
    await prisma.client.deleteMany({ where: { id: { in: [source.id, target.id] } } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
    await prisma.adminUser.delete({ where: { id: owner.id } });
  });

  const previewForm = () => {
    const form = new FormData();
    form.set("intent", "preview"); form.set("sourceClientId", source.id); form.set("targetEmail", correctEmail);
    return form;
  };
  const ambiguous = await prisma.client.create({ data: { fullName: "Jiný profil", email: correctEmail.toUpperCase() } });
  try {
    const ambiguousResult = await mergeClientProfilesAction({ status: "idle" }, previewForm());
    assert.equal(ambiguousResult.status, "error");
    assert.match(ambiguousResult.formError ?? "", /jednoznačně/);
  } finally {
    await prisma.client.delete({ where: { id: ambiguous.id } });
  }
  const confirmForm = (token: string, sourceEmail = oldEmail) => {
    const form = new FormData();
    form.set("intent", "merge"); form.set("previewToken", token); form.set("confirmSourceEmail", sourceEmail);
    form.set("nameChoice", "source"); form.set("phoneChoice", "source"); form.set("confirmEffects", "on");
    return form;
  };
  const initialPreview = await mergeClientProfilesAction({ status: "idle" }, previewForm());
  assert.equal(initialPreview.status, "preview");
  assert.equal(initialPreview.preview?.source.id, source.id);
  assert.equal(initialPreview.preview?.target.id, target.id);
  assert.equal(initialPreview.preview?.target.phone, null);
  assert.equal(initialPreview.preview?.source.bookingCount, 1);
  assert.equal(initialPreview.preview?.target.bookingCount, 1);
  assert.ok(initialPreview.previewToken);
  const tampered = await mergeClientProfilesAction({ status: "idle" }, confirmForm(`${initialPreview.previewToken}.x`));
  assert.equal(tampered.status, "error");
  await prisma.client.update({ where: { id: target.id }, data: { fullName: "Veronika změna" } });
  const stale = await mergeClientProfilesAction({ status: "idle" }, confirmForm(initialPreview.previewToken));
  assert.equal(stale.status, "error");
  assert.match(stale.formError ?? "", /náhled/i);
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: sourceBooking.id } })).clientId, source.id);

  const bookingPreview = await mergeClientProfilesAction({ status: "idle" }, previewForm());
  assert.ok(bookingPreview.previewToken);
  await prisma.booking.update({ where: { id: targetBooking.id }, data: { clientPhoneSnapshot: "+420777999888" } });
  assert.equal((await mergeClientProfilesAction({ status: "idle" }, confirmForm(bookingPreview.previewToken))).status, "error");
  await prisma.booking.update({ where: { id: targetBooking.id }, data: { clientPhoneSnapshot: null } });
  const preview = await mergeClientProfilesAction({ status: "idle" }, previewForm());
  assert.ok(preview.previewToken);
  const wrongSource = await mergeClientProfilesAction({ status: "idle" }, confirmForm(preview.previewToken, correctEmail));
  assert.equal(wrongSource.status, "error");
  const missingChoice = confirmForm(preview.previewToken);
  missingChoice.delete("phoneChoice");
  assert.equal((await mergeClientProfilesAction({ status: "idle" }, missingChoice)).status, "error");
  const attempts = await Promise.all([
    mergeClientProfilesAction({ status: "idle" }, confirmForm(preview.previewToken)),
    mergeClientProfilesAction({ status: "idle" }, confirmForm(preview.previewToken)),
  ]);
  assert.equal(attempts.filter((result) => result.status === "success").length, 1);
  const merged = attempts.find((result) => result.status === "success")!;
  assert.equal(merged.status, "success", merged.formError ?? "Sloučení selhalo.");

  const [savedSource, savedTarget, savedBooking, savedTargetBooking, revoked] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: source.id } }),
    prisma.client.findUniqueOrThrow({ where: { id: target.id } }),
    prisma.booking.findUniqueOrThrow({ where: { id: sourceBooking.id } }),
    prisma.booking.findUniqueOrThrow({ where: { id: targetBooking.id } }),
    prisma.bookingActionToken.findUniqueOrThrow({ where: { id: oldToken.id } }),
  ]);
  assert.equal(isMergedClientProfile(savedSource), true);
  assert.equal(savedSource.email, null);
  assert.equal(savedSource.phone, null);
  assert.equal(savedTarget.fullName, source.fullName);
  assert.equal(savedTarget.phone, source.phone);
  assert.match(savedTarget.internalNote ?? "", /Poznámka zdroje/);
  assert.equal(savedBooking.clientId, target.id);
  assert.equal(savedBooking.clientNameSnapshot, source.fullName);
  assert.equal(savedBooking.clientEmailSnapshot, correctEmail);
  assert.equal(savedBooking.clientPhoneSnapshot, source.phone);
  assert.equal(savedTargetBooking.clientNameSnapshot, source.fullName);
  assert.equal(savedTargetBooking.clientPhoneSnapshot, source.phone);
  assert.ok(revoked.revokedAt);
  const audit = JSON.parse(savedSource.internalNote!.split(CLIENT_MERGE_AUDIT_MARKER)[1]!);
  assert.equal(audit.sourceBefore.email, oldEmail);
  assert.equal(audit.sourceBefore.phone, source.phone);
  assert.equal(audit.targetBefore.phone, null);
  assert.ok(audit.bookingBefore.some((booking: { id: string }) => booking.id === sourceBooking.id));
  assert.ok(audit.bookingBefore.some((booking: { id: string; clientNameSnapshot: string }) => booking.id === sourceBooking.id && booking.clientNameSnapshot === "Veronika"));
  assert.ok(audit.bookingBefore.some((booking: { id: string; clientPhoneSnapshot: string | null }) => booking.id === targetBooking.id && booking.clientPhoneSnapshot === null));
  assert.equal((await prisma.bookingSubmissionLog.findUniqueOrThrow({ where: { id: submission.id } })).clientId, target.id);
  const archivedDetail = await getAdminClientDetailData("owner", source.id);
  assert.equal(archivedDetail?.isMerged, true);
  assert.equal(archivedDetail?.mergedTargetHref, `/admin/klienti/${target.id}`);
  assert.doesNotMatch(archivedDetail?.internalNote ?? "", /CLIENT_MERGE_AUDIT_V1/);
  assert.equal(await getManualBookingClientById(source.id), null);
  const noteForm = new FormData();
  noteForm.set("area", "owner"); noteForm.set("clientId", source.id); noteForm.set("internalNote", "Stará úprava");
  assert.equal((await updateClientNoteAction({ status: "idle" }, noteForm)).status, "error");
  const contactForm = new FormData();
  contactForm.set("area", "owner"); contactForm.set("clientId", source.id); contactForm.set("email", oldEmail); contactForm.set("phone", source.phone ?? "");
  assert.equal((await updateClientContactAction({ status: "idle" }, contactForm)).status, "error");
  assert.ok((await prisma.client.findUniqueOrThrow({ where: { id: source.id } })).internalNote?.includes(CLIENT_MERGE_AUDIT_MARKER));

  const replacement = await prisma.emailLog.findFirstOrThrow({ where: { bookingId: sourceBooking.id, clientId: target.id, status: EmailLogStatus.PENDING, type: EmailLogType.BOOKING_CONFIRMED } });
  assert.ok(audit.createdEmailLogIds.includes(replacement.id));
  assert.equal(replacement.recipientEmail, correctEmail);
  const notifications: string[] = [];
  await prisma.emailLog.update({ where: { id: replacement.id }, data: { status: EmailLogStatus.SENT, providerMessageId: `replacement-${suffix}` } });
  const webhook = (type: string, providerMessageId: string, id: string) => applyResendWebhookEvent({
    event: { type, created_at: new Date().toISOString(), data: { email_id: providerMessageId } },
    providerEventId: `${id}-${suffix}`,
    notifyDeliveryIssue: async ({ emailLogId }) => { notifications.push(emailLogId); },
  });
  await webhook("email.bounced", `early-${suffix}`, "event-early");
  assert.equal((await prisma.emailLog.findUniqueOrThrow({ where: { id: oldEarly.id } })).incidentResolvedAt, null);
  await Promise.all([
    webhook("email.delivered", `replacement-${suffix}`, "event-delivered"),
    webhook("email.bounced", `concurrent-${suffix}`, "event-concurrent"),
  ]);
  assert.ok((await prisma.emailLog.findUniqueOrThrow({ where: { id: oldBounce.id } })).incidentResolvedAt);
  assert.ok((await prisma.emailLog.findUniqueOrThrow({ where: { id: oldEarly.id } })).incidentResolvedAt);
  assert.ok((await prisma.emailLog.findUniqueOrThrow({ where: { id: oldConcurrent.id } })).incidentResolvedAt);
  assert.ok(notifications.every((emailLogId) => [oldEarly.id, oldConcurrent.id].includes(emailLogId)));
  const notificationsAfterReplacement = notifications.length;
  await webhook("email.bounced", `late-${suffix}`, "event-late");
  const savedLate = await prisma.emailLog.findUniqueOrThrow({ where: { id: oldLate.id } });
  assert.ok(savedLate.incidentResolvedAt);
  assert.equal(savedLate.incidentResolvedByEmailLogId, replacement.id);
  assert.equal(savedLate.recipientEmail, oldEmail);
  await webhook("email.failed", `late-${suffix}`, "event-late-failed");
  await webhook("email.suppressed", `late-${suffix}`, "event-late-suppressed");
  assert.equal(notifications.length, notificationsAfterReplacement);
  const newIncident = await prisma.emailLog.create({ data: {
    clientId: target.id, bookingId: targetBooking.id, type: EmailLogType.BOOKING_CONFIRMED,
    audience: EmailAudience.CLIENT, status: EmailLogStatus.SENT, recipientEmail: correctEmail,
    subject: "Nový incident", templateKey: "booking-approved-v1", provider: "resend",
    providerMessageId: `new-incident-${suffix}`,
  } });
  await webhook("email.failed", `new-incident-${suffix}`, "event-new-incident");
  assert.equal(notifications.length, notificationsAfterReplacement + 1);
  assert.equal(notifications.at(-1), newIncident.id);
  assert.equal((await prisma.emailLog.findUniqueOrThrow({ where: { id: unrelated.id } })).incidentResolvedAt, null);

  await assert.rejects(() => createManualBooking({
    serviceId: service.id, slotId: staleSlot.id, startsAt: staleStart.toISOString(), allowManualOverride: false,
    selectedClientId: source.id, fullName: source.fullName, email: oldEmail, phone: source.phone ?? "",
    source: BookingSource.PHONE, status: BookingStatus.CONFIRMED, actorUserId: null,
    sendClientEmail: false, includeCalendarAttachment: false,
  }), /profil už není dostupný/i);
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: source.id } })).isActive, false);
});

dbTest("sloučení profilu bez rezervací zachová audit i původní kontakty", async (t) => {
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(new URL(process.env.DATABASE_URL!).hostname));
  const [{ prisma }, { loadClientMergePreview }, { mergeClientProfiles }, { CLIENT_MERGE_AUDIT_MARKER }] = await Promise.all([
    import("@/lib/prisma"), import("./client-merge-preview"), import("./client-merge"), import("@/features/clients/lib/client-merge-marker"),
  ]);
  const suffix = randomUUID();
  const source = await prisma.client.create({ data: { fullName: "Zdroj bez rezervace", email: `empty-source-${suffix}@example.test`, phone: "+420777222333" } });
  const target = await prisma.client.create({ data: { fullName: "Cíl bez rezervace", email: `empty-target-${suffix}@example.test`, phone: "+420777444555" } });
  t.after(async () => prisma.client.deleteMany({ where: { id: { in: [source.id, target.id] } } }));
  const preview = await loadClientMergePreview(source.id, target.id);
  assert.ok(preview);
  await mergeClientProfiles({
    sourceClientId: source.id, targetClientId: target.id, actorUserId: null,
    expectedSourceEmail: source.email!, expectedTargetEmail: target.email!, expectedFingerprint: preview.fingerprint,
    nameChoice: "target", phoneChoice: "target",
  });
  const savedSource = await prisma.client.findUniqueOrThrow({ where: { id: source.id } });
  const audit = JSON.parse(savedSource.internalNote!.split(CLIENT_MERGE_AUDIT_MARKER)[1]!);
  assert.equal(audit.sourceBefore.email, source.email);
  assert.equal(audit.sourceBefore.phone, source.phone);
  assert.equal(audit.targetBefore.phone, target.phone);
  assert.deepEqual(audit.bookingBefore, []);
});

dbTest("volba jména cílového profilu sjednotí aktivní snapshoty a čekající potvrzení", async (t) => {
  assert.equal(typeof t.mock?.module, "function", "Integrační test vyžaduje --experimental-test-module-mocks.");
  const [{ prisma }, { loadClientMergePreview }, { mergeClientProfiles }] = await Promise.all([
    import("@/lib/prisma"), import("./client-merge-preview"), import("./client-merge"),
  ]);
  const suffix = randomUUID();
  const category = await prisma.serviceCategory.create({ data: { name: `Jméno merge ${suffix}`, slug: `merge-name-${suffix}` } });
  const service = await prisma.service.create({ data: { categoryId: category.id, name: `Služba merge ${suffix}`, slug: `merge-name-service-${suffix}`, durationMinutes: 60 } });
  const source = await prisma.client.create({ data: { fullName: `Zdrojové jméno ${suffix}`, email: `merge-name-source-${suffix}@example.test`, phone: "+420777000111" } });
  const target = await prisma.client.create({ data: { fullName: `Cílové jméno ${suffix}`, email: `merge-name-target-${suffix}@example.test`, phone: "+420777000222" } });
  const now = new Date();
  const futureStart = new Date(now.getTime() + 7 * 86400000);
  const historicalStart = new Date(now.getTime() - 7 * 86400000);
  const slots = await Promise.all([futureStart, historicalStart].map((startsAt) => prisma.availabilitySlot.create({
    data: { startsAt, endsAt: new Date(startsAt.getTime() + 3600000), status: AvailabilitySlotStatus.PUBLISHED },
  })));
  const sourceBooking = await prisma.booking.create({ data: {
    clientId: source.id, slotId: slots[0]!.id, serviceId: service.id, status: BookingStatus.CONFIRMED,
    clientNameSnapshot: source.fullName, clientEmailSnapshot: source.email!, clientPhoneSnapshot: source.phone,
    serviceNameSnapshot: service.name, serviceDurationMinutes: 60, scheduledStartsAt: futureStart, scheduledEndsAt: new Date(futureStart.getTime() + 3600000),
  } });
  const targetBooking = await prisma.booking.create({ data: {
    clientId: target.id, slotId: slots[1]!.id, serviceId: service.id, status: BookingStatus.COMPLETED,
    clientNameSnapshot: `Historické jméno ${suffix}`, clientEmailSnapshot: target.email!, clientPhoneSnapshot: target.phone,
    serviceNameSnapshot: service.name, serviceDurationMinutes: 60, scheduledStartsAt: historicalStart, scheduledEndsAt: new Date(historicalStart.getTime() + 3600000),
  } });
  const targetFutureSlot = await prisma.availabilitySlot.create({ data: { startsAt: new Date(futureStart.getTime() + 86400000), endsAt: new Date(futureStart.getTime() + 86400000 + 3600000), status: AvailabilitySlotStatus.PUBLISHED } });
  const targetFutureBooking = await prisma.booking.create({ data: {
    clientId: target.id, slotId: targetFutureSlot.id, serviceId: service.id, status: BookingStatus.PENDING,
    clientNameSnapshot: target.fullName, clientEmailSnapshot: target.email!, clientPhoneSnapshot: target.phone,
    serviceNameSnapshot: service.name, serviceDurationMinutes: 60, scheduledStartsAt: targetFutureSlot.startsAt, scheduledEndsAt: targetFutureSlot.endsAt,
  } });
  const pendingTargetEmail = await prisma.emailLog.create({ data: {
    clientId: target.id, bookingId: targetFutureBooking.id, type: EmailLogType.BOOKING_RECEIVED,
    audience: EmailAudience.CLIENT, status: EmailLogStatus.PENDING, recipientEmail: target.email!, subject: "Čekající potvrzení",
    templateKey: "booking-confirmation-v1", payload: { clientName: target.fullName, scheduledStartsAt: targetFutureBooking.scheduledStartsAt.toISOString(), scheduledEndsAt: targetFutureBooking.scheduledEndsAt.toISOString() },
  } });

  try {
    const preview = await loadClientMergePreview(source.id, target.id);
    assert.ok(preview);
    await mergeClientProfiles({
      sourceClientId: source.id, targetClientId: target.id, actorUserId: null,
      expectedSourceEmail: source.email!, expectedTargetEmail: target.email!, expectedFingerprint: preview.fingerprint,
      nameChoice: "target", phoneChoice: "target",
    });
    const [savedSourceBooking, savedTargetBooking, savedHistorical, savedPending, replacement] = await Promise.all([
      prisma.booking.findUniqueOrThrow({ where: { id: sourceBooking.id } }),
      prisma.booking.findUniqueOrThrow({ where: { id: targetFutureBooking.id } }),
      prisma.booking.findUniqueOrThrow({ where: { id: targetBooking.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: pendingTargetEmail.id } }),
      prisma.emailLog.findFirstOrThrow({ where: { bookingId: sourceBooking.id, clientId: target.id, status: EmailLogStatus.PENDING, type: EmailLogType.BOOKING_CONFIRMED } }),
    ]);
    assert.equal(savedSourceBooking.clientNameSnapshot, target.fullName);
    assert.equal(savedTargetBooking.clientNameSnapshot, target.fullName);
    assert.equal(savedHistorical.clientNameSnapshot, `Historické jméno ${suffix}`);
    assert.equal((savedPending.payload as { clientName: string }).clientName, target.fullName);
    assert.equal((replacement.payload as { clientName: string }).clientName, target.fullName);
  } finally {
    await prisma.emailLog.deleteMany({ where: { bookingId: { in: [sourceBooking.id, targetBooking.id, targetFutureBooking.id] } } });
    await prisma.booking.deleteMany({ where: { id: { in: [sourceBooking.id, targetBooking.id, targetFutureBooking.id] } } });
    await prisma.availabilitySlot.deleteMany({ where: { id: { in: [...slots.map((slot) => slot.id), targetFutureSlot.id] } } });
    await prisma.client.deleteMany({ where: { id: { in: [source.id, target.id] } } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});

dbTest("sloučení opraví klientské jméno i v GENERIC oznámení změny služby", async (t) => {
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(new URL(process.env.DATABASE_URL!).hostname), "Test vyžaduje izolovanou lokální databázi.");
  assert.equal(typeof t.mock?.module, "function", "Integrační test vyžaduje --experimental-test-module-mocks.");
  const [{ prisma }, { loadClientMergePreview }, { mergeClientProfiles }] = await Promise.all([
    import("@/lib/prisma"), import("./client-merge-preview"), import("./client-merge"),
  ]);
  const suffix = randomUUID();
  const category = await prisma.serviceCategory.create({ data: { name: "Merge GENERIC " + suffix, slug: "merge-generic-" + suffix } });
  const service = await prisma.service.create({ data: {
    categoryId: category.id, name: "Ošetření " + suffix, slug: "merge-generic-service-" + suffix, durationMinutes: 60,
  } });
  const source = await prisma.client.create({ data: { fullName: "Nové jméno " + suffix, email: "merge-generic-source-" + suffix + "@example.test" } });
  const target = await prisma.client.create({ data: { fullName: "Původní jméno " + suffix, email: "merge-generic-target-" + suffix + "@example.test" } });
  const now = new Date();
  const startsAt = new Date(now.getTime() + 7 * 86400000);
  const slot = await prisma.availabilitySlot.create({ data: {
    startsAt, endsAt: new Date(startsAt.getTime() + 3600000), status: AvailabilitySlotStatus.PUBLISHED,
  } });
  const booking = await prisma.booking.create({ data: {
    clientId: target.id, slotId: slot.id, serviceId: service.id, status: BookingStatus.CONFIRMED,
    clientNameSnapshot: target.fullName, clientEmailSnapshot: target.email!, clientPhoneSnapshot: null,
    serviceNameSnapshot: service.name, serviceDurationMinutes: 60, scheduledStartsAt: startsAt, scheduledEndsAt: slot.endsAt,
  } });
  const serviceChange = await prisma.emailLog.create({ data: {
    clientId: target.id, bookingId: booking.id, type: EmailLogType.GENERIC,
    audience: EmailAudience.CLIENT, status: EmailLogStatus.PENDING, recipientEmail: target.email!,
    subject: "Změna služby", templateKey: "booking-service-changed-v1",
    payload: { bookingId: booking.id, clientName: target.fullName, previousServiceName: "Původní ošetření" },
  } });
  const unrelatedGeneric = await prisma.emailLog.create({ data: {
    clientId: target.id, bookingId: booking.id, type: EmailLogType.GENERIC,
    audience: EmailAudience.CLIENT, status: EmailLogStatus.PENDING, recipientEmail: target.email!,
    subject: "Jiné sdělení", templateKey: "client-custom-notification-v1",
    payload: { clientName: target.fullName, marker: "nezměnit" },
  } });
  const alreadySent = await prisma.emailLog.create({ data: {
    clientId: target.id, bookingId: booking.id, type: EmailLogType.GENERIC,
    audience: EmailAudience.CLIENT, status: EmailLogStatus.SENT, recipientEmail: target.email!,
    subject: "Odeslaná změna služby", templateKey: "booking-service-changed-v1",
    payload: { clientName: target.fullName, marker: "historie" }, sentAt: now,
  } });

  try {
    const preview = await loadClientMergePreview(source.id, target.id);
    assert.ok(preview);
    await mergeClientProfiles({
      sourceClientId: source.id, targetClientId: target.id, actorUserId: null,
      expectedSourceEmail: source.email!, expectedTargetEmail: target.email!, expectedFingerprint: preview.fingerprint,
      nameChoice: "source", phoneChoice: "target",
    });
    const [savedBooking, savedServiceChange, savedUnrelated, savedSent] = await Promise.all([
      prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: serviceChange.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: unrelatedGeneric.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: alreadySent.id } }),
    ]);
    assert.equal(savedBooking.clientNameSnapshot, source.fullName);
    assert.equal(savedServiceChange.status, EmailLogStatus.PENDING);
    assert.equal((savedServiceChange.payload as { clientName: string; previousServiceName: string }).clientName, source.fullName);
    assert.equal((savedServiceChange.payload as { previousServiceName: string }).previousServiceName, "Původní ošetření");
    assert.equal((savedUnrelated.payload as { clientName: string }).clientName, target.fullName);
    assert.equal((savedSent.payload as { clientName: string }).clientName, target.fullName);
  } finally {
    await prisma.emailLog.deleteMany({ where: { bookingId: booking.id } });
    await prisma.booking.delete({ where: { id: booking.id } });
    await prisma.availabilitySlot.delete({ where: { id: slot.id } });
    await prisma.client.deleteMany({ where: { id: { in: [source.id, target.id] } } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});
