import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("Pushover dispatch isolates incidents, releases failed sends, protects diagnostics and handles DB outage", () => {
  // Samostatný runtime ověří zapnutý transport. HTTP i DB jsou vždy nahrazené;
  // node:test samotný záměrně veškeré produkční odesílání blokuje.
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  const output = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
    process.env.ADMIN_SESSION_SECRET = 'test-secret-value-with-at-least-32-chars';
    process.env.ADMIN_OWNER_EMAIL = 'owner@example.com';
    process.env.EMAIL_DELIVERY_MODE = 'log';
    process.env.NODE_ENV = 'development';
    process.env.PUSHOVER_ENABLED = 'true';
    process.env.PUSHOVER_APP_TOKEN = 'fake-token';
    process.env.PUSHOVER_EMERGENCY_USER_KEY = 'emergency-key';
    const { prisma } = await import('./src/lib/prisma.ts');
    const { sendOwnerPushover, sendOwnerSystemErrorPushover, sendOwnerBookingPushover, buildOwnerEmailFailurePushover } = await import('./src/lib/notifications/pushover-core.ts');
    const settings = { pushoverUserKey: 'owner-key', notifyEmailFailed: true, notifySystemErrors: true, notifyNewBooking: true };
    prisma.adminUser.findMany = async (query) => {
      assert.equal(query.where.role, 'OWNER');
      assert.equal(query.where.isActive, true);
      assert.equal(query.where.notificationSettings.is.pushoverEnabled, true);
      return [{ id: 'owner-1', notificationSettings: settings }];
    };
    const sent = [];
    let fail = false;
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://api.pushover.net/1/messages.json');
      assert.ok(init.signal);
      if (fail) throw new Error('fake transport failure');
      sent.push(Object.fromEntries(init.body));
      return new Response('{}', { status: 200 });
    };
    console.error = () => {};
    const input = { type: 'EMAIL_FAILED', title: 'Test', message: 'Test', context: { contextId: 'one' } };
    await Promise.all([sendOwnerPushover(input), sendOwnerPushover(input)]);
    assert.equal(sent.length, 1);
    await sendOwnerPushover(input);
    assert.equal(sent.length, 1);
    fail = true;
    const retry = { ...input, context: { contextId: 'retry' } };
    await sendOwnerPushover(retry);
    fail = false;
    await sendOwnerPushover(retry);
    assert.equal(sent.length, 2);
    // Nesdílet cooldown různých e-mailů ani různých incidentů téhož e-mailu.
    for (const [emailLogId, emailType] of [['a', 'email.bounced'], ['b', 'email.bounced'], ['a', 'email.complained']]) {
      await sendOwnerPushover(buildOwnerEmailFailurePushover({ emailLogId, bookingId: 'same-booking', emailType, isReminder: false, failureKind: 'provider-delivery' }));
    }
    assert.equal(sent.length, 5);
    await sendOwnerSystemErrorPushover({ title: 'Chyba', message: 'Operace selhala.', error: new Error('secret@example.com token=secret'), context: { contextId: 'system' } });
    assert.equal(sent.at(-1).message, 'Operace selhala.');
    prisma.booking.findUnique = async () => ({ id: 'booking', clientId: 'client', serviceNameSnapshot: 'Služba', scheduledStartsAt: new Date('2026-11-03T10:00:00Z'), scheduledEndsAt: new Date('2026-11-03T11:00:00Z'), source: 'WEB' });
    prisma.booking.count = async (query) => {
      assert.equal(query.where.status, 'COMPLETED');
      assert.equal(query.where.scheduledEndsAt.lt.toISOString(), '2026-11-03T10:00:00.000Z');
      return 1;
    };
    await sendOwnerBookingPushover({ type: 'NEW_BOOKING', bookingId: 'booking' });
    assert.match(sent.at(-1).message, /Vracejici se klientka/);
    assert.match(sent.at(-1).message, /11:00/);
    prisma.adminUser.findMany = async () => { throw new Error('DB unavailable'); };
    await sendOwnerSystemErrorPushover({ title: 'DB', message: 'Databáze není dostupná.', context: { contextId: 'outage' } });
    assert.equal(sent.at(-1).user, 'emergency-key');
    const count = sent.length;
    await sendOwnerSystemErrorPushover({ title: 'DB', message: 'Databáze není dostupná.', context: { contextId: 'outage' } });
    await sendOwnerPushover({ ...input, context: { contextId: 'no-fallback-for-email' } });
    assert.equal(sent.length, count);
    console.log('verified');
  `], { env: childEnv, encoding: "utf8", timeout: 20_000 });
  assert.match(output, /verified/);
});
