import assert from "node:assert/strict";
import test from "node:test";

import { BookingActorType, BookingSource, BookingStatus } from "@prisma/client";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

function buildBaseInput() {
  return {
    serviceId: "service-1",
    slotId: "slot-1",
    startsAt: "2026-06-10T09:00:00.000Z",
    client: {
      fullName: "Test Klientka",
      email: "client@example.com",
      phone: "+420777111222",
    },
    source: BookingSource.WEB,
    status: BookingStatus.PENDING,
    isManual: false,
    allowManualOverride: false,
    actorType: BookingActorType.CLIENT,
    historyReason: "Test",
    sendClientEmail: false,
    includeCalendarAttachment: false,
    sendAdminNotification: false,
  } as const;
}

test("createBookingWithEngine rejects invalid startsAt before transaction", async () => {
  const { createBookingWithEngine } = await import("@/features/booking/lib/booking-public/engine");
  const { PublicBookingError, publicBookingErrorCodes } = await import("@/features/booking/lib/booking-public/shared");

  const input = {
    ...buildBaseInput(),
    startsAt: "not-a-date",
  };

  await assert.rejects(
    createBookingWithEngine(input),
    (error: unknown) => {
      assert.ok(error instanceof PublicBookingError);
      assert.equal(error.code, publicBookingErrorCodes.slotUnavailable);
      assert.equal(error.suggestedStep, 2);
      return true;
    },
  );
});

test("createBookingWithEngine rejects invalid client phone format before transaction", async () => {
  const { createBookingWithEngine } = await import("@/features/booking/lib/booking-public/engine");
  const { PublicBookingError, publicBookingErrorCodes } = await import("@/features/booking/lib/booking-public/shared");

  const input = {
    ...buildBaseInput(),
    client: {
      ...buildBaseInput().client,
      phone: "n/a",
    },
  };

  await assert.rejects(
    createBookingWithEngine(input),
    (error: unknown) => {
      assert.ok(error instanceof PublicBookingError);
      assert.equal(error.code, publicBookingErrorCodes.bookingConflict);
      assert.equal(error.suggestedStep, 3);
      return true;
    },
  );
});
