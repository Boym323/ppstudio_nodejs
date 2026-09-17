import { VoucherPrintBatchStatus, VoucherStockItemStatus } from "@/generated/prisma/browser";

import { type AdminArea } from "@/config/navigation";

function buildBaseHref(area: AdminArea) {
  return area === "owner" ? "/admin/vouchery" : "/admin/provoz/vouchery";
}

export function getAdminVoucherStockHref(area: AdminArea) {
  return `${buildBaseHref(area)}/predtistene`;
}

export function getAdminVoucherStockCreateHref() {
  return "/admin/vouchery/predtistene/novy";
}

export function getAdminVoucherStockBatchHref(area: AdminArea, batchId: string) {
  return `${getAdminVoucherStockHref(area)}/${batchId}`;
}

export function getAdminVoucherStockPdfHref(batchId: string) {
  return `/admin/vouchery/predtistene/${batchId}/pdf`;
}

export function getAdminVoucherActivationHref(area: AdminArea, code?: string) {
  const href = area === "owner" ? "/admin/vouchery/aktivovat" : "/admin/provoz/vouchery/aktivovat";
  return code ? `${href}?code=${encodeURIComponent(code)}` : href;
}

export function getVoucherPrintBatchStatusLabel(status: VoucherPrintBatchStatus) {
  switch (status) {
    case VoucherPrintBatchStatus.PENDING_PRINT:
      return "Čeká na tisk";
    case VoucherPrintBatchStatus.RECEIVED:
      return "Převzatá";
    case VoucherPrintBatchStatus.CLOSED:
      return "Uzavřená";
  }
}

export function getVoucherStockItemStatusLabel(status: VoucherStockItemStatus) {
  switch (status) {
    case VoucherStockItemStatus.PENDING_PRINT:
      return "Čeká na tisk";
    case VoucherStockItemStatus.AVAILABLE:
      return "K dispozici";
    case VoucherStockItemStatus.ACTIVATED:
      return "Aktivovaný";
    case VoucherStockItemStatus.VOID:
      return "Znehodnocený";
  }
}
