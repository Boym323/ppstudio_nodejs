import { AdminRole } from "@/generated/prisma/browser";
import { NextResponse } from "next/server";

import { getVoucherDetail } from "@/features/vouchers/lib/voucher-read-models";
import { buildVoucherPdfFilename, generateVoucherDigitalPdf } from "@/features/vouchers/lib/voucher-pdf";
import { getSession } from "@/lib/auth/session";
import { handleVoucherPdfError } from "@/features/admin/lib/admin-voucher-pdf-error";

type VoucherPdfRouteParams = Promise<{
  voucherId: string;
}>;

type VoucherPdfRouteDependencies = {
  getSession?: typeof getSession;
  getVoucher?: typeof getVoucherDetail;
  generatePdf?: typeof generateVoucherDigitalPdf;
};

export function createAdminVoucherPdfRoute(dependencies: VoucherPdfRouteDependencies = {}) {
  const getSessionFn = dependencies.getSession ?? getSession;
  const getVoucher = dependencies.getVoucher ?? getVoucherDetail;
  const generatePdf = dependencies.generatePdf ?? generateVoucherDigitalPdf;

  return async function AdminVoucherPdfRoute(
    _request: Request,
    { params }: { params: VoucherPdfRouteParams },
  ) {
    const session = await getSessionFn();

    if (!session) {
      return new NextResponse("Nejste přihlášeni.", { status: 401 });
    }

    if (session.role !== AdminRole.OWNER && session.role !== AdminRole.SALON) {
      return new NextResponse("Nemáte oprávnění stáhnout PDF voucheru.", { status: 403 });
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
        "Content-Disposition": `attachment; filename="${buildVoucherPdfFilename(voucher.code)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  };
}
