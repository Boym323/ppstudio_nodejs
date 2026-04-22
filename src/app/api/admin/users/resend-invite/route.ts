import { AdminRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  issueAdminInviteToken,
  markAdminUserAsInvited,
  sendAdminInviteEmail,
} from "@/features/admin/lib/admin-user-invite";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

const resendInviteSchema = z.object({
  userId: z.string().trim().min(1).max(64),
});

export async function POST(request: Request) {
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
    await markAdminUserAsInvited(user.id);
    const inviteUrl = await issueAdminInviteToken(user.id);
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
