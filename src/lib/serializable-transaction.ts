import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import {
  TransientTransactionConflictError,
  type TransientTransactionConflictKind,
} from "@/lib/transient-transaction-conflict";

export {
  TransientTransactionConflictError,
  type TransientTransactionConflictKind,
} from "@/lib/transient-transaction-conflict";

export const SERIALIZABLE_TRANSACTION_MAX_RETRIES = 4;
export const TRANSIENT_RETRY_MAX_DELAY_MS = 500;
const TRANSIENT_RETRY_BASE_DELAY_MS = 50;

export function getTransientTransactionConflictKind(error: unknown): TransientTransactionConflictKind | null {
  if (error instanceof TransientTransactionConflictError) {
    return error.kind;
  }

  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? (error as { cause?: unknown }).cause
      : null;

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    return "serialization_failure";
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2010"
    && /Code: [`'](?:40001|40P01)[`']/.test(error.message)
  ) {
    return error.message.includes("40P01") ? "deadlock" : "serialization_failure";
  }

  if (
    typeof error === "object"
    && error !== null
    && "name" in error
    && error.name === "DriverAdapterError"
    && typeof cause === "object"
    && cause !== null
    && "kind" in cause
    && cause.kind === "TransactionWriteConflict"
  ) {
    return "serialization_failure";
  }

  return null;
}

export function isTransientTransactionConflict(error: unknown) {
  return getTransientTransactionConflictKind(error) !== null;
}

export function getTransientRetryDelayMs(retryNumber: number, randomValue = Math.random()) {
  const baseDelay = Math.min(
    TRANSIENT_RETRY_MAX_DELAY_MS,
    TRANSIENT_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, retryNumber - 1),
  );
  const jitterLimit = Math.max(0, TRANSIENT_RETRY_MAX_DELAY_MS - baseDelay);
  const jitter = Math.floor(Math.max(0, Math.min(0.999999, randomValue)) * jitterLimit);

  return Math.min(TRANSIENT_RETRY_MAX_DELAY_MS, baseDelay + jitter);
}

export function waitForTransientRetry(retryNumber: number) {
  const delayMs = getTransientRetryDelayMs(retryNumber);

  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/** Opakuje pouze potvrzené transientní databázové konflikty; ostatní chyby propouští beze změny. */
export async function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: {
    onRetry?: (retryNumber: number, error: unknown) => void;
    maxRetries?: number;
  } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? SERIALIZABLE_TRANSACTION_MAX_RETRIES;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isTransientTransactionConflict(error) || attempt >= maxRetries) {
        throw error;
      }

      options.onRetry?.(attempt + 1, error);
      await waitForTransientRetry(attempt + 1);
    }
  }
}
