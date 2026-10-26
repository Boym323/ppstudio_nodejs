import assert from "node:assert/strict";
import test from "node:test";

import { BookingActionTokenType, BookingStatus } from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("public cancellation state allows eligible bookings and blocks used vouchers", async (t) => {
  const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = {
    id: "token-1",
    bookingId: "booking-1",
    type: BookingActionTokenType.CANCEL,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    usedAt: null,
    revokedAt: null,
    booking: {
      id: "booking-1",
      status: BookingStatus.CONFIRMED,
      cancelledAt: null,
      manualOverride: false,
      clientId: "client-1",
      slotId: "slot-1",
      serviceId: "service-1",
      clientEmailSnapshot: "client@example.com",
      communicationGeneration: 0,
      clientNameSnapshot: "Test Klientka",
      serviceNameSnapshot: "Testovací služba",
      scheduledStartsAt: startsAt,
      scheduledEndsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
      blockedUntil: null,
      originalAvailabilityEndsAt: null,
      clientDeliveryLeaseToken: null,
      clientDeliveryLeaseExpiresAt: null,
      voucherRedemptions: [] as Array<{ id: string }>,
    },
  };

  t.mock.module("@/features/booking/lib/booking-action-tokens", {
    exports: { hashBookingActionToken: () => "token-hash" },
  });
  t.mock.module("@/features/booking/lib/booking-slot-compaction", {
    exports: {
      archiveDraftBookingSlotAfterCancellation: async () => undefined,
      restoreArchivedBookingServiceSlotAfterCancellation: async () => undefined,
    },
  });
  t.mock.module("@/lib/email/delivery", {
    exports: {
      claimEmailLogForImmediateDelivery: async () => "processing-token",
      deliverEmailLog: async () => ({ status: "sent" }),
    },
  });
  t.mock.module("@/lib/notifications/pushover", {
    exports: { sendOwnerBookingPushover: async () => undefined },
  });
  t.mock.module("@/lib/prisma", {
    exports: { prisma: { bookingActionToken: { findUnique: async () => token } } },
  });
  t.mock.module("@/lib/site-settings", {
    exports: {
      canClientCancelBooking: (scheduledStartsAt: Date, now: Date, cancellationHours: number) =>
        scheduledStartsAt.getTime() - now.getTime() > cancellationHours * 60 * 60 * 1000,
      getBookingPolicySettings: async () => ({ cancellationHours: 24 }),
      getEmailBrandingSettings: async () => ({}),
    },
  });

  const { getPublicCancellationPageState } = await import("./booking-cancellation");
  const ready = await getPublicCancellationPageState("raw-token");
  assert.equal(ready.status, "ready");
  assert.equal(ready.serviceName, "Testovací služba");
  assert.equal(ready.clientName, "Test Klientka");

  token.booking.voucherRedemptions.push({ id: "redemption-1" });
  const protectedByVoucher = await getPublicCancellationPageState("raw-token");
  assert.equal(protectedByVoucher.status, "not_cancellable");
  assert.match(protectedByVoucher.message, /voucherové čerpání/);
});
