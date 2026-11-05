import assert from "node:assert/strict";
import test from "node:test";

import { BOOKING_DRAFT_RESTORE_TIMEOUT_MS, BOOKING_DRAFT_TTL_MS, restoreBookingDraftCatalog, clearBookingDraft, readBookingDraft, saveBookingDraft } from "./booking-draft";

test("koncept obnoví pouze povolené údaje, expiruje a lze jej smazat po odeslání", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  } });
  try {
    const draft = { entryServiceSlug: "", serviceId: "service-1", timeOptionKey: "slot-1:2026-11-05T08:00:00.000Z", fullName: "Jana Nová", email: "jana@example.cz", phone: "777123456" };
    const withPrivateFields = { ...draft, clientNote: "Citlivá poznámka", voucherCode: "SECRET" };
    saveBookingDraft(withPrivateFields, 1000);
    assert.deepEqual(readBookingDraft(1001), draft);
    assert.doesNotMatch([...values.values()][0], /clientNote|voucherCode|Citlivá|SECRET/);
    assert.deepEqual(readBookingDraft(1000 + BOOKING_DRAFT_TTL_MS - 1), draft);
    assert.equal(readBookingDraft(1000 + BOOKING_DRAFT_TTL_MS), null);
    assert.equal(values.size, 0);

    saveBookingDraft(draft, 1000);
    clearBookingDraft();
    assert.equal(readBookingDraft(1001), null);

    for (const corrupt of ["{", "null", JSON.stringify({ ...draft, version: 2, savedAt: 1000 }), JSON.stringify({ ...draft, version: 1, savedAt: 2000 }), JSON.stringify({ ...draft, version: 1, savedAt: 1000, phone: {} })]) {
      saveBookingDraft(draft, 1000);
      const key = [...values.keys()][0];
      values.set(key, corrupt);
      assert.equal(readBookingDraft(1001), null);
      assert.equal(values.size, 0);
    }
    saveBookingDraft(draft, 1000);
    saveBookingDraft({ entryServiceSlug: "", serviceId: "", timeOptionKey: "", fullName: "", email: "", phone: "" }, 1001);
    assert.equal(values.size, 0);

    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("Storage blocked"); } });
    assert.equal(readBookingDraft(), null);
    assert.doesNotThrow(() => saveBookingDraft(draft));
    assert.doesNotThrow(() => clearBookingDraft());
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

for (const outcome of ["success", "timeout", "rejection", "late-success", "late-rejection", "unmount"] as const) {
  test(`obnova katalogu konceptu: ${outcome}`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let resolve!: (value: { catalog: string }) => void;
    let reject!: (error: Error) => void;
    const request = new Promise<{ catalog: string }>((yes, no) => { resolve = yes; reject = no; });
    const completions: Array<{ catalog: string } | null> = [];
    const cancel = restoreBookingDraftCatalog(() => request, (result) => completions.push(result));
    await flushPromises();
    if (outcome === "success") resolve({ catalog: "fresh" });
    if (outcome === "rejection") reject(new Error("offline"));
    if (outcome === "unmount") cancel();
    await flushPromises();
    if (outcome === "success") assert.deepEqual(completions, [{ catalog: "fresh" }]);
    if (outcome === "rejection") assert.deepEqual(completions, [null]);
    t.mock.timers.tick(BOOKING_DRAFT_RESTORE_TIMEOUT_MS - 1);
    if (outcome !== "success" && outcome !== "rejection") assert.deepEqual(completions, []);
    t.mock.timers.tick(1);
    const expected = outcome === "success" ? [{ catalog: "fresh" }] : outcome === "unmount" ? [] : [null];
    assert.deepEqual(completions, expected);
    // Fallback už odblokoval formulář. Pozdější výsledek nesmí spustit
    // opětovnou obnovu a přepsat nové kontakty, službu nebo termín.
    if (outcome === "late-success" || outcome === "unmount") resolve({ catalog: "late" });
    if (outcome === "late-rejection") reject(new Error("late offline"));
    await flushPromises();
    t.mock.timers.tick(BOOKING_DRAFT_RESTORE_TIMEOUT_MS);
    assert.deepEqual(completions, expected);
    cancel();
  });
}
