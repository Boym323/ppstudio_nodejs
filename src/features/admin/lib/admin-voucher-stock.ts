import { Prisma, VoucherPrintBatchStatus, VoucherStockItemStatus } from "@/generated/prisma/client";

import { type AdminArea } from "@/config/navigation";
import { findVoucherStockItemByCode } from "@/features/vouchers/lib/voucher-stock";
import { getActiveVoucherTemplatesForNewVouchers, getVoucherTemplate } from "@/features/vouchers/lib/voucher-template-registry";
import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import { addVoucherValidityMonths } from "@/features/vouchers/lib/voucher-validity-date";
import {
  getAdminVoucherActivationHref,
  getAdminVoucherStockBatchHref,
  getAdminVoucherStockHref,
  getAdminVoucherStockPdfHref,
  getVoucherStockItemStatusLabel,
} from "@/features/admin/lib/admin-voucher-stock-paths";
export {
  getAdminVoucherActivationHref,
  getAdminVoucherStockBatchHref,
  getAdminVoucherStockCreateHref,
  getAdminVoucherStockHref,
  getAdminVoucherStockPdfHref,
  canDownloadVoucherStockPdf,
  voucherStockPdfUnavailableMessage,
  getVoucherPrintBatchStatusLabel,
  getVoucherStockItemStatusLabel,
} from "@/features/admin/lib/admin-voucher-stock-paths";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

export type AdminVoucherStockStatusFilter = "all" | "pending_print" | "received" | "closed";
export type AdminVoucherStockItemStatusFilter = "all" | "pending_print" | "available" | "activated" | "void";

export type AdminVoucherStockFilters = {
  q: string;
  status: AdminVoucherStockStatusFilter;
};

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFilters(searchParams?: Record<string, string | string[] | undefined>): AdminVoucherStockFilters {
  const status = getSingleParam(searchParams?.status);

  return {
    q: getSingleParam(searchParams?.q).slice(0, 120),
    status: status === "pending_print" || status === "received" || status === "closed" ? status : "all",
  };
}

function buildStatusWhere(status: AdminVoucherStockStatusFilter): Prisma.VoucherPrintBatchWhereInput {
  return status === "all" ? {} : { status: status.toUpperCase() as VoucherPrintBatchStatus };
}

function countItems(items: Array<{ status: VoucherStockItemStatus }>) {
  return {
    pendingPrint: items.filter((item) => item.status === VoucherStockItemStatus.PENDING_PRINT).length,
    available: items.filter((item) => item.status === VoucherStockItemStatus.AVAILABLE).length,
    activated: items.filter((item) => item.status === VoucherStockItemStatus.ACTIVATED).length,
    voided: items.filter((item) => item.status === VoucherStockItemStatus.VOID).length,
  };
}

export async function getAdminVoucherStockPageData(
  area: AdminArea,
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const filters = normalizeFilters(searchParams);
  const where: Prisma.VoucherPrintBatchWhereInput = {
    ...buildStatusWhere(filters.status),
    ...(filters.q
      ? {
          OR: [
            { batchNumber: { contains: filters.q, mode: "insensitive" } },
            { templateKey: { contains: filters.q, mode: "insensitive" } },
            { items: { some: { code: { contains: filters.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const batches = await prisma.voucherPrintBatch.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { batchNumber: "desc" }],
    take: 100,
    include: {
      createdByUser: { select: { id: true, name: true } },
      receivedByUser: { select: { id: true, name: true } },
      closedByUser: { select: { id: true, name: true } },
      items: { select: { status: true } },
    },
  });

  return {
    area,
    filters,
    currentPath: getAdminVoucherStockHref(area),
    canCreate: area === "owner",
    batches: batches.map((batch) => ({
      ...batch,
      templateLabel: getVoucherTemplate(batch.templateKey)?.label ?? batch.templateKey,
      counts: countItems(batch.items),
      detailHref: getAdminVoucherStockBatchHref(area, batch.id),
    })),
  };
}

export async function getAdminVoucherStockBatchDetailData(
  area: AdminArea,
  batchId: string,
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const query = getSingleParam(searchParams?.q).slice(0, 120);
  const status = getSingleParam(searchParams?.status);
  const itemStatus: AdminVoucherStockItemStatusFilter = ["pending_print", "available", "activated", "void"].includes(status)
    ? status as AdminVoucherStockItemStatusFilter
    : "all";
  const batch = await prisma.voucherPrintBatch.findUnique({
    where: { id: batchId },
    include: {
      createdByUser: { select: { id: true, name: true, email: true } },
      receivedByUser: { select: { id: true, name: true, email: true } },
      closedByUser: { select: { id: true, name: true, email: true } },
      items: {
        where: {
          ...(query ? { code: { contains: query, mode: "insensitive" } } : {}),
          ...(itemStatus !== "all" ? { status: itemStatus.toUpperCase() as VoucherStockItemStatus } : {}),
        },
        orderBy: { sequenceNumber: "asc" },
        include: {
          voucher: { select: { id: true } },
          activatedByUser: { select: { name: true } },
          voidedByUser: { select: { name: true } },
        },
      },
    },
  });

  if (!batch) {
    return null;
  }

  const allItems = await prisma.voucherStockItem.findMany({ where: { batchId }, select: { status: true } });

  return {
    ...batch,
    area,
    templateLabel: getVoucherTemplate(batch.templateKey)?.label ?? batch.templateKey,
    template: getVoucherTemplate(batch.templateKey) ?? null,
    counts: countItems(allItems),
    filters: { q: query, status: itemStatus },
    listHref: getAdminVoucherStockHref(area),
    pdfHref: getAdminVoucherStockPdfHref(batch.id),
    items: batch.items.map((item) => ({
      ...item,
      statusLabel: getVoucherStockItemStatusLabel(item.status),
      activationHref: getAdminVoucherActivationHref(area, item.code),
      voucherHref: item.voucher
        ? area === "owner" ? `/admin/vouchery/${item.voucher.id}` : `/admin/provoz/vouchery/${item.voucher.id}`
        : null,
    })),
  };
}

function formatDateInputValue(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export async function getAdminVoucherActivationPageData(area: AdminArea, codeInput?: string) {
  const [settings, services] = await Promise.all([
    getSiteSettings(),
    prisma.service.findMany({
      where: { isActive: true, priceFromCzk: { not: null } },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        publicName: true,
        priceFromCzk: true,
        durationMinutes: true,
        category: { select: { name: true } },
      },
    }),
  ]);
  const today = new Date();

  return {
    area,
    defaultCode: normalizeVoucherCode(codeInput ?? ""),
    defaultValidFrom: formatDateInputValue(today),
    defaultValidUntil: formatDateInputValue(addVoucherValidityMonths(today, settings.voucherDefaultValidityMonths)),
    services,
    validityMonths: settings.voucherDefaultValidityMonths,
    initialStockItem: codeInput ? await findVoucherStockItemByCode(codeInput) : null,
  };
}

export function getAdminVoucherStockCreatePageData() {
  return {
    templates: getActiveVoucherTemplatesForNewVouchers().filter((template) => template.allowedTypes.length > 0),
    listHref: getAdminVoucherStockHref("owner"),
  };
}

export type AdminVoucherStockPageData = Awaited<ReturnType<typeof getAdminVoucherStockPageData>>;
export type AdminVoucherStockBatchDetailData = NonNullable<Awaited<ReturnType<typeof getAdminVoucherStockBatchDetailData>>>;
export type AdminVoucherActivationPageData = Awaited<ReturnType<typeof getAdminVoucherActivationPageData>>;
export type AdminVoucherStockCreatePageData = ReturnType<typeof getAdminVoucherStockCreatePageData>;
