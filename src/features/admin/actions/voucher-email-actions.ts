"use server";

import { AdminRole, EmailLogStatus, EmailLogType, VoucherStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "@/config/env";
import { type AdminArea } from "@/config/navigation";
import { type SendVoucherEmailActionState } from "@/features/admin/actions/send-voucher-email-action-state";
import {
  getAdminVoucherHref,
  getAdminVouchersHref,
} from "@/features/admin/lib/admin-vouchers";
import { getEffectiveVoucherStatus } from "@/features/vouchers/lib/voucher-format";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const sendVoucherEmailSchema = z.object({
  voucherId: z.string().trim().min(1, "Voucher je potřeba vybrat."),
  recipientEmail: z.email("Zadejte platný e-mail příjemce.").max(254, "E-mail je příliš dlouhý."),
  subject: z.string().trim().min(1, "Doplňte předmět e-mailu.").max(160, "Předmět je příliš dlouhý."),
  message: z.string().trim().min(1, "Doplňte krátkou zprávu.").max(2000, "Zpráva je příliš dlouhá."),
});

type QueueVoucherEmailResult =
  | {
      status: "success";
      emailDeliveryStatus: "queued" | "logged";
      voucherId: string;
      voucherCode: string;
    }
  | {
      status: "error";
      formError: string;
      fieldErrors?: Partial<Record<"voucherId" | "recipientEmail" | "subject" | "message", string>>;
    };

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function readArea(value: string): AdminArea {
  return value === "salon" ? "salon" : "owner";
}

function resolveActionArea(role: AdminRole, requestedArea: AdminArea): AdminArea {
  if (role === AdminRole.SALON) {
    return "salon";
  }

  return requestedArea;
}

function canSendVoucherByStatus(status: VoucherStatus) {
  return status === VoucherStatus.ACTIVE || status === VoucherStatus.PARTIALLY_REDEEMED;
}

export async function queueVoucherEmailLog(input: unknown, now = new Date()): Promise<QueueVoucherEmailResult> {
  const parsed = sendVoucherEmailSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář je potřeba ještě doplnit nebo opravit.",
      fieldErrors: {
        voucherId: fieldErrors.voucherId?.[0],
        recipientEmail: fieldErrors.recipientEmail?.[0],
        subject: fieldErrors.subject?.[0],
        message: fieldErrors.message?.[0],
      },
    };
  }

  const voucher = await prisma.voucher.findUnique({
    where: { id: parsed.data.voucherId },
    select: {
      id: true,
      code: true,
      status: true,
      validUntil: true,
    },
  });

  if (!voucher) {
    return {
      status: "error",
      formError: "Voucher nebyl nalezen.",
      fieldErrors: {
        voucherId: "Voucher už v evidenci neexistuje.",
      },
    };
  }

  const effectiveStatus = getEffectiveVoucherStatus(
    {
      status: voucher.status,
      validUntil: voucher.validUntil,
    },
    now,
  );

  if (!canSendVoucherByStatus(effectiveStatus)) {
    return {
      status: "error",
      formError: "Voucher v tomto stavu nelze odeslat e-mailem.",
    };
  }

  const inBackgroundMode = env.EMAIL_DELIVERY_MODE === "background";

  await prisma.emailLog.create({
    data: {
      type: EmailLogType.VOUCHER_SENT,
      status: inBackgroundMode ? undefined : EmailLogStatus.SENT,
      attemptCount: inBackgroundMode ? undefined : 1,
      nextAttemptAt: inBackgroundMode ? now : undefined,
      processingStartedAt: null,
      processingToken: null,
      recipientEmail: parsed.data.recipientEmail,
      subject: parsed.data.subject,
      templateKey: "voucher-sent-v1",
      payload: {
        voucherId: voucher.id,
        message: parsed.data.message,
      },
      provider: inBackgroundMode ? undefined : "log",
      sentAt: inBackgroundMode ? undefined : now,
    },
  });

  return {
    status: "success",
    emailDeliveryStatus: inBackgroundMode ? "queued" : "logged",
    voucherId: voucher.id,
    voucherCode: voucher.code,
  };
}

export async function sendVoucherEmailAction(
  _previousState: SendVoucherEmailActionState,
  formData: FormData,
): Promise<SendVoucherEmailActionState> {
  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const area = resolveActionArea(session.role, readArea(readFormString(formData, "area")));

  try {
    const result = await queueVoucherEmailLog({
      voucherId: readFormString(formData, "voucherId"),
      recipientEmail: readFormString(formData, "recipientEmail"),
      subject: readFormString(formData, "subject"),
      message: readFormString(formData, "message"),
    });

    if (result.status === "error") {
      return {
        status: "error",
        formError: result.formError,
        fieldErrors: result.fieldErrors,
      };
    }

    revalidatePath(getAdminVoucherHref(area, result.voucherId));
    revalidatePath(getAdminVouchersHref(area));
    revalidatePath("/admin/email-logy");

    return {
      status: "success",
      successMessage:
        result.emailDeliveryStatus === "queued"
          ? "Voucher e-mail byl zařazen do fronty. Worker ho odešle při dalším průchodu."
          : "Voucher e-mail byl úspěšně zalogovaný v log režimu.",
    };
  } catch (error) {
    console.error("Failed to queue voucher email", error);

    return {
      status: "error",
      formError: "Voucher e-mail se teď nepodařilo odeslat. Zkuste to prosím znovu.",
    };
  }
}
