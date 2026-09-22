import { AdminRole } from "@/generated/prisma/browser";
import { NextResponse } from "next/server";

import { getVoucherDetail } from "@/features/vouchers/lib/voucher-read-models";
import {
  buildVoucherPrintPdfFilename,
  generatePersistedVoucherPrintPdf,
} from "@/features/vouchers/lib/voucher-pdf";
import { getSession } from "@/lib/auth/session";
import { handleVoucherPdfError } from "@/features/admin/lib/admin-voucher-pdf-error";

type VoucherPrintPdfRouteParams = Promise<{
  voucherId: string;
}>;

type VoucherPrintPdfRouteDependencies = {
  getSession?: typeof getSession;
  getVoucher?: typeof getVoucherDetail;
  generatePdf?: typeof generatePersistedVoucherPrintPdf;
};

export function createAdminVoucherPrintPdfRoute(dependencies: VoucherPrintPdfRouteDependencies = {}) {
  const getSessionFn = dependencies.getSession ?? getSession;
  const getVoucher = dependencies.getVoucher ?? getVoucherDetail;
  const generatePdf = dependencies.generatePdf ?? generatePersistedVoucherPrintPdf;

  return async function AdminVoucherPrintPdfRoute(
    _request: Request,
    { params }: { params: VoucherPrintPdfRouteParams },
  ) {
    const session = await getSessionFn();

    if (!session) {
      return new NextResponse("Nejste přihlášeni.", { status: 401 });
    }

    if (session.role !== AdminRole.OWNER && session.role !== AdminRole.SALON) {
      return new NextResponse("Nemáte oprávnění stáhnout tiskové PDF voucheru.", { status: 403 });
    }

    const { voucherId } = await params;
    const voucher = await getVoucher(voucherId);

    if (!voucher) {
      return new NextResponse("Voucher nebyl nalezen.", { status: 404 });
    }

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await generatePdf(voucher);
    } catch (error) {
      return handleVoucherPdfError(error, { voucherId, templateKey: voucher.templateKey });
    }

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${buildVoucherPrintPdfFilename(voucher.code)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  };
}
