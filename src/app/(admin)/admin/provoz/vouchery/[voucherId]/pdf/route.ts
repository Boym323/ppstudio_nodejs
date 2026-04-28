import { createAdminVoucherPdfRoute } from "@/features/admin/lib/admin-voucher-pdf-route";

export const runtime = "nodejs";

export const GET = createAdminVoucherPdfRoute();
