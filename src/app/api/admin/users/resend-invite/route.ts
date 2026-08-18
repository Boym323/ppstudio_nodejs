import { AdminRole } from "@/generated/prisma/browser";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  reissueAdminInviteTokenWithAudit,
  sendAdminInviteEmail,
} from "@/features/admin/lib/admin-user-invite";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { isSameOriginAdminRequest } from "@/lib/http/request-origin";
import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover";

const resendInviteSchema = z.object({
  userId: z.string().trim().min(1).max(64),
});

export async function POST(request: Request) {
  if (!isSameOriginAdminRequest(request)) {
    return NextResponse.json(
      {
        status: "error",
        message: "Pozadavek neprosel kontrolou puvodu.",
      },
      { status: 403 },
    );
  }

  const session = await getSession();

  if (!session || session.role !== AdminRole.OWNER) {
    return NextResponse.json(
      {
        status: "error",
        message: "Do teto sekce ma pristup jen owner.",
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = resendInviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        message: "Pozvanku se nepodarilo pripravit.",
      },
      { status: 400 },
    );
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: parsed.data.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      {
        status: "error",
        message: "Uzivatel uz v systemu neexistuje.",
      },
      { status: 404 },
    );
  }

  try {
    const { inviteUrl } = await reissueAdminInviteTokenWithAudit({
      userId: user.id,
      actorUserId: session.sub,
    });
    await sendAdminInviteEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      role: user.role,
      inviteUrl,
      reason: "resend",
    });

    return NextResponse.json({
      status: "success",
      message: "Pozvanka byla znovu odeslana. Zkontrolujte i slozku spam nebo hromadne.",
    });
  } catch (error) {
    console.error("Admin invite resend API failed", {
      userId: user.id,
      email: user.email,
      error,
    });

    await sendOwnerSystemErrorPushover({
      title: "PP Studio - systemova chyba",
      message: "Owner API pro znovuodeslani admin pozvanky selhalo.",
      context: {
        contextId: user.id,
        adminUserId: user.id,
      },
      error,
    });

    return NextResponse.json(
      {
        status: "error",
        message:
          "Pozvanku se ted nepodarilo odeslat. Zkontrolujte SMTP nastaveni nebo zkuste akci znovu.",
      },
      { status: 500 },
    );
  }
}
