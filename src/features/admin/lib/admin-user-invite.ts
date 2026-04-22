import "server-only";

import { AdminRole } from "@prisma/client";

import { env } from "@/config/env";
import {
  buildAdminInviteToken,
  buildAdminInviteUrl,
} from "@/features/admin/lib/admin-invite-token";
import {
  createAdminInviteTokenRecord,
  revokeActiveAdminInviteTokens,
} from "@/features/admin/lib/admin-invite-token-db";
import { isMissingInvitedAtColumnError } from "@/features/admin/lib/admin-user-db";
import { sendEmail } from "@/lib/email/provider";
import { prisma } from "@/lib/prisma";
import { getPublicSalonProfile } from "@/lib/site-settings";

function getInviteCopy(role: AdminRole) {
  if (role === AdminRole.OWNER) {
    return {
      roleSummary: "Role OWNER: plný přístup do celé administrace.",
      roleSummaryHtml: "Role <strong>OWNER</strong>: plný přístup do celé administrace.",
    };
  }

  return {
    roleSummary: "Role SALON: běžná každodenní práce v salonu.",
    roleSummaryHtml: "Role <strong>SALON</strong>: běžná každodenní práce v salonu.",
  };
}

export async function sendAdminInviteEmail({
  recipientEmail,
  recipientName,
  role,
  inviteUrl,
  reason,
}: {
  recipientEmail: string;
  recipientName: string;
  role: AdminRole;
  inviteUrl: string;
  reason: "invite" | "resend";
}) {
  const salonProfile = await getPublicSalonProfile().catch(() => ({
    name: env.NEXT_PUBLIC_APP_NAME,
    phone: "+420 777 000 000",
    email: env.ADMIN_OWNER_EMAIL,
  }));
  const copy = getInviteCopy(role);
  const subject =
    reason === "resend"
      ? `${salonProfile.name}: pripomenuti pozvanky do administrace`
      : `${salonProfile.name}: pozvanka do administrace`;

  const text = [
    `Dobry den ${recipientName},`,
    "",
    `byla vam pripravena ${reason === "resend" ? "znovu" : ""} pozvanka do administrace ${salonProfile.name}.`
      .replace("  ", " "),
    copy.roleSummary,
    "",
    `Nastaveni hesla: ${inviteUrl}`,
    "",
    "Po nastaveni hesla se prihlaste do administrace stejnym e-mailem.",
    `Prihlaseni: ${env.NEXT_PUBLIC_APP_URL}/admin/prihlaseni`,
    "",
    "Pokud potrebujete upresnit pristup, kontaktujte majitele studia.",
    `Kontakt: ${salonProfile.email}${salonProfile.phone ? ` | ${salonProfile.phone}` : ""}`,
  ].join("\n");

  const html = `
    <div style="background:#f7f1eb;padding:24px 16px;font-family:Arial,sans-serif;color:#2e241f;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid rgba(33,23,20,0.08);">
        <p style="margin:0;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9e7f65;">${salonProfile.name}</p>
        <h1 style="margin:14px 0 8px;font-size:28px;line-height:1.2;font-family:Georgia,serif;color:#1f1714;">Pozvanka do administrace</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#5b4c44;">Dobry den ${recipientName},</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#5b4c44;">Byla vam ${reason === "resend" ? "znovu " : ""}pripravena pozvanka do administrace ${salonProfile.name}.</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#1f1714;">${copy.roleSummaryHtml}</p>
        <div style="margin:22px 0;padding:16px;border:1px solid rgba(33,23,20,0.08);border-radius:14px;background:#fbf7f3;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#9e7f65;">Nastaveni hesla</p>
          <p style="margin:0;font-size:14px;line-height:1.7;"><a href="${inviteUrl}" style="color:#1f1714;">${inviteUrl}</a></p>
        </div>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#5b4c44;">Po nastaveni hesla se prihlaste do administrace stejnym e-mailem.</p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#5b4c44;">Pokud potrebujete upresnit pristup, kontaktujte majitele studia.</p>
        <p style="margin:10px 0 0;font-size:14px;line-height:1.7;color:#5b4c44;">
          <a href="mailto:${salonProfile.email}" style="color:#1f1714;">${salonProfile.email}</a>${salonProfile.phone ? ` | <a href="tel:${salonProfile.phone}" style="color:#1f1714;">${salonProfile.phone}</a>` : ""}
        </p>
      </div>
    </div>
  `.trim();

  await sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
  });
}

export async function issueAdminInviteToken(userId: string) {
  const token = buildAdminInviteToken();
  const now = new Date();

  await revokeActiveAdminInviteTokens(userId, now);
  await createAdminInviteTokenRecord({
    userId,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt,
  });

  return buildAdminInviteUrl(token.rawToken);
}

export async function markAdminUserAsInvited(userId: string) {
  try {
    await prisma.adminUser.update({
      where: { id: userId },
      data: {
        invitedAt: new Date(),
        isActive: true,
      },
    });
  } catch (error) {
    if (!isMissingInvitedAtColumnError(error)) {
      throw error;
    }

    await prisma.adminUser.update({
      where: { id: userId },
      data: {
        isActive: true,
      },
    });
  }
}
