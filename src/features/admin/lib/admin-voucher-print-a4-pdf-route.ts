import { AdminRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { getVoucherDetail } from "@/features/vouchers/lib/voucher-read-models";
import {
  buildVoucherPrintA4PdfFilename,
  generateVoucherPrintA4Pdf,
} from "@/features/vouchers/lib/voucher-print-a4-pdf-core";
import { getSession } from "@/lib/auth/session";

type VoucherPrintA4PdfRouteParams = Promise<{
  voucherId: string;
}>;

export function createAdminVoucherPrintA4PdfRoute() {
  return async function AdminVoucherPrintA4PdfRoute(
    _request: Request,
    { params }: { params: VoucherPrintA4PdfRouteParams },
  ) {
    const session = await getSession();

    if (!session) {
      return new NextResponse("Nejste přihlášeni.", { status: 401 });
    }

    if (session.role !== AdminRole.OWNER && session.role !== AdminRole.SALON) {
      return new NextResponse("Nemáte oprávnění stáhnout tiskové PDF voucheru.", { status: 403 });
    }

    const { voucherId } = await params;

    const voucher = await getVoucherDetail(voucherId);

    if (!voucher) {
      return new NextResponse("Voucher nebyl nalezen.", { status: 404 });
    }

    const pdfBytes = await generateVoucherPrintA4Pdf(voucher, {});

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${buildVoucherPrintA4PdfFilename(voucher.code)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  };
}
