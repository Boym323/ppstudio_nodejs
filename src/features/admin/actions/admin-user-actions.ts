"use server";

import { AdminRole, AdminUserAuditOperation, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { type AdminUserResendInviteActionState } from "@/features/admin/actions/update-admin-user-resend-invite-action-state";
import { type AdminUserAccessActionState } from "@/features/admin/actions/update-admin-user-access-action-state";
import {
  issueAdminInviteToken,
  reissueAdminInviteTokenWithAudit,
  sendAdminInviteEmail,
} from "@/features/admin/lib/admin-user-invite";
import {
  changeAdminUserRoleSchema,
  resendAdminUserInviteSchema,
  saveAdminUserSchema,
  setAdminUserActiveSchema,
} from "@/features/admin/lib/admin-user-validation";
import { isMissingInvitedAtColumnError } from "@/features/admin/lib/admin-user-db";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";
import {
  LAST_ACTIVE_OWNER_MESSAGE,
  updateAdminUserWithOwnerProtection,
} from "@/features/admin/lib/admin-owner-protection";
import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover";
import { prisma } from "@/lib/prisma";
import { buildAuditChange } from "@/features/admin/lib/audit-change";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function revalidateAdminUserPaths() {
  for (const path of ["/admin", "/admin/uzivatele"]) {
    revalidatePath(path);
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function roleLabel(role: AdminRole) {
  return role === AdminRole.OWNER ? "OWNER" : "SALON";
}

export async function saveAdminUserAccessAction(
  _previousState: AdminUserAccessActionState,
  formData: FormData,
): Promise<AdminUserAccessActionState> {
  const session = await requireAdminSectionAccess("owner", "uzivatele");

  const parsed = saveAdminUserSchema.safeParse({
    userId: readFormString(formData, "userId"),
    name: readFormString(formData, "name"),
    email: normalizeEmail(readFormString(formData, "email")),
    role: readFormString(formData, "role"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
      fieldErrors: {
        name: fieldErrors.name?.[0],
        email: fieldErrors.email?.[0],
        role: fieldErrors.role?.[0],
      },
    };
  }

  const userId = parsed.data.userId || null;
  const role = parsed.data.role as AdminRole;

  const existingByEmail = await prisma.adminUser.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (existingByEmail && existingByEmail.id !== userId) {
    return {
      status: "error",
      formError: "Tento e-mail už v přístupech existuje.",
      fieldErrors: {
        email: "Použijte jiný e-mail nebo upravte existující záznam.",
      },
    };
  }

  if (userId) {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.adminUser.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      });
      if (!existing) return false;
      const auditChange = buildAuditChange(
        { name: existing.name, email: existing.email },
        { name: parsed.data.name, email: parsed.data.email },
      );
      if (!auditChange) return true;

      await tx.adminUser.update({
        where: { id: userId },
        data: { name: parsed.data.name, email: parsed.data.email },
      });
      await tx.adminUserAuditEvent.create({
        data: {
          targetUserId: userId,
          actorUserId: session.sub,
          operation: AdminUserAuditOperation.UPDATE_PROFILE,
          ...auditChange,
        },
      });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!updated) {
      return {
        status: "error",
        formError: "Uživatel už v systému neexistuje.",
      };
    }

    revalidateAdminUserPaths();

    return {
      status: "success",
      successMessage: "Údaje uživatele jsou uložené.",
    };
  }

  let inviteSent = true;
  let createdUserId = "";
  let missingInviteColumnFallback = false;

  try {
    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.create({
        data: { name: parsed.data.name, email: parsed.data.email, role, isActive: true, invitedAt: new Date(), passwordHash: null },
        select: { id: true },
      });
      await tx.adminUserAuditEvent.create({
        data: {
          targetUserId: user.id,
          actorUserId: session.sub,
          operation: AdminUserAuditOperation.CREATE,
          before: {},
          after: { name: parsed.data.name, email: parsed.data.email, role, isActive: true },
        },
      });
      return user;
    });
    createdUserId = createdUser.id;
  } catch (error) {
    if (!isMissingInvitedAtColumnError(error)) {
      throw error;
    }

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.create({
        data: { name: parsed.data.name, email: parsed.data.email, role, isActive: true, passwordHash: null },
        select: { id: true },
      });
      await tx.adminUserAuditEvent.create({
        data: {
          targetUserId: user.id,
          actorUserId: session.sub,
          operation: AdminUserAuditOperation.CREATE,
          before: {},
          after: { name: parsed.data.name, email: parsed.data.email, role, isActive: true },
        },
      });
      return user;
    });
    createdUserId = createdUser.id;
    missingInviteColumnFallback = true;
  }

  try {
    const inviteUrl = await issueAdminInviteToken(createdUserId);
    await sendAdminInviteEmail({
      recipientEmail: parsed.data.email,
      recipientName: parsed.data.name,
      role,
      inviteUrl,
      reason: "invite",
    });
  } catch (error) {
    inviteSent = false;
    console.error("Admin invite email failed", {
      email: parsed.data.email,
      error,
    });

    await sendOwnerSystemErrorPushover({
      title: "PP Studio - systemova chyba",
      message: "Zalozeni admin pristupu probehlo, ale pozvankovy email se nepodarilo odeslat.",
      context: {
        contextId: createdUserId || `admin-invite:${parsed.data.email}`,
        adminUserId: createdUserId || null,
      },
      error,
    });
  }

  revalidateAdminUserPaths();

  return {
    status: "success",
    successMessage: missingInviteColumnFallback
      ? "Přístup je založený a pozvánka byla odeslaná. Pro stav „Pozvánka čeká“ ještě aplikujte migraci `invitedAt`."
      : inviteSent
        ? `Pozvánka pro roli ${roleLabel(role)} je připravená a odeslaná na e-mail.`
        : `Přístup pro roli ${roleLabel(role)} je připravený, ale e-mail se nepodařilo odeslat.`,
  };
}

export async function changeAdminUserRoleAction(formData: FormData): Promise<void> {
  const session = await requireAdminSectionAccess("owner", "uzivatele");

  const parsed = changeAdminUserRoleSchema.safeParse({
    userId: readFormString(formData, "userId"),
    role: readFormString(formData, "role"),
  });

  if (!parsed.success) {
    return;
  }

  const result = await updateAdminUserWithOwnerProtection({
    userId: parsed.data.userId,
    actorUserId: session.sub,
    role: parsed.data.role as AdminRole,
  });

  if (result === "last-active-owner") {
    console.warn(LAST_ACTIVE_OWNER_MESSAGE, { userId: parsed.data.userId });
    return;
  }

  revalidateAdminUserPaths();
}

export async function setAdminUserActiveAction(formData: FormData): Promise<void> {
  const session = await requireAdminSectionAccess("owner", "uzivatele");

  const parsed = setAdminUserActiveSchema.safeParse({
    userId: readFormString(formData, "userId"),
    nextIsActive: readFormString(formData, "nextIsActive"),
  });

  if (!parsed.success) {
    return;
  }

  const result = await updateAdminUserWithOwnerProtection({
    userId: parsed.data.userId,
    actorUserId: session.sub,
    isActive: parsed.data.nextIsActive,
  });

  if (result === "last-active-owner") {
    console.warn(LAST_ACTIVE_OWNER_MESSAGE, { userId: parsed.data.userId });
    return;
  }

  revalidateAdminUserPaths();
}

export async function resendAdminUserInviteAction(
  _previousState: AdminUserResendInviteActionState,
  formData: FormData,
): Promise<AdminUserResendInviteActionState> {
  const session = await requireAdminSectionAccess("owner", "uzivatele");

  const parsed = resendAdminUserInviteSchema.safeParse({
    userId: readFormString(formData, "userId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Nepodařilo se připravit opětovné odeslání pozvánky.",
    };
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
    return {
      status: "error",
      message: "Uživatel už v systému neexistuje.",
    };
  }

  try {
    const { inviteUrl } = await reissueAdminInviteTokenWithAudit({ userId: user.id, actorUserId: session.sub });
    await sendAdminInviteEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      role: user.role,
      inviteUrl,
      reason: "resend",
    });
  } catch (error) {
    console.error("Admin invite resend email failed", {
      email: user.email,
      error,
    });

    await sendOwnerSystemErrorPushover({
      title: "PP Studio - systemova chyba",
      message: "Opetovne odeslani admin pozvanky selhalo.",
      context: {
        contextId: user.id,
        adminUserId: user.id,
      },
      error,
    });

    return {
      status: "error",
      message:
        "Pozvánku se teď nepodařilo odeslat. Zkontrolujte SMTP nastavení nebo zkuste akci znovu.",
    };
  }

  revalidateAdminUserPaths();

  return {
    status: "success",
    message: "Pozvánka byla znovu odeslaná. Zkontrolujte i složku spam/hromadné.",
  };
}
