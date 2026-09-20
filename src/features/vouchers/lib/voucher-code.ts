import { randomInt } from "node:crypto";

import { Prisma, type Prisma as PrismaNamespace } from "@/generated/prisma/client";
import { getVoucherPragueCalendarYear } from "@/features/vouchers/lib/voucher-validity-date";
import { TransientTransactionConflictError } from "@/lib/transient-transaction-conflict";

const VOUCHER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const VOUCHER_CODE_RANDOM_LENGTH = 6;
const MAX_GENERATION_ATTEMPTS = 50;
const VOUCHER_CODE_ALLOCATION_LOCK = "ppstudio:voucher-code-allocation-v1";

export function normalizeVoucherCode(input: string): string {
  return input
    .trim()
    .replace(/[\u2010-\u2015\u2212]+/g, "-")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function buildVoucherCode(year: number): string {
  let suffix = "";

  for (let index = 0; index < VOUCHER_CODE_RANDOM_LENGTH; index += 1) {
    suffix += VOUCHER_CODE_ALPHABET[randomInt(0, VOUCHER_CODE_ALPHABET.length)];
  }

  return `PP-${year}-${suffix}`;
}

async function lockVoucherCodeAllocation(
  tx: PrismaNamespace.TransactionClient,
  failFast: boolean,
) {
  if (!failFast) {
    await tx.$executeRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtext(${VOUCHER_CODE_ALLOCATION_LOCK}))
    `);
    return;
  }

  const rows = await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
    SELECT pg_try_advisory_xact_lock(hashtext(${VOUCHER_CODE_ALLOCATION_LOCK})) AS "locked"
  `);

  if (!rows[0]?.locked) {
    throw new TransientTransactionConflictError(
      "advisory_lock_busy",
      "Voucher code allocation lock is currently busy.",
    );
  }
}

export async function allocateVoucherCode(
  tx: PrismaNamespace.TransactionClient,
  now = new Date(),
  options: { failFast?: boolean } = {},
): Promise<string> {
  await lockVoucherCodeAllocation(tx, options.failFast ?? false);
  const year = getVoucherPragueCalendarYear(now);

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const code = buildVoucherCode(year);
    const [existingVoucher, existingStockItem] = await Promise.all([
      tx.voucher.findUnique({
        where: { code },
        select: { id: true },
      }),
      tx.voucherStockItem.findUnique({
        where: { code },
        select: { id: true },
      }),
    ]);

    if (!existingVoucher && !existingStockItem) {
      return code;
    }
  }

  throw new Error("Voucher code could not be generated safely.");
}

/**
 * Přidělí více kódů pod jedním transaction-scoped lockem.
 * Voucher a VoucherStockItem nemají společný unikátní index, proto se volné
 * kandidáty ověřují v obou tabulkách dávkovými dotazy.
 */
export async function allocateVoucherCodes(
  tx: PrismaNamespace.TransactionClient,
  quantity: number,
  now = new Date(),
  options: { failFast?: boolean } = {},
): Promise<string[]> {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Voucher code allocation quantity must be a positive integer.");
  }

  await lockVoucherCodeAllocation(tx, options.failFast ?? false);
  const year = getVoucherPragueCalendarYear(now);
  const allocated: string[] = [];
  const allocatedSet = new Set<string>();

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS && allocated.length < quantity; attempt += 1) {
    const remaining = quantity - allocated.length;
    const candidates: string[] = [];
    const candidateSet = new Set<string>();

    while (candidates.length < Math.max(remaining, 16)) {
      const candidate = buildVoucherCode(year);
      if (!candidateSet.has(candidate) && !allocatedSet.has(candidate)) {
        candidateSet.add(candidate);
        candidates.push(candidate);
      }
    }

    const [existingVouchers, existingStockItems] = await Promise.all([
      tx.voucher.findMany({
        where: { code: { in: candidates } },
        select: { code: true },
      }),
      tx.voucherStockItem.findMany({
        where: { code: { in: candidates } },
        select: { code: true },
      }),
    ]);
    const occupiedCodes = new Set([
      ...existingVouchers.map((voucher) => voucher.code),
      ...existingStockItems.map((stockItem) => stockItem.code),
    ]);

    for (const candidate of candidates) {
      if (!occupiedCodes.has(candidate)) {
        allocated.push(candidate);
        allocatedSet.add(candidate);
        if (allocated.length === quantity) {
          return allocated;
        }
      }
    }
  }

  throw new Error("Voucher codes could not be generated safely.");
}
