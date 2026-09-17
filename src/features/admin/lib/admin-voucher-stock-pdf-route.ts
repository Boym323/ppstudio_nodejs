import { AdminRole } from "@/generated/prisma/browser";
import { NextResponse } from "next/server";

import {
  buildVoucherStockPdfFilename,
  generateVoucherBatchPrintPdf,
} from "@/features/vouchers/lib/voucher-pdf";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

type VoucherStockPdfRouteParams = Promise<{ batchId: string }>;

export function createAdminVoucherStockPdfRoute() {
  return async function AdminVoucherStockPdfRoute(
    _request: Request,
    { params }: { params: VoucherStockPdfRouteParams },
  ) {
    const session = await getSession();

    if (!session) {
      return new NextResponse("Nejste přihlášeni.", { status: 401 });
    }

    if (session.role !== AdminRole.OWNER) {
      return new NextResponse("Nemáte oprávnění stáhnout tiskovou sérii.", { status: 403 });
    }

    const { batchId } = await params;
    const batch = await prisma.voucherPrintBatch.findUnique({
      where: { id: batchId },
      select: {
        batchNumber: true,
        templateKey: true,
        items: {
          orderBy: { sequenceNumber: "asc" },
          select: { code: true },
        },
      },
    });

    if (!batch) {
      return new NextResponse("Tisková série nebyla nalezena.", { status: 404 });
    }

    const pdfBytes = await generateVoucherBatchPrintPdf(batch);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${buildVoucherStockPdfFilename(batch.batchNumber)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  };
}
