import { AdminRole, VoucherType } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

import { generateResolvedVoucherPrintPdf, buildVoucherPrintPdfFilename } from "@/features/vouchers/lib/voucher-pdf";
import { voucherTemplateLayoutSchema } from "@/features/vouchers/lib/voucher-template-layout";
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
      code: "TEST-2026-ABCDEF",
      type: VoucherType.VALUE,
      originalValueCzk: 1500,
      remainingValueCzk: 1500,
      serviceNameSnapshot: null,
      servicePriceSnapshotCzk: null,
      validUntil: new Date("2027-12-31T22:59:59.999Z"),
    } as Parameters<typeof generateResolvedVoucherPrintPdf>[0];
    const pdf = await generateResolvedVoucherPrintPdf(voucher, { ...resolved, layout: layout.data }, { failOnTextOverflow: true });

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
