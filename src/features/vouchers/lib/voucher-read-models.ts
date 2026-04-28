import { EmailLogType, Prisma, VoucherStatus, VoucherType } from "@prisma/client";

import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import {
  formatVoucherRemaining,
  formatVoucherStatus,
  formatVoucherType,
  formatVoucherValue,
  getEffectiveVoucherStatus,
} from "@/features/vouchers/lib/voucher-format";
import { prisma } from "@/lib/prisma";

export type VoucherListFilters = {
  query?: string;
  type?: VoucherType | "all";
  status?: VoucherStatus | "all";
  take?: number;
  now?: Date;
};

function buildVoucherSqlWhere(filters: VoucherListFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  const query = filters.query?.trim();
  const now = filters.now ?? new Date();

  if (filters.type && filters.type !== "all") {
    conditions.push(Prisma.sql`v."type" = ${filters.type}::"VoucherType"`);
  }

  if (filters.status && filters.status !== "all") {
    if (filters.status === "EXPIRED") {
      conditions.push(Prisma.sql`(
        v."status" = 'EXPIRED'::"VoucherStatus"
        OR (
          v."status" IN ('ACTIVE'::"VoucherStatus", 'PARTIALLY_REDEEMED'::"VoucherStatus")
          AND v."validUntil" < ${now}
        )
      )`);
    } else if (filters.status === "ACTIVE" || filters.status === "PARTIALLY_REDEEMED") {
      conditions.push(Prisma.sql`v."status" = ${filters.status}::"VoucherStatus"`);
      conditions.push(Prisma.sql`(v."validUntil" IS NULL OR v."validUntil" >= ${now})`);
    } else {
      conditions.push(Prisma.sql`v."status" = ${filters.status}::"VoucherStatus"`);
    }
  }

  if (query) {
    const likeQuery = `%${query}%`;
    conditions.push(Prisma.sql`(
      v."code" ILIKE ${likeQuery}
      OR v."purchaserName" ILIKE ${likeQuery}
      OR v."purchaserEmail" ILIKE ${likeQuery}
      OR v."recipientName" ILIKE ${likeQuery}
      OR v."serviceNameSnapshot" ILIKE ${likeQuery}
    )`);
  }

  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;
}

export async function listVouchers(filters: VoucherListFilters = {}) {
  const take = Math.min(Math.max(filters.take ?? 50, 1), 200);
  const where = buildVoucherSqlWhere(filters);
  const vouchers = await prisma.$queryRaw<
    Array<{
      id: string;
      code: string;
      type: VoucherType;
      status: VoucherStatus;
      originalValueCzk: number | null;
      remainingValueCzk: number | null;
      serviceNameSnapshot: string | null;
      servicePriceSnapshotCzk: number | null;
      validFrom: Date;
      validUntil: Date | null;
      issuedAt: Date | null;
      createdAt: Date;
      recipientName: string | null;
      purchaserName: string | null;
      redemptionsCount: number;
    }>
  >(Prisma.sql`
    SELECT
      v."id",
      v."code",
      v."type",
      v."status",
      v."originalValueCzk",
      v."remainingValueCzk",
      v."serviceNameSnapshot",
      v."servicePriceSnapshotCzk",
      v."validFrom",
      v."validUntil",
      v."issuedAt",
      v."createdAt",
      v."recipientName",
      v."purchaserName",
      (
        SELECT COUNT(*)::int
        FROM "VoucherRedemption" vr
        WHERE vr."voucherId" = v."id"
      ) AS "redemptionsCount"
    FROM "Voucher" v
    ${where}
    ORDER BY v."createdAt" DESC, v."code" ASC
    LIMIT ${take}
  `);

  return vouchers.map((voucher) => {
    const effectiveStatus = getEffectiveVoucherStatus(voucher);

    return {
      ...voucher,
      _count: {
        redemptions: voucher.redemptionsCount,
      },
      effectiveStatus,
      typeLabel: formatVoucherType(voucher.type),
      statusLabel: formatVoucherStatus(effectiveStatus),
      valueLabel: formatVoucherValue(voucher),
      remainingLabel: formatVoucherRemaining({
        type: voucher.type,
        remainingValueCzk: voucher.remainingValueCzk,
        status: effectiveStatus,
      }),
    };
  });
}

export async function getVoucherDetail(id: string) {
  const voucher = await prisma.voucher.findUnique({
    where: { id },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          publicName: true,
          priceFromCzk: true,
          durationMinutes: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      redemptions: {
        orderBy: { redeemedAt: "desc" },
        include: {
          booking: {
            select: {
              id: true,
              clientNameSnapshot: true,
              serviceNameSnapshot: true,
              scheduledStartsAt: true,
            },
          },
          redeemedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!voucher) {
    return null;
  }

  const effectiveStatus = getEffectiveVoucherStatus(voucher);
  const emailHistory = await loadVoucherEmailHistory(voucher.id);

  return {
    ...voucher,
    effectiveStatus,
    typeLabel: formatVoucherType(voucher.type),
    statusLabel: formatVoucherStatus(effectiveStatus),
    valueLabel: formatVoucherValue(voucher),
    remainingLabel: formatVoucherRemaining({
      type: voucher.type,
      remainingValueCzk: voucher.remainingValueCzk,
      status: effectiveStatus,
    }),
    emailHistory,
  };
}

async function loadVoucherEmailHistory(voucherId: string) {
  try {
    const logs = await prisma.emailLog.findMany({
      where: {
        type: EmailLogType.VOUCHER_SENT,
        payload: {
          path: ["voucherId"],
          equals: voucherId,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        recipientEmail: true,
        status: true,
        createdAt: true,
        sentAt: true,
        errorMessage: true,
      },
    });

    return logs.map((log) => ({
      id: log.id,
      recipientEmail: log.recipientEmail,
      status: log.status,
      createdAt: log.createdAt,
      sentAt: log.sentAt,
      errorMessage: summarizeEmailError(log.errorMessage),
    }));
  } catch (error) {
    console.error("Failed to load voucher email history", {
      voucherId,
      error,
    });

    return [];
  }
}

function summarizeEmailError(errorMessage: string | null) {
  if (!errorMessage) {
    return null;
  }

  const summary = errorMessage
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!summary) {
    return null;
  }

  return summary.length > 160 ? `${summary.slice(0, 157)}...` : summary;
}

export async function getVoucherByCodeSafe(codeInput: string) {
  const code = normalizeVoucherCode(codeInput);

  if (!code) {
    return null;
  }

  const voucher = await prisma.voucher.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      type: true,
      status: true,
      originalValueCzk: true,
      remainingValueCzk: true,
      serviceId: true,
      serviceNameSnapshot: true,
      servicePriceSnapshotCzk: true,
      validFrom: true,
      validUntil: true,
    },
  });

  if (!voucher) {
    return null;
  }

  const effectiveStatus = getEffectiveVoucherStatus(voucher);

  return {
    ...voucher,
    effectiveStatus,
    typeLabel: formatVoucherType(voucher.type),
    statusLabel: formatVoucherStatus(effectiveStatus),
    valueLabel: formatVoucherValue(voucher),
    remainingLabel: formatVoucherRemaining({
      type: voucher.type,
      remainingValueCzk: voucher.remainingValueCzk,
      status: effectiveStatus,
    }),
  };
}
