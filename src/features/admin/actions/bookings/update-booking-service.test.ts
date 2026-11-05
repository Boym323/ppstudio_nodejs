import assert from "node:assert/strict";
import test from "node:test";

test("náhled změny služby ověřuje oprávnění, rozlišuje výjimku a předává překážky bez ukládání", async (t) => {
  const calls: unknown[] = [];
  let authorized = true;
  let result: unknown;
  let update: (input: unknown) => Promise<unknown> = async () => assert.fail("Náhled nesmí ukládat změnu služby.");
  const revalidations: string[] = [];
  t.mock.module("next/cache", { exports: { revalidatePath: (path: string) => revalidations.push(path) } });
  t.mock.module("@/features/admin/lib/admin-booking", { exports: {
    previewAdminBookingServiceChange: async (input: unknown) => { calls.push(input); return result; },
    updateAdminBookingService: async (input: unknown) => update(input),
  } });
  t.mock.module("@/features/admin/actions/bookings/shared", { exports: {
    resolveBookingActorUserId: async () => {
      if (!authorized) throw new Error("Přístup odepřen.");
      return "actor";
    },
    readFormString: (form: FormData, key: string) => String(form.get(key) ?? ""),
    revalidateBookingAdminPaths: (bookingId: string) => revalidations.push(bookingId),
  } });
  const { previewBookingServiceChangeAction, updateBookingServiceAction } = await import("./update-booking-service");
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
  assert.equal(revalidations.length, 0);

  authorized = true;
  const updates: Array<{ notifyClient: boolean }> = [];
  update = async (value) => {
    const input = value as { notifyClient: boolean };
    updates.push(input);
    return {
      status: "success", clientId: "client", previousServiceName: "Původní", nextServiceName: "Nová",
      previousScheduledEndsAt: new Date("2026-11-13T14:00:00.000Z"), nextScheduledEndsAt: timing.nextScheduledEndsAt,
      previousCleanupBlockMinutes: 15, nextCleanupBlockMinutes: 30,
      keptFinalPriceCzk: null, createdManualOverride: false,
      notificationStatus: input.notifyClient ? "queued" : "skipped",
    };
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) form.set(key, value);
  form.set("notifyClient", "1");
  const notified = await updateBookingServiceAction({ status: "idle" }, form);
  assert.equal(notified.status, "success");
  assert.match(notified.successMessage ?? "", /zařazené k odeslání/);
  assert.equal(updates[0]?.notifyClient, true);
  form.delete("notifyClient");
  const silent = await updateBookingServiceAction({ status: "idle" }, form);
  assert.equal(silent.status, "success");
  assert.equal(updates[1]?.notifyClient, false);
  assert.doesNotMatch(silent.successMessage ?? "", /zařazené k odeslání/);
  update = async () => { throw new Error("queue failure"); };
  t.mock.method(console, "error", () => undefined);
  const failed = await updateBookingServiceAction({ status: "idle" }, form);
  assert.equal(failed.status, "error");
  assert.match(failed.formError ?? "", /Rezervace zůstala beze změny/);

});
