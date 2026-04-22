"use server";

import { z } from "zod";

import { type AdminInviteActivationActionState } from "@/features/admin/actions/update-admin-invite-activation-action-state";
import { hashAdminInviteToken } from "@/features/admin/lib/admin-invite-token";
import {
  findAdminInviteTokenWithUserByHash,
  markAdminInviteTokenUsed,
  revokeOtherAdminInviteTokens,
} from "@/features/admin/lib/admin-invite-token-db";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

const activateAdminInviteSchema = z
  .object({
    token: z.string().trim().min(16).max(256),
    password: z.string().min(8, "Heslo musí mít minimálně 8 znaků.").max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Hesla se neshodují.",
      });
    }
  });

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

export async function activateAdminInviteAction(
  _previousState: AdminInviteActivationActionState,
  formData: FormData,
): Promise<AdminInviteActivationActionState> {
  const parsed = activateAdminInviteSchema.safeParse({
    token: readFormString(formData, "token"),
    password: readFormString(formData, "password"),
    confirmPassword: readFormString(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
      fieldErrors: {
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      },
    };
  }

  const inviteToken = await findAdminInviteTokenWithUserByHash(
    hashAdminInviteToken(parsed.data.token),
  );

  if (!inviteToken || !inviteToken.user) {
    return {
      status: "error",
      formError: "Pozvánka není platná. Požádejte o novou.",
    };
  }

  if (inviteToken.usedAt || inviteToken.revokedAt) {
    return {
      status: "error",
      formError: "Tato pozvánka už byla použitá. Požádejte o novou.",
    };
  }

  if (inviteToken.expiresAt <= new Date()) {
    return {
      status: "error",
      formError: "Pozvánka vypršela. Požádejte o nové zaslání pozvánky.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();

  await prisma.adminUser.update({
    where: {
      id: inviteToken.userId,
    },
    data: {
      passwordHash,
      isActive: true,
    },
  });
  await markAdminInviteTokenUsed(inviteToken.id, now);
  await revokeOtherAdminInviteTokens(inviteToken.userId, inviteToken.id, now);

  return {
    status: "success",
    successMessage: "Heslo je nastavené. Můžete pokračovat na přihlášení.",
  };
}
