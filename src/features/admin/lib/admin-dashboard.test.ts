import assert from "node:assert/strict";
import test from "node:test";

import { BookingStatus } from "@/generated/prisma/browser";

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
          clientNote: null,
          internalNote: null,
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
          clientNote: null,
          internalNote: null,
        },
      ],
    },
  ]);
  const freeWindow = items.find((item) => item.kind === "free");

  assert.ok(freeWindow);
  assert.equal(freeWindow.sortTime, now.getTime());
});

test("buildTimelineItems does not expose cleanup time as a free window", async () => {
  const { buildTimelineItems } = await import("./admin-dashboard");
  const now = new Date("2026-04-30T08:00:00.000Z");
  const items = buildTimelineItems("owner", now, [
    {
      id: "slot-cleanup",
      startsAt: new Date("2026-04-30T08:00:00.000Z"),
      endsAt: new Date("2026-04-30T11:00:00.000Z"),
      capacity: 1,
      bookings: [
        {
          id: "booking-cleanup",
          scheduledStartsAt: new Date("2026-04-30T08:00:00.000Z"),
          scheduledEndsAt: new Date("2026-04-30T09:00:00.000Z"),
          blockedUntil: new Date("2026-04-30T09:30:00.000Z"),
          status: BookingStatus.CONFIRMED,
          serviceNameSnapshot: "Kosmetika",
          clientNameSnapshot: "Jana Novakova",
          clientNote: null,
          internalNote: null,
        },
      ],
    },
  ]);
  const freeWindow = items.find((item) => item.kind === "free");

  assert.ok(freeWindow);
  assert.equal(freeWindow.timeLabel, "11:30 - 13:00");
});

test("buildTimelineItems trims notes and uses salon admin routes", async () => {
  const { buildTimelineItems } = await import("./admin-dashboard");
  const now = new Date("2026-04-30T07:00:00.000Z");
  const items = buildTimelineItems("salon", now, [
    {
      id: "slot-2",
      startsAt: new Date("2026-04-30T08:00:00.000Z"),
      endsAt: new Date("2026-04-30T10:00:00.000Z"),
      capacity: 1,
      bookings: [
        {
          id: "booking-2",
          scheduledStartsAt: new Date("2026-04-30T08:15:00.000Z"),
          scheduledEndsAt: new Date("2026-04-30T09:00:00.000Z"),
          status: BookingStatus.PENDING,
          serviceNameSnapshot: "Barvení obočí",
          clientNameSnapshot: "Petra Svobodova",
          clientNote: "  Chci jemnější odstín.  ",
          internalNote: "  Připravit patch test historii. ",
        },
      ],
    },
  ]);

  const bookingItem = items.find((item) => item.kind === "booking");
  const freeWindow = items.find((item) => item.kind === "free");

  assert.ok(bookingItem);
  assert.equal(bookingItem.href, "/admin/provoz/rezervace/booking-2");
  assert.deepEqual(bookingItem.notes, [
    { label: "Klientka", value: "Chci jemnější odstín." },
    { label: "Interně", value: "Připravit patch test historii." },
  ]);

  assert.ok(freeWindow);
  assert.equal(freeWindow.editHref, "/admin/provoz/volne-terminy/slot-2/upravit");
});

test("buildUpcomingFreeWindows respects cleanup blocking and merges adjacent free slots", async () => {
  const { buildUpcomingFreeWindows } = await import("./admin-dashboard");
  const upcomingSlots = buildUpcomingFreeWindows(
    [
      {
        id: "slot-cleanup-overflow",
        startsAt: new Date("2026-07-02T11:30:00.000Z"),
        endsAt: new Date("2026-07-02T12:00:00.000Z"),
        capacity: 1,
      },
      {
        id: "slot-first-real-free",
        startsAt: new Date("2026-07-02T13:00:00.000Z"),
        endsAt: new Date("2026-07-02T13:45:00.000Z"),
        capacity: 1,
      },
      {
        id: "slot-following-free",
        startsAt: new Date("2026-07-02T13:45:00.000Z"),
        endsAt: new Date("2026-07-02T14:00:00.000Z"),
        capacity: 1,
      },
    ],
    [
      {
        scheduledStartsAt: new Date("2026-07-02T10:00:00.000Z"),
        scheduledEndsAt: new Date("2026-07-02T11:30:00.000Z"),
        blockedUntil: new Date("2026-07-02T12:00:00.000Z"),
      },
    ],
  );

  assert.deepEqual(
    upcomingSlots.map((slot) => ({
      id: slot.id,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    })),
    [{
      id: "slot-first-real-free-0",
      startsAt: "2026-07-02T13:00:00.000Z",
      endsAt: "2026-07-02T14:00:00.000Z",
    }],
  );
});

test("dashboard nabízí potvrzení a úhradu jen v povoleném stavu a zachová neuzavřené návštěvy", async (t) => {
  const { getAdminDashboardData } = await import("./admin-dashboard");
  const { prisma } = await import("@/lib/prisma");
  const now = Date.now();
  const booking = (id: string, status: BookingStatus, startMinutes: number, endMinutes: number) => ({
    id, status,
    scheduledStartsAt: new Date(now + startMinutes * 60_000),
    scheduledEndsAt: new Date(now + endMinutes * 60_000),
    serviceNameSnapshot: "Kosmetika", clientNameSnapshot: "Jana Nováková",
    clientPhoneSnapshot: "+420777123456", clientEmailSnapshot: "jana@example.com",
    clientNote: null, internalNote: null,
  });
  const bookings = [
    booking("completed", BookingStatus.COMPLETED, -180, -120),
    booking("overdue", BookingStatus.CONFIRMED, -100, -40),
    booking("current", BookingStatus.CONFIRMED, -10, 50),
    booking("pending", BookingStatus.PENDING, 60, 120),
    booking("future", BookingStatus.CONFIRMED, 130, 190),
  ];
  const originalBookingFindMany = prisma.booking.findMany;
  const originalBookingCount = prisma.booking.count;
  const originalEmailCount = prisma.emailLog.count;
  const originalSlotFindMany = prisma.availabilitySlot.findMany;
  const originalSlotCount = prisma.availabilitySlot.count;
  t.after(() => {
    prisma.booking.findMany = originalBookingFindMany;
    prisma.booking.count = originalBookingCount;
    prisma.emailLog.count = originalEmailCount;
    prisma.availabilitySlot.findMany = originalSlotFindMany;
    prisma.availabilitySlot.count = originalSlotCount;
  });
  prisma.booking.findMany = (async (args: { select: { id?: boolean } }) => args.select.id ? bookings : []) as unknown as typeof prisma.booking.findMany;
  prisma.booking.count = (async () => 1) as typeof prisma.booking.count;
  prisma.emailLog.count = (async () => 1) as typeof prisma.emailLog.count;
  prisma.availabilitySlot.findMany = (async () => []) as typeof prisma.availabilitySlot.findMany;
  prisma.availabilitySlot.count = (async () => 0) as typeof prisma.availabilitySlot.count;

  for (const area of ["owner", "salon"] as const) {
    const data = await getAdminDashboardData(area);
    assert.deepEqual(data.todayPlanItems.map(({ id, primaryAction, isCompleted }) => ({ id, primaryAction, isCompleted })), [
      { id: "completed", primaryAction: null, isCompleted: true },
      { id: "overdue", primaryAction: "COMPLETED", isCompleted: false },
      { id: "current", primaryAction: null, isCompleted: false },
      { id: "pending", primaryAction: "CONFIRMED", isCompleted: false },
      { id: "future", primaryAction: null, isCompleted: false },
    ]);
    const base = area === "owner" ? "/admin" : "/admin/provoz";
    assert.equal(data.todayPlanItems[1].href, `${base}/rezervace/overdue`);
    assert.equal(data.quickActions.find((item) => item.id === "vouchers")?.href, `${base}/vouchery/novy`);
    assert.equal(data.alerts.find((item) => item.id === "email-failures")?.href, `${base}/logy?view=attention&source=email`);
  }
});

test("rychlá akce odmítne neplatný vstup a bez přihlášení nečte rezervaci", async (t) => {
  const { getDashboardBookingAction } = await import("../actions/dashboard-booking-action");
  const { prisma } = await import("@/lib/prisma");
  const originalFindUnique = prisma.booking.findUnique;
  let reads = 0;
  t.after(() => { prisma.booking.findUnique = originalFindUnique; });
  prisma.booking.findUnique = (async () => { reads += 1; return null; }) as unknown as typeof prisma.booking.findUnique;

  for (const input of [
    { area: "owner", bookingId: "", action: "COMPLETED" },
    { area: "owner", bookingId: "booking", action: "CANCELLED" },
    { area: "invalid", bookingId: "booking", action: "CONFIRMED" },
  ]) {
    assert.equal(await getDashboardBookingAction(input as Parameters<typeof getDashboardBookingAction>[0]), null);
  }
  for (const area of ["owner", "salon"] as const) {
    await assert.rejects(() => getDashboardBookingAction({ area, bookingId: "booking", action: "COMPLETED" }));
  }
  assert.equal(reads, 0);
});
