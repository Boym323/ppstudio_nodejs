import assert from "node:assert/strict";
import test from "node:test";

import { intervalToPlannerCells } from "./helpers";

test("intervalToPlannerCells cover mode blocks every touched half-hour cell", () => {
  const cells = intervalToPlannerCells(
    {
      startsAt: new Date("2026-05-26T09:45:00.000Z"),
      endsAt: new Date("2026-05-26T11:30:00.000Z"),
    },
    "cover",
  );

  assert.deepEqual(cells, {
    startCell: 11,
    endCell: 15,
  });
});

test("intervalToPlannerCells inside mode keeps only fully free half-hour cells", () => {
  const cells = intervalToPlannerCells(
    {
      startsAt: new Date("2026-05-26T11:15:00.000Z"),
      endsAt: new Date("2026-05-26T14:00:00.000Z"),
    },
    "inside",
  );

  assert.deepEqual(cells, {
    startCell: 15,
    endCell: 20,
  });
});

test("inside mode drops quarter-hour remainder that does not fit full half-hour cell", () => {
  const cells = intervalToPlannerCells(
    {
      startsAt: new Date("2026-05-26T09:30:00.000Z"),
      endsAt: new Date("2026-05-26T09:45:00.000Z"),
    },
    "inside",
  );

  assert.deepEqual(cells, {
    startCell: 11,
    endCell: 11,
  });
});
