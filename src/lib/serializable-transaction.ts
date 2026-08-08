import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 40;

function isSerializableConflict(error: unknown) {
  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? (error as { cause?: unknown }).cause
      : null;

  return (
    (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) ||
    (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "DriverAdapterError" &&
      typeof cause === "object" &&
      cause !== null &&
      "kind" in cause &&
      cause.kind === "TransactionWriteConflict"
    )
  );
}

function waitForRetry(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/** Opakuje pouze PostgreSQL serializační konflikty; ostatní chyby propouští beze změny. */
export async function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializableConflict(error) || attempt >= MAX_RETRIES) {
        throw error;
      }

      await waitForRetry(RETRY_DELAY_MS * (attempt + 1));
    }
  }
}
