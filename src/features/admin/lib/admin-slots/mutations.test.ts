import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

test("planner odmítne mutation s weekKey, který není pondělí", async () => {
  const [{ ensureValidPlannerWeekDate }, { PlannerMutationError }] = await Promise.all([
    import("./mutations"),
    import("./types"),
  ]);

  assert.throws(
    () => ensureValidPlannerWeekDate("2026-03-05", "2026-03-05"),
    PlannerMutationError,
  );
});

test("planner rozpozná PostgreSQL exclusion conflict 23P01", async () => {
  const [{ Prisma }, { isPlannerExclusionConstraintError }] = await Promise.all([
    import("@/generated/prisma/client"),
    import("./mutations"),
  ]);
  const error = new Prisma.PrismaClientKnownRequestError(
    "Raw query failed. Code: `23P01`. Message: exclusion_violation",
    { code: "P2004", clientVersion: "test" },
  );

  assert.equal(isPlannerExclusionConstraintError(error), true);
  assert.equal(isPlannerExclusionConstraintError(new Error("23P01")), false);
});
