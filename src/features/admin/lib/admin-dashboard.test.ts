import assert from "node:assert/strict";
import test from "node:test";

import { BookingStatus } from "@prisma/client";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??=
  "test-admin-session-secret-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "password123";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "password123";

test("buildTimelineItems keeps completed bookings visible and does not create past free windows", async () => {
  const { buildTimelineItems } = await import("./admin-dashboard");
  const now = new Date("2026-04-30T11:10:00.000Z");
  const items = buildTimelineItems("owner", now, [
    {
      id: "slot-1",
      startsAt: new Date("2026-04-30T10:00:00.000Z"),
      endsAt: new Date("2026-04-30T11:00:00.000Z"),
      capacity: 1,
      bookings: [
        {
          id: "booking-1",
          scheduledStartsAt: new Date("2026-04-30T10:00:00.000Z"),
          scheduledEndsAt: new Date("2026-04-30T11:00:00.000Z"),
          status: BookingStatus.COMPLETED,
          serviceNameSnapshot: "Kosmetika",
          clientNameSnapshot: "Jana Novakova",
        },
      ],
    },
  ]);

  const firstItem = items[0];

  assert.equal(items.length, 1);
  assert.ok(firstItem);
  assert.equal(firstItem.kind, "booking");
  assert.equal(firstItem.bookingStatus, BookingStatus.COMPLETED);
});

test("buildTimelineItems clamps future free windows to now after completed bookings", async () => {
  const { buildTimelineItems } = await import("./admin-dashboard");
  const now = new Date("2026-04-30T11:10:00.000Z");
  const items = buildTimelineItems("owner", now, [
    {
      id: "slot-1",
      startsAt: new Date("2026-04-30T10:00:00.000Z"),
      endsAt: new Date("2026-04-30T12:00:00.000Z"),
      capacity: 1,
      bookings: [
        {
          id: "booking-1",
          scheduledStartsAt: new Date("2026-04-30T10:00:00.000Z"),
          scheduledEndsAt: new Date("2026-04-30T11:00:00.000Z"),
          status: BookingStatus.COMPLETED,
          serviceNameSnapshot: "Kosmetika",
          clientNameSnapshot: "Jana Novakova",
        },
      ],
    },
  ]);
  const freeWindow = items.find((item) => item.kind === "free");

  assert.ok(freeWindow);
  assert.equal(freeWindow.sortTime, now.getTime());
});
