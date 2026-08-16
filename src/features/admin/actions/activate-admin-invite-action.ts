"use server";

import { z } from "zod";
import { headers } from "next/headers";

import { type AdminInviteActivationActionState } from "@/features/admin/actions/update-admin-invite-activation-action-state";
import { hashAdminInviteToken } from "@/features/admin/lib/admin-invite-token";
import {
  consumeAdminInviteToken,
  findAdminInviteTokenWithUserByHash,
} from "@/features/admin/lib/admin-invite-token-db";
import {
  getAdminInviteActivationAttemptMetadata,
  consumeAdminInviteActivationRateLimit,
  type AdminInviteActivationAuditOutcome,
  writeAdminInviteActivationAttemptLog,
} from "@/features/admin/lib/admin-invite-activation-rate-limit";
import { hashPassword } from "@/lib/auth/password";

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

async function getActivationRequestHeaders() {
  try {
    return await headers();
  } catch (error) {
    if (process.env.NODE_ENV === "test") {
      return new Headers();
    }

    throw error;
  }
}

type InvitePrecheckResult = "valid" | Exclude<AdminInviteActivationAuditOutcome, "SUCCESS" | "RATE_LIMITED">;

async function precheckAdminInviteToken(tokenHash: string, now: Date): Promise<InvitePrecheckResult> {
  const token = await findAdminInviteTokenWithUserByHash(tokenHash);

  if (!token || !token.user) {
    return "INVALID";
  }

  if (token.usedAt || token.revokedAt) {
    return "ALREADY_USED";
  }

  if (token.expiresAt <= now) {
    return "EXPIRED";
  }

  if (!token.user.isActive) {
    return "USER_INACTIVE";
  }

  return "valid";
}

function getInviteActivationError(result: AdminInviteActivationAuditOutcome) {
  if (result === "RATE_LIMITED") {
    return "Příliš mnoho pokusů o aktivaci. Zkuste to prosím za chvíli znovu.";
  }

  if (result === "EXPIRED") {
    return "Pozvánka vypršela. Požádejte o nové zaslání pozvánky.";
  }

  if (result === "ALREADY_USED") {
    return "Tato pozvánka už byla použitá. Požádejte o novou.";
  }

  return "Pozvánka není platná. Požádejte o novou.";
}

export async function activateAdminInviteAction(
  _previousState: AdminInviteActivationActionState,
  formData: FormData,
): Promise<AdminInviteActivationActionState> {
  const attemptMetadata = getAdminInviteActivationAttemptMetadata(await getActivationRequestHeaders());
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

  const rateLimit = await consumeAdminInviteActivationRateLimit(attemptMetadata.ipHash);
  const ipAttempts = rateLimit.attempts;

  if (!rateLimit.allowed) {
    await writeAdminInviteActivationAttemptLog({
      auditOutcome: "RATE_LIMITED",
      ...attemptMetadata,
      metadata: { ipAttempts },
    });

    return { status: "error", formError: getInviteActivationError("RATE_LIMITED") };
  }

  const now = new Date();
  const tokenHash = hashAdminInviteToken(parsed.data.token);
  const precheckResult = await precheckAdminInviteToken(tokenHash, now);

  if (precheckResult !== "valid") {
    await writeAdminInviteActivationAttemptLog({
      auditOutcome: precheckResult,
      ...attemptMetadata,
    });

    return { status: "error", formError: getInviteActivationError(precheckResult) };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const result = await consumeAdminInviteToken({
    tokenHash,
    passwordHash,
    now,
  });

  const auditOutcome: AdminInviteActivationAuditOutcome = result === "activated"
    ? "SUCCESS"
    : result === "invalid"
      ? "INVALID"
      : result === "already-used"
        ? "ALREADY_USED"
        : result === "expired"
          ? "EXPIRED"
          : "USER_INACTIVE";
  await writeAdminInviteActivationAttemptLog({
    auditOutcome,
    ...attemptMetadata,
  });

  if (result !== "activated") {
    return { status: "error", formError: getInviteActivationError(auditOutcome) };
  }

  return {
    status: "success",
    successMessage: "Heslo je nastavené. Můžete pokračovat na přihlášení.",
  };
}
