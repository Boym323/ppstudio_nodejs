import { AdminRole, VoucherPrintBatchStatus } from "@/generated/prisma/browser";
import { NextResponse } from "next/server";

import {
  buildVoucherStockPdfFilename,
  generateVoucherBatchPrintPdf,
} from "@/features/vouchers/lib/voucher-pdf";
import { canDownloadVoucherStockPdf } from "@/features/admin/lib/admin-voucher-stock-paths";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { handleVoucherPdfError } from "@/features/admin/lib/admin-voucher-pdf-error";

type VoucherStockPdfRouteParams = Promise<{ batchId: string }>;

type VoucherStockPdfBatch = {
  batchNumber: string;
  templateKey: string;
  status: VoucherPrintBatchStatus;
  items: Array<{ code: string }>;
};

type VoucherStockPdfRouteDependencies = {
  getSession?: typeof getSession;
  findBatch?: (batchId: string) => Promise<VoucherStockPdfBatch | null>;
  generatePdf?: typeof generateVoucherBatchPrintPdf;
};

export function createAdminVoucherStockPdfRoute(dependencies: VoucherStockPdfRouteDependencies = {}) {
  const getSessionFn = dependencies.getSession ?? getSession;
  const findBatch = dependencies.findBatch ?? (async (batchId: string) => prisma.voucherPrintBatch.findUnique({
    where: { id: batchId },
    select: {
      batchNumber: true,
      templateKey: true,
      status: true,
      items: {
        orderBy: { sequenceNumber: "asc" },
        select: { code: true },
      },
    },
  }));
  const generatePdf = dependencies.generatePdf ?? generateVoucherBatchPrintPdf;

  return async function AdminVoucherStockPdfRoute(
    _request: Request,
    { params }: { params: VoucherStockPdfRouteParams },
  ) {
    const session = await getSessionFn();

    if (!session) {
      return new NextResponse("Nejste přihlášeni.", { status: 401 });
    }

    if (session.role !== AdminRole.OWNER) {
      return new NextResponse("Nemáte oprávnění stáhnout tiskovou sérii.", { status: 403 });
    }

    const { batchId } = await params;
    const batch = await findBatch(batchId);

    if (!batch) {
      return new NextResponse("Tisková série nebyla nalezena.", { status: 404 });
    }

    if (!canDownloadVoucherStockPdf(batch.status)) {
      return new NextResponse("Tiskové PDF již není po převzetí série dostupné.", {
        status: 409,
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await generatePdf({
        batchNumber: batch.batchNumber,
        templateKey: batch.templateKey,
        items: batch.items,
      });
    } catch (error) {
      return handleVoucherPdfError(error, {
        batchId,
        templateKey: batch.templateKey,
      });
    }

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
