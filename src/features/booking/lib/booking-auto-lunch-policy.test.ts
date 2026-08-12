import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

async function load() {
  return import("./booking-auto-lunch-policy");
}

function reader(input: { enabled?: boolean | null; offDates?: string[] } = {}) {
  return {
    siteSettings: {
      findUnique: async () => input.enabled === null ? null : { autoLunchEnabled: input.enabled ?? true },
    },
    autoLunchDayOverride: {
      findMany: async ({ where }: { where: { dateKey: { in: string[] } } }) =>
        (input.offDates ?? []).filter((dateKey) => where.dateKey.in.includes(dateKey)).map((dateKey) => ({ dateKey })),
    },
  };
}

test("policy snapshot zachová výchozí enabled a absence override znamená AUTO", async () => {
  const { loadAutoLunchPolicySnapshot } = await load();
  const snapshot = await loadAutoLunchPolicySnapshot(reader({ enabled: null }) as never, ["2026-07-15"]);
  assert.equal(snapshot.globalAutoLunchEnabled, true);
  assert.deepEqual(snapshot.dayLunchModes, {});
});

test("policy snapshot načte globální ON/OFF i pouze požadované denní OFF override", async () => {
  const { loadAutoLunchPolicySnapshot } = await load();
  const off = await loadAutoLunchPolicySnapshot(reader({ enabled: false, offDates: ["2026-07-15", "2026-07-16"] }) as never, ["2026-07-15"]);
  assert.equal(off.globalAutoLunchEnabled, false);
  assert.deepEqual(off.dayLunchModes, { "2026-07-15": "OFF" });

  const on = await loadAutoLunchPolicySnapshot(reader({ enabled: true, offDates: ["2026-01-15"] }) as never, ["2026-01-15"]);
  assert.equal(on.globalAutoLunchEnabled, true);
  assert.deepEqual(on.dayLunchModes, { "2026-01-15": "OFF" });
});

test("policy snapshot používá lokální dateKey beze změny v létě, zimě i kolem DST", async () => {
  const { loadAutoLunchPolicySnapshot } = await load();
  const dates = ["2026-01-15", "2026-07-15", "2026-03-29"];
  const snapshot = await loadAutoLunchPolicySnapshot(reader({ offDates: dates }) as never, dates);
  assert.deepEqual(snapshot.dayLunchModes, Object.fromEntries(dates.map((date) => [date, "OFF"])));
});
