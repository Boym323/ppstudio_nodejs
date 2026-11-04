import assert from "node:assert/strict";
import test from "node:test";

import { BOOKING_DRAFT_TTL_MS, clearBookingDraft, readBookingDraft, saveBookingDraft } from "./booking-draft";

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
