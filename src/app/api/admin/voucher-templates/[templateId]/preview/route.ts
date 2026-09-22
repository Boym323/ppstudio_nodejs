import { AdminRole } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

import { getVoucherTemplateById } from "@/features/vouchers/lib/voucher-template-repository";
import { readVoucherTemplatePreview } from "@/features/vouchers/lib/voucher-template-storage";
import { getSession } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Nejste přihlášeni.", { status: 401 });
  if (session.role !== AdminRole.OWNER) {
    return new NextResponse("Nemáte oprávnění.", { status: 403 });
  }

  const template = await getVoucherTemplateById((await params).templateId);
  if (!template?.previewStoragePath) {
    return new NextResponse("Náhled šablony nebyl nalezen.", { status: 404 });
  }

  try {
    const file = await readVoucherTemplatePreview(template.previewStoragePath);
    if (!file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      return new NextResponse("Náhled šablony nebyl nalezen.", { status: 404 });
    }
    return new NextResponse(Uint8Array.from(file), {
      headers: {
        "Content-Type": "image/png",
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
