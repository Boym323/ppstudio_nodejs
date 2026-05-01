import { Prisma, type VoucherStatus, type VoucherType } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import { getVoucherDetail, listVouchers } from "@/features/vouchers/lib/voucher-read-models";
import { prisma } from "@/lib/prisma";

export type AdminVoucherTypeFilter = "all" | "value" | "service";
export type AdminVoucherStatusFilter =
  | "all"
  | "active"
  | "partially_redeemed"
  | "redeemed"
  | "expired"
  | "cancelled"
  | "draft";

export type AdminVoucherFilters = {
  q: string;
  type: AdminVoucherTypeFilter;
  status: AdminVoucherStatusFilter;
};

const typeFilterToVoucherType: Record<Exclude<AdminVoucherTypeFilter, "all">, VoucherType> = {
  value: "VALUE",
  service: "SERVICE",
};

const statusFilterToVoucherStatus: Record<Exclude<AdminVoucherStatusFilter, "all">, VoucherStatus> = {
  active: "ACTIVE",
  partially_redeemed: "PARTIALLY_REDEEMED",
  redeemed: "REDEEMED",
  expired: "EXPIRED",
  cancelled: "CANCELLED",
  draft: "DRAFT",
};

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSearchParams(
  searchParams?: Record<string, string | string[] | undefined>,
): AdminVoucherFilters {
  const type = getSingleParam(searchParams?.type);
  const status = getSingleParam(searchParams?.status);

  return {
    q: getSingleParam(searchParams?.q).slice(0, 64),
    type: isVoucherTypeFilter(type) ? type : "all",
    status: isVoucherStatusFilter(status) ? status : "all",
  };
}

function isVoucherTypeFilter(value: string): value is AdminVoucherTypeFilter {
  return value === "all" || value === "value" || value === "service";
}

function isVoucherStatusFilter(value: string): value is AdminVoucherStatusFilter {
  return (
    value === "all" ||
    value === "active" ||
    value === "partially_redeemed" ||
    value === "redeemed" ||
    value === "expired" ||
    value === "cancelled" ||
    value === "draft"
  );
}

export function getAdminVoucherHref(area: AdminArea, voucherId: string) {
  return area === "owner"
    ? `/admin/vouchery/${voucherId}`
    : `/admin/provoz/vouchery/${voucherId}`;
}

export function getAdminVoucherPdfHref(area: AdminArea, voucherId: string) {
  return `${getAdminVoucherHref(area, voucherId)}/pdf`;
}

export function getAdminVoucherPrintA4PdfHref(area: AdminArea, voucherId: string) {
  return `${getAdminVoucherPdfHref(area, voucherId)}/tisk`;
}

export function getAdminVouchersHref(area: AdminArea) {
  return area === "owner" ? "/admin/vouchery" : "/admin/provoz/vouchery";
}

export type AdminVoucherDetailData = NonNullable<Awaited<ReturnType<typeof getAdminVoucherDetailData>>>;
export type AdminVoucherCreatePageData = Awaited<ReturnType<typeof getAdminVoucherCreatePageData>>;

const pragueDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDateInputValue(value: Date) {
  return pragueDateFormatter.format(value);
}

function addMonths(value: Date, months: number) {
  const result = new Date(value);

  result.setMonth(result.getMonth() + months);

  return result;
}

async function countVouchers(where: Prisma.Sql = Prisma.empty) {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "Voucher" v
    ${where}
  `);

  return rows[0]?.count ?? 0;
}

export async function getAdminVouchersPageData(
  area: AdminArea,
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const filters = normalizeSearchParams(searchParams);
  const now = new Date();

  const [totalCount, activeCount, partiallyRedeemedCount, redeemedCount, expiredCount, cancelledCount, vouchers] =
    await Promise.all([
      countVouchers(),
      countVouchers(Prisma.sql`
        WHERE v."status" = 'ACTIVE'::"VoucherStatus"
          AND (v."validUntil" IS NULL OR v."validUntil" >= ${now})
      `),
      countVouchers(Prisma.sql`
        WHERE v."status" = 'PARTIALLY_REDEEMED'::"VoucherStatus"
          AND (v."validUntil" IS NULL OR v."validUntil" >= ${now})
      `),
      countVouchers(Prisma.sql`WHERE v."status" = 'REDEEMED'::"VoucherStatus"`),
      countVouchers(Prisma.sql`
        WHERE v."status" = 'EXPIRED'::"VoucherStatus"
          OR (
            v."status" IN ('ACTIVE'::"VoucherStatus", 'PARTIALLY_REDEEMED'::"VoucherStatus")
            AND v."validUntil" < ${now}
          )
      `),
      countVouchers(Prisma.sql`WHERE v."status" = 'CANCELLED'::"VoucherStatus"`),
      listVouchers({
        query: filters.q,
        type: filters.type === "all" ? "all" : typeFilterToVoucherType[filters.type],
        status: filters.status === "all" ? "all" : statusFilterToVoucherStatus[filters.status],
        now,
        take: 100,
      }),
    ]);

  return {
    area,
    currentPath: getAdminVouchersHref(area),
    filters,
    vouchers: vouchers.map((voucher) => ({
      ...voucher,
      detailHref: getAdminVoucherHref(area, voucher.id),
    })),
    stats: [
      {
        label: "Voucherů celkem",
        value: String(totalCount),
        tone: "accent" as const,
      },
      {
        label: "Aktivní",
        value: String(activeCount),
      },
      {
        label: "Částečně čerpané",
        value: String(partiallyRedeemedCount),
      },
      {
        label: "Uzavřené",
        value: String(redeemedCount + expiredCount + cancelledCount),
        tone: "muted" as const,
      },
    ],
  };
}

export async function getAdminVoucherDetailData(area: AdminArea, voucherId: string) {
  const voucher = await getVoucherDetail(voucherId);

  if (!voucher) {
    return null;
  }

  return {
    ...voucher,
    area,
    listHref: getAdminVouchersHref(area),
    detailHref: getAdminVoucherHref(area, voucher.id),
    pdfHref: getAdminVoucherPdfHref(area, voucher.id),
    printA4PdfHref: getAdminVoucherPrintA4PdfHref(area, voucher.id),
    redemptions: voucher.redemptions.map((redemption) => ({
      ...redemption,
      bookingHref: redemption.booking
        ? area === "owner"
          ? `/admin/rezervace/${redemption.booking.id}`
          : `/admin/provoz/rezervace/${redemption.booking.id}`
        : null,
    })),
  };
}

export async function getAdminVoucherCreatePageData(area: AdminArea) {
  const today = new Date();
  const defaultValidUntil = addMonths(today, 12);
  const services = await prisma.service.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      { category: { sortOrder: "asc" } },
      { sortOrder: "asc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      name: true,
      publicName: true,
      durationMinutes: true,
      priceFromCzk: true,
      category: {
        select: {
          name: true,
          isActive: true,
        },
      },
    },
  });

  return {
    area,
    listHref: getAdminVouchersHref(area),
    services,
    initialValues: {
      type: "VALUE" as const,
      validFrom: formatDateInputValue(today),
      validUntil: formatDateInputValue(defaultValidUntil),
    },
  };
}
