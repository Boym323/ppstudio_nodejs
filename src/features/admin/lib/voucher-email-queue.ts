import "server-only";

import { EmailAudience, EmailLogStatus, EmailLogType, VoucherStatus } from "@/generated/prisma/browser";
import { z } from "zod";

import { env } from "@/config/env";
import { getEffectiveVoucherStatus } from "@/features/vouchers/lib/voucher-format";
import { isSafeEmailHeaderValue, sanitizeEmailHeaderValue } from "@/lib/email/header";
import { prisma } from "@/lib/prisma";

const sendVoucherEmailSchema = z.object({
  voucherId: z.string().trim().min(1, "Voucher je potřeba vybrat."),
  recipientEmail: z.email("Zadejte platný e-mail příjemce.").max(254, "E-mail je příliš dlouhý."),
  subject: z
    .string()
    .trim()
    .min(1, "Doplňte předmět e-mailu.")
    .max(160, "Předmět je příliš dlouhý.")
    .refine(isSafeEmailHeaderValue, "Předmět nesmí obsahovat nový řádek."),
});

export type QueueVoucherEmailResult =
  | {
      status: "success";
      emailDeliveryStatus: "queued" | "logged";
      voucherId: string;
      voucherCode: string;
    }
  | {
      status: "error";
      formError: string;
      fieldErrors?: Partial<Record<"voucherId" | "recipientEmail" | "subject", string>>;
    };

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
      },
    };
  }

  const voucher = await prisma.voucher.findUnique({
    where: { id: parsed.data.voucherId },
    select: { id: true, code: true, status: true, validFrom: true, validUntil: true },
  });

  if (!voucher) {
    return { status: "error", formError: "Voucher nebyl nalezen.", fieldErrors: { voucherId: "Voucher už v evidenci neexistuje." } };
  }

  const effectiveStatus = getEffectiveVoucherStatus(voucher, now);
  if (!canSendVoucherByStatus(effectiveStatus)) {
    return { status: "error", formError: "Voucher v tomto stavu nelze odeslat e-mailem." };
  }

  const inBackgroundMode = env.EMAIL_DELIVERY_MODE === "background";
  const subject = sanitizeEmailHeaderValue(parsed.data.subject, "Voucher e-mail subject");

  await prisma.emailLog.create({
    data: {
      type: EmailLogType.VOUCHER_SENT,
      audience: EmailAudience.EXTERNAL,
      status: inBackgroundMode ? undefined : EmailLogStatus.SENT,
      attemptCount: inBackgroundMode ? undefined : 1,
      nextAttemptAt: inBackgroundMode ? now : undefined,
      processingStartedAt: null,
      processingToken: null,
      recipientEmail: parsed.data.recipientEmail,
      subject,
      templateKey: "voucher-sent-v1",
      payload: { voucherId: voucher.id },
      provider: inBackgroundMode ? undefined : "log",
      sentAt: inBackgroundMode ? undefined : now,
    },
  });

  return { status: "success", emailDeliveryStatus: inBackgroundMode ? "queued" : "logged", voucherId: voucher.id, voucherCode: voucher.code };
}
