import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AvailabilitySlotStatus, BookingStatus, EmailAudience, EmailLogStatus, EmailLogType } from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE = "background";
process.env.EMAIL_TRANSPORT = "smtp";
process.env.SMTP_HOST = "smtp.example.test";
process.env.SMTP_PORT = "2525";
process.env.SMTP_USER = "test-user";
process.env.SMTP_PASSWORD = "test-password";
process.env.SMTP_FROM_EMAIL = "noreply@example.test";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("oprava kontaktu propojí resend s incidentem a uzavře jej až po doručení", async (t) => {
  if (typeof t.mock.module !== "function") {
    t.skip("Vyžaduje --experimental-test-module-mocks.");
    return;
  }
  t.mock.module("@/lib/auth/session", { exports: { requireAdminArea: async () => ({ email: "owner@example.com" }) } });
  t.mock.module("next/cache", { exports: { revalidatePath: () => undefined } });
  const [{ prisma }, { updateClientContactAction }, { applyResendWebhookEvent }] = await Promise.all([
    import("@/lib/prisma"), import("./client-actions"), import("@/lib/email/resend-webhooks"),
  ]);
  const seed = randomUUID();
  const oldEmail = `old-${seed}@example.test`;
  const newEmail = `new-${seed}@example.test`;
  const category = await prisma.serviceCategory.create({ data: { name: "Test", slug: `category-${seed}` } });
  const service = await prisma.service.create({ data: { categoryId: category.id, name: "Test", slug: `service-${seed}`, durationMinutes: 60 } });
  const client = await prisma.client.create({ data: { fullName: "Test", email: oldEmail, phone: "+420777111222" } });
  const startsAt = new Date(Date.now() + 86400000 * 5);
  const endsAt = new Date(startsAt.getTime() + 3600000);
  const slot = await prisma.availabilitySlot.create({ data: { startsAt, endsAt, status: AvailabilitySlotStatus.PUBLISHED } });
  const booking = await prisma.booking.create({ data: {
    clientId: client.id, slotId: slot.id, serviceId: service.id, status: BookingStatus.PENDING,
    clientNameSnapshot: "Test", clientEmailSnapshot: oldEmail, clientPhoneSnapshot: client.phone,
    serviceNameSnapshot: "Test", serviceDurationMinutes: 60, scheduledStartsAt: startsAt, scheduledEndsAt: endsAt,
  } });
  const source = await prisma.emailLog.create({ data: {
    clientId: client.id, bookingId: booking.id, type: EmailLogType.BOOKING_RECEIVED,
    audience: EmailAudience.CLIENT, status: EmailLogStatus.SENT, recipientEmail: oldEmail,
    subject: "Přijetí rezervace", templateKey: "booking-confirmation-v1", trackingBouncedAt: new Date(),
    payload: { serviceId: service.id, scheduledStartsAt: startsAt.toISOString(), scheduledEndsAt: endsAt.toISOString() },
  } });
  t.after(async () => {
    await prisma.emailProviderWebhookEvent.deleteMany({ where: { providerEventId: `event-${seed}` } });
    await prisma.emailLog.deleteMany({ where: { bookingId: booking.id, resendRootId: source.id } });
    await prisma.emailLog.deleteMany({ where: { bookingId: booking.id } });
    await prisma.booking.delete({ where: { id: booking.id } });
    await prisma.availabilitySlot.delete({ where: { id: slot.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  });
  const form = new FormData();
  form.set("area", "owner"); form.set("clientId", client.id); form.set("incidentEmailLogId", source.id); form.set("email", newEmail);
  await prisma.emailLog.update({ where: { id: source.id }, data: { communicationGeneration: 0 } });
  assert.equal((await updateClientContactAction({ status: "idle" }, form)).status, "error");
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).email, oldEmail);
  assert.equal(await prisma.emailLog.count({ where: { resendOfId: source.id } }), 0);
  await prisma.emailLog.update({ where: { id: source.id }, data: { communicationGeneration: booking.communicationGeneration } });
  const result = await updateClientContactAction({ status: "idle" }, form);
  assert.equal(result.status, "success", result.formError ?? "Oprava selhala.");
  const updatedClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
  const updatedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
  const original = await prisma.emailLog.findUniqueOrThrow({ where: { id: source.id } });
  const resend = await prisma.emailLog.findFirstOrThrow({ where: { resendOfId: source.id } });
  assert.equal(updatedClient.email, newEmail);
  assert.equal(updatedClient.phone, client.phone);
  assert.equal(updatedBooking.clientEmailSnapshot, newEmail);
  assert.equal(original.recipientEmail, oldEmail);
  assert.ok(original.trackingBouncedAt);
  assert.equal(original.incidentResolvedAt, null);
  assert.equal(resend.recipientEmail, newEmail);
  assert.equal(resend.resendRootId, source.id);
  assert.equal(resend.status, EmailLogStatus.PENDING);
  assert.equal(await prisma.emailLog.count({ where: { bookingId: booking.id, status: EmailLogStatus.PENDING, templateKey: source.templateKey } }), 1);
  assert.equal((await updateClientContactAction({ status: "idle" }, form)).status, "error");
  await prisma.emailLog.update({ where: { id: resend.id }, data: { status: EmailLogStatus.SENT, providerMessageId: `provider-${seed}` } });
  await applyResendWebhookEvent({ event: { type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: `provider-${seed}` } }, providerEventId: `event-${seed}` });
  const resolved = await prisma.emailLog.findUniqueOrThrow({ where: { id: source.id } });
  assert.equal(resolved.incidentResolvedByEmailLogId, resend.id);
  assert.equal(resolved.incidentResolutionKind, "DELIVERED_RESEND");
  assert.equal(resolved.recipientEmail, oldEmail);
});
