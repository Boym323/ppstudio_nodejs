import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { BookingStatus } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";

import type { PlannerDay } from "@/features/admin/lib/admin-slots";

import { DayInspector, GridCell, type PlannerSelection } from "./admin-weekly-planner-ui";

function buildEmptyCells() {
  return Array.from({ length: 28 }, () => false);
}

function createPlannerDayWithCleanupBooking(): PlannerDay {
  const booked = buildEmptyCells();
  const bookedCleanup = buildEmptyCells();
  const completed = buildEmptyCells();

  for (let cell = 11; cell < 15; cell += 1) {
    booked[cell] = true;
  }
  bookedCleanup[14] = true;

  return {
    dateKey: "2026-05-26",
    isoDate: "2026-05-26T00:00:00.000Z",
    label: "úterý 26. května",
    shortLabel: "út",
    dayNumber: "26",
    monthLabel: "5.",
    monthDayLabel: "26. 5.",
    isToday: false,
    isPast: false,
    availableIntervals: [],
    lockedIntervals: [],
    bookings: [
      {
        id: "booking-1",
        slotId: "slot-1",
        startCell: 11,
        endCell: 15,
        label: "11:45 - 13:15",
        blockedLabel: "11:30 - 13:30",
        cleanupBlockedUntilLabel: "13:30",
        hasCleanupBlock: true,
        clientName: "Test klientka",
        serviceName: "Refresh treatment",
        status: BookingStatus.CONFIRMED,
      },
    ],
    intervals: [
      {
        id: "interval-1",
        startCell: 11,
        endCell: 15,
        label: "11:30 - 13:30",
        status: "booked",
        bookingCount: 1,
        canEdit: false,
        detail: "1 rezervace",
      },
    ],
    cells: {
      available: buildEmptyCells(),
      booked,
      bookedCleanup,
      completed,
      inactive: buildEmptyCells(),
      locked: buildEmptyCells(),
      past: buildEmptyCells(),
    },
    summary: {
      availableLabel: "Bez volné dostupnosti",
      bookingLabel: "1 rezervace",
      note: "Den obsahuje rezervaci.",
    },
  };
}

test("DayInspector shows service time as primary and internal cleanup block as secondary metadata", () => {
  const day = createPlannerDayWithCleanupBooking();
  const selection: PlannerSelection = {
    dateKey: day.dateKey,
    startCell: 11,
    endCell: 15,
    tone: "booked",
    editable: false,
    bookingStatus: BookingStatus.CONFIRMED,
  };

  const html = renderToStaticMarkup(
    React.createElement(DayInspector, {
      day,
      days: [day],
      legend: [{ tone: "booked", label: "Rezervace" }],
      selection,
      copyTargetKey: "",
      hasUnsavedChanges: false,
      onCopyTargetChange: () => {},
      onCopyDay: () => {},
      onClearDay: () => {},
      onApplySelection: () => {},
      onResetDay: () => {},
      pending: false,
    }),
  );

  assert.match(html, /11:45 - 13:15/);
  assert.match(html, /Blok v mřížce: 11:30 - 13:30/);
  assert.match(html, /Úklidová blokace do: 13:30/);
  assert.match(html, /úklid/);
});

test("GridCell adds cleanup hint stripe only for booked/completed cells with cleanup flag", () => {
  const withHint = renderToStaticMarkup(
    React.createElement(GridCell, {
      tone: "booked",
      hasCleanupHint: true,
      selected: false,
      hourBoundary: false,
      label: "Test",
      dayKey: "2026-05-26",
      cellIndex: 11,
      onPointerDown: () => {},
      onPointerMove: () => {},
    }),
  );

  const withoutHint = renderToStaticMarkup(
    React.createElement(GridCell, {
      tone: "booked",
      hasCleanupHint: false,
      selected: false,
      hourBoundary: false,
      label: "Test",
      dayKey: "2026-05-26",
      cellIndex: 11,
      onPointerDown: () => {},
      onPointerMove: () => {},
    }),
  );

  assert.match(withHint, /after:w-1/);
  assert.doesNotMatch(withoutHint, /after:w-1/);
});
