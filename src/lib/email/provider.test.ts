import test from "node:test";
import assert from "node:assert/strict";

async function loadProvider() {
  process.env.NEXT_PUBLIC_APP_NAME = "PP Studio";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
  process.env.ADMIN_SESSION_SECRET = "test-secret-value-with-at-least-32-chars";
  process.env.ADMIN_OWNER_EMAIL = "owner@example.com";
  process.env.ADMIN_OWNER_PASSWORD = "change-me-owner";
  process.env.ADMIN_STAFF_EMAIL = "staff@example.com";
  process.env.ADMIN_STAFF_PASSWORD = "change-me-staff";
  process.env.EMAIL_DELIVERY_MODE = "log";

  return import("@/lib/email/provider");
}

test("SMTP secure mode auto-detects implicit TLS ports", async () => {
  const { resolveSmtpSecureMode } = await loadProvider();

  assert.equal(resolveSmtpSecureMode(465, "auto"), true);
  assert.equal(resolveSmtpSecureMode(2465, "auto"), true);
});

test("SMTP secure mode auto-detects STARTTLS ports", async () => {
  const { resolveSmtpSecureMode } = await loadProvider();

  assert.equal(resolveSmtpSecureMode(587, "auto"), false);
  assert.equal(resolveSmtpSecureMode(2587, "auto"), false);
});

test("SMTP secure mode still respects explicit overrides", async () => {
  const { resolveSmtpSecureMode } = await loadProvider();

  assert.equal(resolveSmtpSecureMode(587, "true"), true);
  assert.equal(resolveSmtpSecureMode(465, "false"), false);
});

test("sendEmail in log mode accepts attachments", async () => {
  const { sendEmail } = await loadProvider();

  const result = await sendEmail({
    to: "jana@example.com",
    subject: "Test",
    text: "Hello",
    html: "<p>Hello</p>",
    attachments: [
      {
        filename: "pp-studio-rezervace.ics",
        content: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
        contentType: "text/calendar; charset=utf-8",
      },
    ],
  });

  assert.equal(result.provider, "log");
  assert.match(result.messageId ?? "", /^log-/);
});
