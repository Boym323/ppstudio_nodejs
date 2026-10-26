import { BookingStatus, Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import type { AdminLogSeverity } from "./email-log-types";

export const voucherCompletionAuditReason = "Voucher uplatněn při dokončení návštěvy";
export const voucherCompletionAuditSource = "admin-booking-complete-flow-v1";

const bookingHistoryOperationalSources = [
  "admin-booking-price-update-v1",
  "admin-booking-note-v1",
  "admin-client-contact-update-v1",
  "admin-booking-service-change-v1",
  "admin-booking-payment-create-v1",
  "admin-booking-payment-update-v1",
  "admin-booking-payment-void-v1",
  "admin-booking-complete-flow-v1",
] as const;

type DeduplicatedBookingHistoryQuery = {
  query: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  severity: "all" | AdminLogSeverity;
};

function bookingHistoryStatus(value: BookingStatus) {
  return Prisma.sql`${value}::"BookingStatus"`;
}

function getDeduplicatedBookingHistoryWhere(
  input: DeduplicatedBookingHistoryQuery,
) {
  const conditions: Prisma.Sql[] = [];

  if (input.dateFrom) conditions.push(Prisma.sql`history."createdAt" >= ${input.dateFrom}`);
  if (input.dateTo) conditions.push(Prisma.sql`history."createdAt" < ${input.dateTo}`);
  if (input.query) {
    conditions.push(Prisma.sql`(
      strpos(lower(coalesce(history."reason", '')), lower(${input.query})) > 0
      OR strpos(lower(coalesce(history."note", '')), lower(${input.query})) > 0
      OR strpos(lower(booking."id"), lower(${input.query})) > 0
      OR strpos(lower(booking."clientNameSnapshot"), lower(${input.query})) > 0
      OR strpos(lower(booking."serviceNameSnapshot"), lower(${input.query})) > 0
    )`);
  }

  const operationalSource = Prisma.sql`coalesce(history."metadata"->>'source' IN (${Prisma.join(bookingHistoryOperationalSources)}), false)`;
  const creationReason = Prisma.sql`coalesce(history."reason" IN ('public-booking-request-v1', 'admin-manual-booking-v1'), false)`;

  if (input.severity === "info") {
    conditions.push(Prisma.sql`(
      history."status" IN (${Prisma.join([bookingHistoryStatus(BookingStatus.PENDING), bookingHistoryStatus(BookingStatus.CANCELLED)])})
      OR ${operationalSource}
      OR ${creationReason}
    )`);
  } else if (input.severity === "success") {
    conditions.push(Prisma.sql`(
      history."status" IN (${Prisma.join([bookingHistoryStatus(BookingStatus.CONFIRMED), bookingHistoryStatus(BookingStatus.COMPLETED)])})
      AND NOT (${operationalSource})
      AND NOT (${creationReason})
    )`);
  } else if (input.severity === "warning") {
    conditions.push(Prisma.sql`history."status" = ${bookingHistoryStatus(BookingStatus.NO_SHOW)} AND NOT (${operationalSource})`);
  } else if (input.severity === "error") {
    conditions.push(Prisma.sql`FALSE`);
  }

  // The completion audit is a display-only duplicate of the canonical
  // redemption. PostgreSQL can evaluate this identity per row without
  // materializing the complete history or a dynamically sized OR predicate.
  conditions.push(Prisma.sql`NOT (
    coalesce(history."reason" = ${voucherCompletionAuditReason}, false)
    AND coalesce(history."metadata"->>'source' = ${voucherCompletionAuditSource}, false)
    AND history."metadata"->>'voucherCode' IS NOT NULL
    AND history."metadata"->>'voucherCode' <> ''
    AND EXISTS (
      SELECT 1
      FROM "VoucherRedemption" AS redemption
      INNER JOIN "Voucher" AS voucher ON voucher."id" = redemption."voucherId"
      WHERE redemption."bookingId" = history."bookingId"
        AND voucher."code" = history."metadata"->>'voucherCode'
    )
  )`);

  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;
}

export async function countDeduplicatedBookingHistory(input: DeduplicatedBookingHistoryQuery) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number | string }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS "count"
    FROM "BookingStatusHistory" AS history
    INNER JOIN "Booking" AS booking ON booking."id" = history."bookingId"
    ${getDeduplicatedBookingHistoryWhere(input)}
  `);

  return Number(rows[0]?.count ?? 0);
}

export async function findDeduplicatedBookingHistoryIds(
  input: DeduplicatedBookingHistoryQuery & { take: number },
) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT history."id"
    FROM "BookingStatusHistory" AS history
    INNER JOIN "Booking" AS booking ON booking."id" = history."bookingId"
    ${getDeduplicatedBookingHistoryWhere(input)}
    ORDER BY history."createdAt" DESC, history."id" DESC
    LIMIT ${input.take}
  `);

  return rows.map((row) => row.id);
}

export type VoucherCompletionBookingAudit = {
  bookingId: string;
  reason: string | null;
  metadata: Prisma.JsonValue | null;
};

export type CanonicalVoucherRedemption = {
  bookingId: string | null;
  voucher: { code: string } | null;
};

export function getBookingHistorySource(metadata: Prisma.JsonValue | null): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return typeof metadata.source === "string" ? metadata.source : null;
}

export function getBookingHistoryVoucherCode(metadata: Prisma.JsonValue | null): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return typeof metadata.voucherCode === "string" ? metadata.voucherCode : null;
}

/** Potlačí jen booking audit, pro který existuje stejná kanonická voucher redemption operace. */
export function filterDuplicateVoucherCompletionAudits<T extends VoucherCompletionBookingAudit>(
  history: T[],
  redemptions: CanonicalVoucherRedemption[],
) {
  const canonicalOperations = new Set(redemptions.flatMap((redemption) => (
    redemption.bookingId && redemption.voucher
      ? [`${redemption.bookingId}\u0000${redemption.voucher.code}`]
      : []
  )));

  return history.filter((entry) => {
    if (entry.reason !== voucherCompletionAuditReason || getBookingHistorySource(entry.metadata) !== voucherCompletionAuditSource) return true;
    const voucherCode = getBookingHistoryVoucherCode(entry.metadata);
    return !voucherCode || !canonicalOperations.has(`${entry.bookingId}\u0000${voucherCode}`);
  });
}
