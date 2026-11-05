import assert from "node:assert/strict";
import test from "node:test";

test("náhled změny služby ověřuje oprávnění, rozlišuje výjimku a předává překážky bez ukládání", async (t) => {
  const calls: unknown[] = [];
  let authorized = true;
  let result: unknown;
  t.mock.module("next/cache", { exports: { revalidatePath: () => assert.fail("Náhled nerevaliduje stránky.") } });
  t.mock.module("@/features/admin/lib/admin-booking", { exports: {
    previewAdminBookingServiceChange: async (input: unknown) => { calls.push(input); return result; },
    updateAdminBookingService: async () => assert.fail("Náhled nesmí ukládat změnu služby."),
  } });
  t.mock.module("@/features/admin/actions/bookings/shared", { exports: {
    resolveBookingActorUserId: async () => {
      if (!authorized) throw new Error("Přístup odepřen.");
      return "actor";
    },
    readFormString: () => assert.fail("Náhled nepoužívá odeslaný formulář."),
    revalidateBookingAdminPaths: () => assert.fail("Náhled nerevaliduje stránky."),
  } });
  const { previewBookingServiceChangeAction } = await import("./update-booking-service");
  const input = { area: "owner" as const, bookingId: "booking", serviceId: "service", expectedUpdatedAt: "2026-11-04T12:00:00.000Z" };
  const timing = { nextScheduledEndsAt: new Date("2026-11-13T14:40:00.000Z"), nextBlockedUntil: new Date("2026-11-13T15:10:00.000Z"), nextCleanupBlockMinutes: 30 };

  for (const createdManualOverride of [false, true]) {
    result = { status: "success", createdManualOverride, ...timing };
    const preview = await previewBookingServiceChangeAction(input);
    assert.equal(preview.status, createdManualOverride ? "requires-override" : "ready");
    assert.equal(preview.serviceEndsAt, timing.nextScheduledEndsAt.toISOString());
    assert.equal(preview.blockedUntil, timing.nextBlockedUntil.toISOString());
    assert.equal(preview.cleanupBlockMinutes, 30);
    if (createdManualOverride) assert.match(preview.message, /není souvisle vypsaná dostupnost/);
  }
  assert.deepEqual(calls[0], { bookingId: "booking", serviceId: "service", expectedUpdatedAt: input.expectedUpdatedAt, actorUserId: "actor" });

  result = { status: "conflict", message: "Kolize s návštěvou ve 14:30." };
  assert.deepEqual(await previewBookingServiceChangeAction({ ...input, area: "salon" }), { status: "blocked", message: "Kolize s návštěvou ve 14:30." });
  result = { status: "slot-too-short", reason: "service-restriction", message: "Služba zde není povolená." };
  assert.deepEqual(await previewBookingServiceChangeAction(input), { status: "blocked", message: "Služba zde není povolená." });

  const callsBeforeInvalidInput = calls.length;
  assert.equal((await previewBookingServiceChangeAction({ ...input, serviceId: "" })).status, "blocked");
  assert.equal(calls.length, callsBeforeInvalidInput);
  authorized = false;
  await assert.rejects(previewBookingServiceChangeAction(input), /Přístup odepřen/);
  assert.equal(calls.length, callsBeforeInvalidInput);
});
