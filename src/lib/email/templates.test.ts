import test from "node:test";
import assert from "node:assert/strict";

async function loadRenderer() {
  process.env.NEXT_PUBLIC_APP_NAME = "PP Studio";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
  process.env.ADMIN_SESSION_SECRET = "test-secret-value-with-at-least-32-chars";
  process.env.ADMIN_OWNER_EMAIL = "owner@example.com";
  process.env.ADMIN_OWNER_PASSWORD = "change-me-owner";
  process.env.ADMIN_STAFF_EMAIL = "staff@example.com";
  process.env.ADMIN_STAFF_PASSWORD = "change-me-staff";
  process.env.EMAIL_DELIVERY_MODE = "log";

  return import("@/lib/email/templates");
}

test("renderEmailTemplate creates confirmation email with cancellation link", async () => {
  const { renderEmailTemplate } = await loadRenderer();
  const email = await renderEmailTemplate(
    "booking-confirmation-v1",
    "Potvrzení rezervace: Luxusní péče",
    {
      bookingId: "clztestbooking1234",
      serviceName: "Luxusní péče",
      clientName: "Jana Nováková",
      scheduledStartsAt: "2026-04-20T08:00:00.000Z",
      scheduledEndsAt: "2026-04-20T09:00:00.000Z",
      manageReservationUrl: "https://example.com/rezervace/sprava/token-manage",
      cancellationUrl: "https://example.com/rezervace/storno/token123",
    },
  );

  assert.equal(email.subject, "Potvrzení rezervace: Luxusní péče");
  assert.match(email.text, /token-manage/);
  assert.match(email.text, /token123/);
  assert.match(email.html, /Změnit termín/);
  assert.match(email.html, /Zrušit rezervaci/);
});

test("renderEmailTemplate creates cancellation email without booking reference", async () => {
  const { renderEmailTemplate } = await loadRenderer();
  const email = await renderEmailTemplate(
    "booking-cancelled-v1",
    "Storno potvrzeno: Luxusní péče",
    {
      bookingId: "clztestbooking5678",
      serviceName: "Luxusní péče",
      clientName: "Jana Nováková",
      scheduledStartsAt: "2026-04-20T08:00:00.000Z",
      scheduledEndsAt: "2026-04-20T09:00:00.000Z",
    },
  );

  assert.equal(email.subject, "Storno potvrzeno: Luxusní péče");
  assert.match(email.html, /Rezervace byla zrušena/);
  assert.doesNotMatch(email.text, /Referenční kód/i);
});

test("renderEmailTemplate creates admin notification email with action links", async () => {
  const { renderEmailTemplate } = await loadRenderer();
  const email = await renderEmailTemplate(
    "admin-booking-notification-v1",
    "Nová rezervace: Luxusní péče",
    {
      bookingId: "clztestbooking9999",
      serviceName: "Luxusní péče",
      clientName: "Jana Nováková",
      clientEmail: "jana@example.com",
      clientPhone: "+420777123456",
      scheduledStartsAt: "2026-04-20T08:00:00.000Z",
      scheduledEndsAt: "2026-04-20T09:00:00.000Z",
      approveUrl: "https://example.com/rezervace/akce/approve/token-approve",
      rejectUrl: "https://example.com/rezervace/akce/reject/token-reject",
      adminUrl: "https://example.com/admin/rezervace/clztestbooking9999",
    },
  );

  assert.equal(email.subject, "Nová rezervace: Luxusní péče");
  assert.match(email.text, /token-approve/);
  assert.match(email.text, /token-reject/);
  assert.match(email.text, /Přesunout termín: https:\/\/example.com\/admin\/rezervace\/clztestbooking9999/);
  assert.match(email.html, /Potvrdit rezervaci/);
  assert.match(email.html, /Přesunout termín/);
  assert.match(email.html, /Otevřít v administraci/);
  assert.doesNotMatch(email.html, /Akční odkazy vedou/);
  assert.doesNotMatch(email.html, /letter-spacing:0\.08em/);
});

test("renderEmailTemplate creates approved email", async () => {
  const { renderEmailTemplate } = await loadRenderer();
  const email = await renderEmailTemplate(
    "booking-approved-v1",
    "Rezervace potvrzena: Luxusní péče",
    {
      bookingId: "clztestbookingapprove",
      serviceName: "Luxusní péče",
      clientName: "Jana Nováková",
      scheduledStartsAt: "2026-04-20T08:00:00.000Z",
      scheduledEndsAt: "2026-04-20T09:00:00.000Z",
      manageReservationUrl: "https://example.com/rezervace/sprava/token-approved",
    },
  );

  assert.match(email.text, /byla potvrzena/i);
  assert.match(email.text, /token-approved/);
  assert.match(email.text, /přiložené kalendářové události/i);
  assert.match(email.html, /Rezervace byla potvrzena/);
  assert.match(email.html, /Změnit termín/);
  assert.ok(email.attachments);
  assert.equal(email.attachments.length, 1);
  assert.equal(email.attachments[0]?.filename, "pp-studio-rezervace.ics");
  assert.match(email.attachments[0]?.content ?? "", /^BEGIN:VCALENDAR\r\n/);
});

test("renderEmailTemplate creates 24h reminder email without calendar attachment", async () => {
  const { renderEmailTemplate } = await loadRenderer();
  const email = await renderEmailTemplate(
    "booking-reminder-24h-v1",
    "Připomínka rezervace - zítra v PP Studio",
    {
      bookingId: "clztestbookingremind",
      serviceName: "Luxusní péče",
      clientName: "Jana Nováková",
      scheduledStartsAt: "2026-04-24T08:00:00.000Z",
      scheduledEndsAt: "2026-04-24T09:00:00.000Z",
      manageReservationUrl: "https://example.com/rezervace/sprava/token-reminder",
      cancellationUrl: "https://example.com/rezervace/storno/token-reminder",
    },
  );

  assert.equal(email.subject, "Připomínka rezervace - zítra v PP Studio");
  assert.match(email.text, /zítra máte rezervaci v PP Studiu/i);
  assert.match(email.text, /Jen krátká připomínka vašeho zítřejšího termínu/i);
  assert.match(email.text, /Kde nás najdete:/i);
  assert.match(email.text, /Změnit termín/);
  assert.match(email.text, /Ozvat se studiu/);
  assert.match(email.text, /Zrušit rezervaci/);
  assert.match(email.text, /Pokud by se cokoliv změnilo, dejte nám prosím vědět co nejdříve/i);
  assert.match(email.html, /Zítra máte rezervaci v PP Studiu/);
  assert.match(email.html, /Nemůžete dorazit\?/);
  assert.match(email.html, /Ozvat se studiu/);
  assert.equal(email.attachments, undefined);
});

test("renderEmailTemplate creates reschedule email with updated term and calendar attachment", async () => {
  const { renderEmailTemplate } = await loadRenderer();
  const email = await renderEmailTemplate(
    "booking-rescheduled-v1",
    "Změna termínu rezervace: Luxusní péče",
    {
      bookingId: "clztestbookingrescheduled",
      serviceName: "Luxusní péče",
      clientName: "Jana Nováková",
      previousStartsAt: "2026-04-24T08:00:00.000Z",
      previousEndsAt: "2026-04-24T09:00:00.000Z",
      scheduledStartsAt: "2026-04-25T10:00:00.000Z",
      scheduledEndsAt: "2026-04-25T11:00:00.000Z",
      manageReservationUrl: "https://example.com/rezervace/sprava/token-rescheduled-manage",
      cancellationUrl: "https://example.com/rezervace/storno/token-rescheduled",
      includeCalendarAttachment: true,
    },
  );

  assert.equal(email.subject, "Změna termínu rezervace: Luxusní péče");
  assert.match(email.text, /Původní termín:/);
  assert.match(email.text, /Nový termín:/);
  assert.match(email.text, /token-rescheduled-manage/);
  assert.match(email.text, /token-rescheduled/);
  assert.match(email.html, /Termín rezervace byl změněn/);
  assert.ok(email.attachments);
  assert.equal(email.attachments.length, 1);
});
