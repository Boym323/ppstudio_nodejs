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
    cleanupBlocks: [{
      startMinutes: 375,
      endMinutes: 390,
    }],
    availableBlocks: [],
    lockedBlocks: [],
    inactiveBlocks: [],
    bookings: [
      {
        id: "booking-1",
        slotId: "slot-1",
        startCell: 11,
        endCell: 15,
        serviceStartMinutes: 345,
        serviceEndMinutes: 375,
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

test("DayInspector keeps service time primary and hides duplicate cleanup end metadata", () => {
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
      legend: [{ tone: "booked", label: "Rezervace" }],
      selection,
      hasUnsavedChanges: false,
      onApplySelection: () => {},
      pending: false,
    }),
  );

  assert.match(html, /11:45 - 13:15/);
  assert.match(html, /Blok v mřížce: 11:30 - 13:30/);
  assert.doesNotMatch(html, /Úklidová blokace do: 13:30/);
  assert.match(html, /úklid/);
  assert.doesNotMatch(html, /Akce dne/);
  assert.doesNotMatch(html, /Označit den jako zavřeno/);
  assert.doesNotMatch(html, /Obnovit den z publikovaného stavu/);
  assert.doesNotMatch(html, /Kopírovat rozvrh z jiného dne/);
  assert.doesNotMatch(html, /Vymazat dostupnost/);
});

test("GridCell renders cleanup as top/bottom/full yellow overlay while keeping 30min cell", () => {
  const topCleanup = renderToStaticMarkup(
    React.createElement(GridCell, {
      tone: "booked",
      topTone: "cleanup",
      bottomTone: "booked",
      selected: false,
      hourBoundary: false,
      label: "Test",
      dayKey: "2026-05-26",
      cellIndex: 11,
      onPointerDown: () => {},
      onPointerMove: () => {},
    }),
  );

  const bottomCleanup = renderToStaticMarkup(
    React.createElement(GridCell, {
      tone: "available",
      topTone: "available",
      bottomTone: "cleanup",
      selected: false,
      hourBoundary: false,
      label: "Test",
      dayKey: "2026-05-26",
      cellIndex: 12,
      onPointerDown: () => {},
      onPointerMove: () => {},
    }),
  );

  const fullCleanup = renderToStaticMarkup(
    React.createElement(GridCell, {
      tone: "locked",
      topTone: "cleanup",
      bottomTone: "cleanup",
      selected: false,
      hourBoundary: false,
      label: "Test",
      dayKey: "2026-05-26",
      cellIndex: 11,
      onPointerDown: () => {},
      onPointerMove: () => {},
    }),
  );

  const noCleanup = renderToStaticMarkup(
    React.createElement(GridCell, {
      tone: "locked",
      topTone: "empty",
      bottomTone: "empty",
      selected: false,
      hourBoundary: false,
      label: "Test",
      dayKey: "2026-05-26",
      cellIndex: 12,
      onPointerDown: () => {},
      onPointerMove: () => {},
    }),
  );

  assert.match(topCleanup, /top-0 h-1\/2 bg-amber-200\/78/);
  assert.match(bottomCleanup, /bottom-0 h-1\/2 bg-amber-200\/78/);
  assert.match(fullCleanup, /absolute inset-0 bg-amber-200\/78/);
  assert.doesNotMatch(noCleanup, /bg-amber-200\/78/);
});
