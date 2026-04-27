import { randomInt } from "node:crypto";

import { prisma } from "@/lib/prisma";

const VOUCHER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const VOUCHER_CODE_RANDOM_LENGTH = 6;
const MAX_GENERATION_ATTEMPTS = 50;

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

export async function generateVoucherCode(now = new Date()): Promise<string> {
  const year = now.getFullYear();

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const code = buildVoucherCode(year);
    const existing = await prisma.voucher.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error("Voucher code could not be generated safely.");
}
