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

test("renderEmailTemplate creates confirmation email without post-submit action links", async () => {
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
  assert.doesNotMatch(email.text, /token-manage/);
  assert.doesNotMatch(email.text, /token123/);
  assert.doesNotMatch(email.html, /Další kroky/i);
  assert.doesNotMatch(email.html, /Změnit termín/);
  assert.doesNotMatch(email.html, /Zrušit rezervaci/);
});

test("renderEmailTemplate creates confirmation email for legacy payload without action urls", async () => {
  const { renderEmailTemplate } = await loadRenderer();
  const email = await renderEmailTemplate(
    "booking-confirmation-v1",
    "Potvrzení rezervace: Luxusní péče",
    {
      bookingId: "clztestbookinglegacy",
      serviceName: "Luxusní péče",
      clientName: "Jana Nováková",
      scheduledStartsAt: "2026-04-20T08:00:00.000Z",
      scheduledEndsAt: "2026-04-20T09:00:00.000Z",
    },
  );

  assert.equal(email.subject, "Potvrzení rezervace: Luxusní péče");
  assert.match(email.text, /Rezervace přijata/);
  assert.doesNotMatch(email.text, /Změnit termín:/i);
  assert.doesNotMatch(email.html, /Zrušit rezervaci/);
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

test("renderEmailTemplate creates rejected email in shared client layout", async () => {
  const { renderEmailTemplate } = await loadRenderer();
  const email = await renderEmailTemplate(
    "booking-rejected-v1",
    "Rezervaci se nepodařilo potvrdit: Luxusní péče",
    {
      bookingId: "clztestbookingrejected",
      serviceName: "Luxusní péče",
      clientName: "Jana Nováková",
      scheduledStartsAt: "2026-04-20T08:00:00.000Z",
      scheduledEndsAt: "2026-04-20T09:00:00.000Z",
    },
  );

  assert.match(email.text, /Rezervaci se tentokrát nepodařilo potvrdit/);
  assert.match(email.text, /Služba: Luxusní péče/);
  assert.match(email.text, /Místo:\nPP Studio\nSadová 2, 760 01 Zlín/);
  assert.match(email.text, /Napište nám: info@ppstudio\.cz/);
  assert.match(email.html, /Vybrat nový termín/);
  assert.doesNotMatch(email.html, /Pokud budete potřebovat pomoci/);
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

test("renderEmailTemplate creates admin cancellation email in operational layout", async () => {
  const { renderEmailTemplate } = await loadRenderer();
  const email = await renderEmailTemplate(
    "admin-booking-cancelled-v1",
    "Rezervace zrušena: Luxusní péče",
    {
      bookingId: "clztestbookingadmincancelled",
      serviceName: "Luxusní péče",
      clientName: "Jana Nováková",
      clientEmail: "jana@example.com",
      scheduledStartsAt: "2026-04-20T08:00:00.000Z",
      scheduledEndsAt: "2026-04-20T09:00:00.000Z",
    },
  );

  assert.match(email.text, /Rezervace zrušena/);
  assert.match(email.text, /Služba: Luxusní péče/);
  assert.match(email.text, /Email: jana@example\.com/);
  assert.match(email.html, /Rezervace zrušena/);
  assert.doesNotMatch(email.html, /Napište nám/);
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
      cancellationUrl: "https://example.com/rezervace/storno/token-approved-cancel",
    },
  );

  assert.match(email.text, /byla potvrzena/i);
  assert.match(email.text, /token-approved/);
  assert.match(email.text, /token-approved-cancel/);
  assert.match(email.text, /Služba: Luxusní péče/);
  assert.match(email.text, /Datum: .+/);
  assert.match(email.text, /Čas: \d{2}:\d{2} – \d{2}:\d{2}/);
  assert.match(email.text, /Místo:\nPP Studio\nSadová 2, 760 01 Zlín/);
  assert.match(email.text, /přiložené kalendářové události/i);
  assert.match(email.text, /Napište nám: info@ppstudio\.cz/);
  assert.match(email.text, /Zavolejte: \+420 732 856 036/);
  assert.match(email.html, /Rezervace byla potvrzena/);
  assert.match(email.html, /Vaše rezervace je potvrzená\. Níže najdete termín, místo a možnosti pro případnou změnu\./);
  assert.match(email.html, /Sadová 2, 760 01 Zlín/);
  assert.match(email.html, /Zobrazit na mapě/);
  assert.match(email.html, /Kontakt/);
  assert.match(email.html, /Správa rezervace/);
  assert.match(email.html, /Změnit termín/);
  assert.match(email.html, /Zrušit rezervaci/);
  assert.doesNotMatch(email.html, /background:#1f1714;color:#ffffff/);
  assert.ok(email.attachments);
  assert.equal(email.attachments.length, 1);
  assert.equal(email.attachments[0]?.filename, "pp-studio-rezervace.ics");
  assert.match(String(email.attachments[0]?.content ?? ""), /^BEGIN:VCALENDAR\r\n/);
});

test("renderEmailTemplate creates approved email for legacy payload without manageReservationUrl", async () => {
  const { renderEmailTemplate } = await loadRenderer();
  const email = await renderEmailTemplate(
    "booking-approved-v1",
    "Rezervace potvrzena: Luxusní péče",
    {
      bookingId: "clztestbookingapprovelegacy",
      serviceName: "Luxusní péče",
      clientName: "Jana Nováková",
      scheduledStartsAt: "2026-04-20T08:00:00.000Z",
      scheduledEndsAt: "2026-04-20T09:00:00.000Z",
    },
  );

  assert.match(email.text, /byla potvrzena/i);
  assert.doesNotMatch(email.text, /Změnit termín:/i);
  assert.doesNotMatch(email.text, /Zrušit rezervaci:/i);
  assert.doesNotMatch(email.html, /Změnit termín/);
  assert.doesNotMatch(email.html, /Zrušit rezervaci/);
  assert.ok(email.attachments);
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
  assert.match(email.text, /Zítra máte rezervaci v PP Studiu/);
  assert.match(email.text, /Připomínka vašeho zítřejšího termínu/i);
  assert.match(email.text, /Místo:\nPP Studio\nSadová 2, 760 01 Zlín/);
  assert.match(email.text, /Změnit termín/);
  assert.match(email.text, /Zrušit rezervaci/);
  assert.match(email.text, /Napište nám: info@ppstudio\.cz/);
  assert.match(email.text, /Zavolejte: \+420 732 856 036/);
  assert.match(email.html, /Zítra máte rezervaci v PP Studiu/);
  assert.match(email.html, /Potřebujete změnu\?/);
  assert.doesNotMatch(email.html, /Ozvat se studiu/);
  assert.equal(email.attachments, undefined);
});

test("renderEmailTemplate creates 24h reminder email for legacy payload without manageReservationUrl", async () => {
  const { renderEmailTemplate } = await loadRenderer();
  const email = await renderEmailTemplate(
    "booking-reminder-24h-v1",
    "Připomínka rezervace - zítra v PP Studio",
    {
      bookingId: "clztestbookingremindlegacy",
      serviceName: "Luxusní péče",
      clientName: "Jana Nováková",
      scheduledStartsAt: "2026-04-24T08:00:00.000Z",
      scheduledEndsAt: "2026-04-24T09:00:00.000Z",
      cancellationUrl: "https://example.com/rezervace/storno/token-reminder",
    },
  );

  assert.match(email.text, /Zítra máte rezervaci v PP Studiu/);
  assert.doesNotMatch(email.text, /Změnit termín:/i);
  assert.match(email.text, /Zrušit rezervaci:/i);
  assert.doesNotMatch(email.html, /Změnit termín/);
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
  assert.match(email.text, /Původně:/);
  assert.match(email.text, /Datum:/);
  assert.match(email.text, /Čas: \d{2}:\d{2} – \d{2}:\d{2}/);
  assert.match(email.text, /token-rescheduled-manage/);
  assert.match(email.text, /token-rescheduled/);
  assert.match(email.html, /Termín rezervace byl změněn/);
  assert.ok(email.attachments);
  assert.equal(email.attachments.length, 1);
});
