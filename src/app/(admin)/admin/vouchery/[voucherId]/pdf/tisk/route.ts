import { createAdminVoucherPrintPdfRoute } from "@/features/admin/lib/admin-voucher-print-pdf-route";

export const runtime = "nodejs";

export const GET = createAdminVoucherPrintPdfRoute();
