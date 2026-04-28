import { AdminRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { getVoucherDetail } from "@/features/vouchers/lib/voucher-read-models";
import { buildVoucherPdfFilename, generateVoucherPdf } from "@/features/vouchers/lib/voucher-pdf";
import { getSession } from "@/lib/auth/session";

type VoucherPdfRouteParams = Promise<{
  voucherId: string;
}>;

export function createAdminVoucherPdfRoute() {
  return async function AdminVoucherPdfRoute(
    _request: Request,
    { params }: { params: VoucherPdfRouteParams },
  ) {
    const session = await getSession();

    if (!session) {
      return new NextResponse("Nejste přihlášeni.", { status: 401 });
    }

    if (session.role !== AdminRole.OWNER && session.role !== AdminRole.SALON) {
      return new NextResponse("Nemáte oprávnění stáhnout PDF voucheru.", { status: 403 });
    }

    const { voucherId } = await params;
    const voucher = await getVoucherDetail(voucherId);

    if (!voucher) {
      return new NextResponse("Voucher nebyl nalezen.", { status: 404 });
    }

    const pdfBytes = await generateVoucherPdf(voucher);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${buildVoucherPdfFilename(voucher.code)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  };
}
