import assert from "node:assert/strict";
import test from "node:test";

import { isRetryablePrismaError } from "./booking-public/shared";

test("isRetryablePrismaError treats Prisma PG adapter transaction conflicts as retryable", () => {
  const error = {
    name: "DriverAdapterError",
    cause: {
      kind: "TransactionWriteConflict",
    },
  };

  assert.equal(isRetryablePrismaError(error), true);
});

test("isRetryablePrismaError does not retry unrelated driver adapter errors", () => {
  const error = {
    name: "DriverAdapterError",
    cause: {
      kind: "UniqueConstraintViolation",
    },
  };

  assert.equal(isRetryablePrismaError(error), false);
});
