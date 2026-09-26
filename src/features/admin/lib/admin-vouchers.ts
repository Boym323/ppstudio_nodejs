import { Prisma, type VoucherStatus, type VoucherType } from "@/generated/prisma/client";

import { type AdminArea } from "@/config/navigation";
import { getVoucherDetail, listVouchers } from "@/features/vouchers/lib/voucher-read-models";
import { prisma } from "@/lib/prisma";
import { getVoucherTemplateById, listVoucherTemplatesForIssuance } from "@/features/vouchers/lib/voucher-template-repository";
import { getSiteSettings } from "@/lib/site-settings";
import {
  addVoucherValidityMonths,
  getVoucherPragueCalendarDate,
} from "@/features/vouchers/lib/voucher-validity-date";
import { addPragueCalendarDays } from "@/features/admin/lib/kpi-date-range";

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

export function getAdminVoucherPrintPdfHref(area: AdminArea, voucherId: string) {
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
const moneyFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

function formatDateInputValue(value: Date) {
  return pragueDateFormatter.format(value);
}

export function buildVoucherCreateInitialValues(
  today: Date,
  settings: Pick<Awaited<ReturnType<typeof getSiteSettings>>, "voucherDefaultTemplateId" | "voucherDefaultValidityMonths">,
  templates: readonly { id: string; key: string; allowedTypes: readonly string[] }[],
) {
  const defaultTemplate = templates.find((template) => template.id === settings.voucherDefaultTemplateId && template.allowedTypes.includes("VALUE"));

  return {
    type: "VALUE" as const,
    templateKey: defaultTemplate?.key ?? "",
    validFrom: formatDateInputValue(today),
    validUntil: formatDateInputValue(addVoucherValidityMonths(today, settings.voucherDefaultValidityMonths)),
  };
}

async function countVouchers(where: Prisma.Sql = Prisma.empty) {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS "count"
    FROM "Voucher" v
    ${where}
  `);

  return rows[0]?.count ?? 0;
}

function formatRemainingWorkload(valueCzk: number, serviceCount: number) {
  const parts: string[] = [];

  if (valueCzk > 0 || serviceCount === 0) {
    parts.push(moneyFormatter.format(valueCzk));
  }

  if (serviceCount > 0) {
    const serviceLabel =
      serviceCount === 1 ? "služba" : serviceCount >= 2 && serviceCount <= 4 ? "služby" : "služeb";

    parts.push(`${serviceCount} ${serviceLabel}`);
  }

  return parts.join(" + ");
}

export async function getAdminVouchersPageData(
  area: AdminArea,
  searchParams?: Record<string, string | string[] | undefined>,
  now = new Date(),
) {
  const filters = normalizeSearchParams(searchParams);
  const soonThreshold = addPragueCalendarDays(now, 30);
  const currentPragueDate = getVoucherPragueCalendarDate(now);
  const soonPragueDate = getVoucherPragueCalendarDate(soonThreshold);
  const validFromPragueDate = Prisma.sql`DATE(v."validFrom" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Prague')`;
  const validUntilPragueDate = Prisma.sql`DATE(v."validUntil" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Prague')`;
  const activeVoucherValidity = Prisma.sql`
    ${validFromPragueDate} <= ${currentPragueDate}::date
    AND (v."validUntil" IS NULL OR ${validUntilPragueDate} >= ${currentPragueDate}::date)
  `;

  const [
    openCount,
    soonExpiringCount,
    redeemedCount,
    expiredCount,
    cancelledCount,
    remainingValueResult,
    remainingServiceCount,
    vouchers,
  ] =
    await Promise.all([
      countVouchers(Prisma.sql`
        WHERE v."status" IN ('ACTIVE'::"VoucherStatus", 'PARTIALLY_REDEEMED'::"VoucherStatus")
          AND ${activeVoucherValidity}
      `),
      countVouchers(Prisma.sql`
        WHERE v."status" IN ('ACTIVE'::"VoucherStatus", 'PARTIALLY_REDEEMED'::"VoucherStatus")
          AND ${activeVoucherValidity}
          AND v."validUntil" IS NOT NULL
          AND ${validUntilPragueDate} >= ${currentPragueDate}::date
          AND ${validUntilPragueDate} <= ${soonPragueDate}::date
      `),
      countVouchers(Prisma.sql`WHERE v."status" = 'REDEEMED'::"VoucherStatus"`),
      countVouchers(Prisma.sql`
        WHERE v."status" = 'EXPIRED'::"VoucherStatus"
          OR (
            v."status" IN ('ACTIVE'::"VoucherStatus", 'PARTIALLY_REDEEMED'::"VoucherStatus")
            AND ${validFromPragueDate} <= ${currentPragueDate}::date
            AND v."validUntil" IS NOT NULL
            AND ${validUntilPragueDate} < ${currentPragueDate}::date
          )
      `),
      countVouchers(Prisma.sql`WHERE v."status" = 'CANCELLED'::"VoucherStatus"`),
      prisma.$queryRaw<Array<{ remainingValueCzk: number }>>(Prisma.sql`
        SELECT COALESCE(SUM(v."remainingValueCzk"), 0)::int AS "remainingValueCzk"
        FROM "Voucher" v
        WHERE v."type" = 'VALUE'::"VoucherType"
          AND v."status" IN ('ACTIVE'::"VoucherStatus", 'PARTIALLY_REDEEMED'::"VoucherStatus")
          AND ${activeVoucherValidity}
      `),
      countVouchers(Prisma.sql`
        WHERE v."type" = 'SERVICE'::"VoucherType"
          AND v."status" IN ('ACTIVE'::"VoucherStatus", 'PARTIALLY_REDEEMED'::"VoucherStatus")
          AND ${activeVoucherValidity}
      `),
      listVouchers({
        query: filters.q,
        type: filters.type === "all" ? "all" : typeFilterToVoucherType[filters.type],
        status: filters.status === "all" ? "all" : statusFilterToVoucherStatus[filters.status],
        now,
        take: 100,
      }),
    ]);

  const remainingValueCzk = remainingValueResult[0]?.remainingValueCzk ?? 0;
  const remainingWorkload = formatRemainingWorkload(remainingValueCzk, remainingServiceCount);

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
        label: "Zbývá k uplatnění",
        value: remainingWorkload,
        tone: "accent" as const,
        detail: openCount > 0 ? "Jen otevřené vouchery" : "Bez otevřených voucherů",
      },
      {
        label: "Otevřené vouchery",
        value: String(openCount),
        detail: "Aktivní a částečně čerpané",
      },
      {
        label: "Brzy expirují",
        value: String(soonExpiringCount),
        tone: soonExpiringCount > 0 ? ("warning" as const) : undefined,
        detail: "Do 30 dnů",
      },
      {
        label: "Uzavřené",
        value: String(redeemedCount + expiredCount + cancelledCount),
        tone: "muted" as const,
        detail: "Uplatněné, propadlé, zrušené",
      },
    ],
  };
}

export async function getAdminVoucherDetailData(area: AdminArea, voucherId: string) {
  const voucher = await getVoucherDetail(voucherId);

  if (!voucher) {
    return null;
  }

  const template = voucher.templateId ? await getVoucherTemplateById(voucher.templateId) : null;
  return {
    ...voucher,
    templateLabel: template?.label ?? "Chybějící šablona",
    area,
    listHref: getAdminVouchersHref(area),
    detailHref: getAdminVoucherHref(area, voucher.id),
    pdfHref: getAdminVoucherPdfHref(area, voucher.id),
    printPdfHref: getAdminVoucherPrintPdfHref(area, voucher.id),
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
  const [settings, services, persistedTemplates] = await Promise.all([getSiteSettings(), prisma.service.findMany({
    where: {
      isActive: true,
      priceFromCzk: { not: null },
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
  }), listVoucherTemplatesForIssuance()]);
  const templates = persistedTemplates;
  const defaultTemplate = templates.find((template) => template.id === settings.voucherDefaultTemplateId);

  return {
    area,
    listHref: getAdminVouchersHref(area),
    services,
    templates,
    initialValues: {
      type: "VALUE" as const,
      templateKey: defaultTemplate?.allowedTypes.includes("VALUE") ? defaultTemplate.key : "",
      validFrom: formatDateInputValue(today),
      validUntil: formatDateInputValue(addVoucherValidityMonths(today, settings.voucherDefaultValidityMonths)),
    },
  };
}
