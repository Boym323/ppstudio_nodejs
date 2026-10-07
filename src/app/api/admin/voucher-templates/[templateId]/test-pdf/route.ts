import { AdminRole, VoucherType } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

import { generateResolvedVoucherPrintPdf, buildVoucherPrintPdfFilename } from "@/features/vouchers/lib/voucher-pdf";
import { voucherTemplateLayoutSchema } from "@/features/vouchers/lib/voucher-template-layout";
import { VoucherTemplateError } from "@/features/vouchers/lib/voucher-template-error";
import { renderVoucherTemplatePreview } from "@/features/vouchers/lib/voucher-template-preview";
import { VOUCHER_TEMPLATE_PUBLISH_SERVICE_NAMES, VOUCHER_TEMPLATE_TEST_DATA } from "@/features/vouchers/lib/voucher-template-test-data";
import { requireVoucherTemplateById, resolveVoucherTemplate } from "@/features/vouchers/lib/voucher-template-repository";
import { VOUCHER_VALUE_MAX_CZK } from "@/features/vouchers/lib/voucher-value-limits";
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

  let checkedServiceName: string | null = null;
  try {
    const template = await requireVoucherTemplateById((await params).templateId);
    if (template.status !== "DRAFT") return new NextResponse("Zkušební PDF lze stáhnout pouze z draftu.", { status: 409 });

    const resolved = await resolveVoucherTemplate(template);
    const searchParams = new URL(request.url).searchParams;
    const isServicePreview = searchParams.get("previewType") === "SERVICE";
    const voucher = {
      templateId: template.id,
      templateKey: template.key,
      code: VOUCHER_TEMPLATE_TEST_DATA.code,
      type: isServicePreview ? VoucherType.SERVICE : VoucherType.VALUE,
      originalValueCzk: VOUCHER_TEMPLATE_TEST_DATA.valueCzk,
      remainingValueCzk: isServicePreview ? null : VOUCHER_TEMPLATE_TEST_DATA.valueCzk,
      serviceNameSnapshot: isServicePreview ? VOUCHER_TEMPLATE_TEST_DATA.service.normal : null,
      servicePriceSnapshotCzk: isServicePreview ? VOUCHER_TEMPLATE_TEST_DATA.valueCzk : null,
      validUntil: new Date(VOUCHER_TEMPLATE_TEST_DATA.validUntilIso),
    } as Parameters<typeof generateResolvedVoucherPrintPdf>[0];
    checkedServiceName = voucher.serviceNameSnapshot;
    const pdf = await generateResolvedVoucherPrintPdf(voucher, { ...resolved, layout: layout.data }, { failOnTextOverflow: true });

    // Editor needs the very same composition order as the downloadable PDF.
    // In particular, PDF masters can contain artwork above the QR area which
    // cannot be faithfully reproduced by drawing browser overlays over a
    // rasterised master preview.
    if (searchParams.get("format") === "preview") {
      // Validate the publication text scenarios even when the editor displays
      // the other voucher type or a short service name.
      if (template.allowedTypes.includes(VoucherType.VALUE)) {
        checkedServiceName = null;
        await generateResolvedVoucherPrintPdf({ ...voucher, type: VoucherType.VALUE, originalValueCzk: VOUCHER_VALUE_MAX_CZK, remainingValueCzk: VOUCHER_VALUE_MAX_CZK, serviceNameSnapshot: null, servicePriceSnapshotCzk: null }, { ...resolved, layout: layout.data }, { failOnTextOverflow: true });
      }
      if (template.allowedTypes.includes(VoucherType.SERVICE)) {
        for (const serviceNameSnapshot of VOUCHER_TEMPLATE_PUBLISH_SERVICE_NAMES) {
          checkedServiceName = serviceNameSnapshot;
          await generateResolvedVoucherPrintPdf({ ...voucher, type: VoucherType.SERVICE, remainingValueCzk: null, serviceNameSnapshot, servicePriceSnapshotCzk: VOUCHER_TEMPLATE_TEST_DATA.valueCzk }, { ...resolved, layout: layout.data }, { failOnTextOverflow: true });
        }
      }
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
    if (error instanceof VoucherTemplateError) {
      const safeMessages = {
        unknown_template: "Vzhled voucheru není dostupný.",
        invalid_master_page_size: "Grafika šablony nemá správný rozměr stránky.",
        invalid_print_pdf: "Finální tiskové PDF neprošlo interní kontrolou.",
      };
      return NextResponse.json({
        code: error.code,
        ...(error.code === "text_overflow" && error.message.includes("„Služba“") && checkedServiceName ? { sampleText: checkedServiceName } : {}),
        message: error.code === "text_overflow" ? error.message : safeMessages[error.code],
      }, { status: 422, headers: { "Cache-Control": "private, no-store" } });
    }
    return new NextResponse("Zkušební PDF se nepodařilo vygenerovat. Zkontrolujte layout a fitting textu.", { status: 422 });
  }
}
