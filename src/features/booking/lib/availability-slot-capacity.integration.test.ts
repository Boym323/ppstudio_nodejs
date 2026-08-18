import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";

import { AvailabilitySlotStatus } from "@/generated/prisma/browser";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("AvailabilitySlot database rejects a capacity other than one", async () => {
  const { prisma } = await import("@/lib/prisma");

  await assert.rejects(
    prisma.availabilitySlot.create({
      data: {
        startsAt: new Date("2031-01-01T09:00:00.000Z"),
        endsAt: new Date("2031-01-01T09:30:00.000Z"),
        capacity: 2,
        status: AvailabilitySlotStatus.ARCHIVED,
      },
    }),
  );
});
