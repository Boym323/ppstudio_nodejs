import { AdminRole } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

import { getVoucherTemplateById, loadVoucherTemplateMaster } from "@/features/vouchers/lib/voucher-template-repository";
import { getSession } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Nejste přihlášeni.", { status: 401 });
  if (session.role !== AdminRole.OWNER && session.role !== AdminRole.SALON) {
    return new NextResponse("Nemáte oprávnění.", { status: 403 });
  }

  const template = await getVoucherTemplateById((await params).templateId);
  if (!template?.masterStoragePath || !template.masterSha256) {
    return new NextResponse("Náhled šablony nebyl nalezen.", { status: 404 });
  }

  try {
    const file = await loadVoucherTemplateMaster(template);
    return new NextResponse(Uint8Array.from(file), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch {
    return new NextResponse("Náhled šablony nebyl nalezen.", { status: 404 });
  }
}
