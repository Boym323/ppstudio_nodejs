import { randomInt } from "node:crypto";

import { Prisma, type Prisma as PrismaNamespace } from "@/generated/prisma/client";
import { getVoucherPragueCalendarYear } from "@/features/vouchers/lib/voucher-validity-date";

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

async function lockVoucherCodeAllocation(tx: PrismaNamespace.TransactionClient) {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(${VOUCHER_CODE_ALLOCATION_LOCK}))
  `);
}

export async function allocateVoucherCode(
  tx: PrismaNamespace.TransactionClient,
  now = new Date(),
): Promise<string> {
  await lockVoucherCodeAllocation(tx);
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
