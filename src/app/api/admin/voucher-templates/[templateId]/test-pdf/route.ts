import { AdminRole, VoucherType } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

import { generateResolvedVoucherPrintPdf, buildVoucherPrintPdfFilename } from "@/features/vouchers/lib/voucher-pdf";
import { voucherTemplateLayoutSchema } from "@/features/vouchers/lib/voucher-template-layout";
import { renderVoucherTemplatePreview } from "@/features/vouchers/lib/voucher-template-preview";
import { VOUCHER_TEMPLATE_TEST_DATA } from "@/features/vouchers/lib/voucher-template-test-data";
import { requireVoucherTemplateById, resolveVoucherTemplate } from "@/features/vouchers/lib/voucher-template-repository";
import { getSession } from "@/lib/auth/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Nejste přihlášeni.", { status: 401 });
  if (session.role !== AdminRole.OWNER) return new NextResponse("Nemáte oprávnění.", { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Požadavek není platný JSON.", { status: 400 });
  }

  const layout = voucherTemplateLayoutSchema.safeParse((body as { layout?: unknown })?.layout);
  if (!layout.success) return new NextResponse(layout.error.issues[0]?.message ?? "Layout šablony není platný.", { status: 400 });

  try {
    const template = await requireVoucherTemplateById((await params).templateId);
    if (template.status !== "DRAFT") return new NextResponse("Zkušební PDF lze stáhnout pouze z draftu.", { status: 409 });

    const resolved = await resolveVoucherTemplate(template);
    const voucher = {
      templateId: template.id,
      templateKey: template.key,
      code: VOUCHER_TEMPLATE_TEST_DATA.code,
      type: VoucherType.VALUE,
      originalValueCzk: VOUCHER_TEMPLATE_TEST_DATA.valueCzk,
      remainingValueCzk: VOUCHER_TEMPLATE_TEST_DATA.valueCzk,
      serviceNameSnapshot: null,
      servicePriceSnapshotCzk: null,
      validUntil: new Date(VOUCHER_TEMPLATE_TEST_DATA.validUntilIso),
    } as Parameters<typeof generateResolvedVoucherPrintPdf>[0];
    const pdf = await generateResolvedVoucherPrintPdf(voucher, { ...resolved, layout: layout.data }, { failOnTextOverflow: true });

    // Editor needs the very same composition order as the downloadable PDF.
    // In particular, PDF masters can contain artwork above the QR area which
    // cannot be faithfully reproduced by drawing browser overlays over a
    // rasterised master preview.
    if (new URL(request.url).searchParams.get("format") === "preview") {
      const preview = await renderVoucherTemplatePreview(Buffer.from(pdf));

      return new NextResponse(Uint8Array.from(preview), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return new NextResponse(Uint8Array.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${buildVoucherPrintPdfFilename(voucher.code)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Voucher template test PDF generation failed", { templateId: (await params).templateId, error });
    return new NextResponse("Zkušební PDF se nepodařilo vygenerovat. Zkontrolujte layout a fitting textu.", { status: 422 });
  }
}
