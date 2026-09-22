import { NextResponse } from "next/server";

import { VoucherTemplateError } from "@/features/vouchers/lib/voucher-template-error";

type VoucherPdfErrorContext = {
  templateKey?: string | null;
  voucherId?: string;
  batchId?: string;
};

function isMissingAssetError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === "ENOENT";
}

function safePdfErrorResponse(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function handleVoucherPdfError(error: unknown, context: VoucherPdfErrorContext) {
  if (error instanceof VoucherTemplateError) {
    console.error("Voucher PDF template configuration failed", {
      ...context,
      templateKey: error.templateKey ?? context.templateKey,
      error,
    });

    return safePdfErrorResponse("Vzhled voucheru není dostupný. PDF voucheru nyní nelze vygenerovat.", 409);
  }

  if (isMissingAssetError(error)) {
    console.error("Voucher PDF master asset is missing", { ...context, error });

    return safePdfErrorResponse("PDF voucheru nyní nelze vygenerovat.", 503);
  }

  console.error("Voucher PDF render failed", { ...context, error });

  return safePdfErrorResponse("PDF voucheru nyní nelze vygenerovat.", 500);
}
