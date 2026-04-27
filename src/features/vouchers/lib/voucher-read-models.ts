import { Prisma, VoucherStatus, VoucherType } from "@prisma/client";

import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import {
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
};

function buildVoucherWhere(filters: VoucherListFilters): Prisma.VoucherWhereInput {
  const where: Prisma.VoucherWhereInput = {};
  const query = filters.query?.trim();

  if (filters.type && filters.type !== "all") {
    where.type = filters.type;
  }

  if (filters.status && filters.status !== "all") {
    where.status = filters.status;
  }

  if (query) {
    where.OR = [
      { code: { contains: query, mode: "insensitive" } },
      { purchaserName: { contains: query, mode: "insensitive" } },
      { purchaserEmail: { contains: query, mode: "insensitive" } },
      { recipientName: { contains: query, mode: "insensitive" } },
      { serviceNameSnapshot: { contains: query, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listVouchers(filters: VoucherListFilters = {}) {
  const vouchers = await prisma.voucher.findMany({
    where: buildVoucherWhere(filters),
    orderBy: [{ createdAt: "desc" }, { code: "asc" }],
    take: Math.min(Math.max(filters.take ?? 50, 1), 200),
    select: {
      id: true,
      code: true,
      type: true,
      status: true,
      originalValueCzk: true,
      remainingValueCzk: true,
      serviceNameSnapshot: true,
      servicePriceSnapshotCzk: true,
      validFrom: true,
      validUntil: true,
      issuedAt: true,
      createdAt: true,
      recipientName: true,
      purchaserName: true,
      _count: {
        select: {
          redemptions: true,
        },
      },
    },
  });

  return vouchers.map((voucher) => {
    const effectiveStatus = getEffectiveVoucherStatus(voucher);

    return {
      ...voucher,
      effectiveStatus,
      typeLabel: formatVoucherType(voucher.type),
      statusLabel: formatVoucherStatus(effectiveStatus),
      valueLabel: formatVoucherValue(voucher),
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

  return {
    ...voucher,
    effectiveStatus,
    typeLabel: formatVoucherType(voucher.type),
    statusLabel: formatVoucherStatus(effectiveStatus),
    valueLabel: formatVoucherValue(voucher),
  };
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
      remainingValueCzk: true,
      serviceId: true,
      serviceNameSnapshot: true,
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
  };
}
