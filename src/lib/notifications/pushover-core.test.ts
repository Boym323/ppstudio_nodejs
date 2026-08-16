import assert from "node:assert/strict";
import test from "node:test";

function setPushoverTestEnvironment() {
  process.env.NEXT_PUBLIC_APP_NAME = "PP Studio";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
  process.env.ADMIN_SESSION_SECRET = "test-secret-value-with-at-least-32-chars";
  process.env.ADMIN_OWNER_EMAIL = "owner@example.com";
  process.env.EMAIL_DELIVERY_MODE = "log";
  process.env.PUSHOVER_ENABLED = "true";
  process.env.PUSHOVER_APP_TOKEN = "test-pushover-token";
}

test("test runtime blocks Pushover even when inherited configuration enables it", async () => {
  setPushoverTestEnvironment();

  const [{ prisma }, { sendOwnerSystemErrorPushover }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/notifications/pushover-core"),
  ]);
  const originalFindMany = prisma.adminUser.findMany;
  const originalFetch = globalThis.fetch;
  let databaseCalls = 0;
  let transportCalls = 0;

  prisma.adminUser.findMany = (async () => {
    databaseCalls += 1;
    return [];
  }) as typeof prisma.adminUser.findMany;
  globalThis.fetch = (async () => {
    transportCalls += 1;
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  try {
    await assert.doesNotReject(() => sendOwnerSystemErrorPushover({
      title: "Test fallbacku",
      message: "Owner alert nesmí rozbít původní fallback.",
      context: { contextId: "pushover-failure-isolation" },
    }));
    assert.equal(databaseCalls, 0);
    assert.equal(transportCalls, 0);
  } finally {
    prisma.adminUser.findMany = originalFindMany;
    globalThis.fetch = originalFetch;
  }
});

test("worker retry exhausted alert describes failed sending and keeps the booking link without PII", async () => {
  setPushoverTestEnvironment();
  const { buildOwnerEmailFailurePushover } = await import("@/lib/notifications/pushover-core");

  const alert = buildOwnerEmailFailurePushover({
    emailLogId: "email-log-1",
    bookingId: "booking-1",
    emailType: "BOOKING_CONFIRMATION",
    isReminder: false,
    failureKind: "transport",
  });

  assert.equal(alert.title, "PP Studio - chyba emailu");
  assert.equal(alert.message, "E-mail se nepodařilo odeslat ani po vyčerpání opakovaných pokusů.\nTyp: BOOKING_CONFIRMATION");
  assert.equal(alert.url, "https://example.com/admin/rezervace/booking-1");
  assert.equal(alert.priority, 1);
  assert.doesNotMatch(alert.message, /@|klient/i);
});

test("provider bounce alert describes subsequent non-delivery without retry claim and keeps the booking link", async () => {
  setPushoverTestEnvironment();
  const { buildOwnerEmailFailurePushover } = await import("@/lib/notifications/pushover-core");

  const alert = buildOwnerEmailFailurePushover({
    emailLogId: "email-log-2",
    bookingId: "booking-2",
    emailType: "email.bounced",
    isReminder: false,
    failureKind: "provider-delivery",
  });

  assert.equal(alert.title, "PP Studio - e-mail nedoručen");
  assert.equal(alert.message, "E-mail byl odeslán, ale následně se jej nepodařilo doručit příjemci.\nTyp: email.bounced");
  assert.equal(alert.url, "https://example.com/admin/rezervace/booking-2");
  assert.equal(alert.priority, 1);
  assert.doesNotMatch(alert.message, /vyčerpání|pokus|@|klient/i);
});

test("other provider delivery incidents keep their technical type and do not claim worker retry exhaustion", async () => {
  setPushoverTestEnvironment();
  const { buildOwnerEmailFailurePushover } = await import("@/lib/notifications/pushover-core");

  const alert = buildOwnerEmailFailurePushover({
    emailLogId: "email-log-3",
    emailType: "email.complained",
    isReminder: false,
    failureKind: "provider-delivery",
  });

  assert.equal(alert.title, "PP Studio - chyba emailu");
  assert.equal(alert.message, "E-mail byl odeslán a příjemce jej následně označil jako spam.\nTyp: email.complained");
  assert.equal(alert.url, "https://example.com/admin/email-logy/email-log-3");
  assert.equal(alert.priority, 1);
  assert.doesNotMatch(alert.message, /vyčerpání|pokus|@|klient/i);
});
