"use server";

import { EmailLogStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  buildResendEmailLogCreateInput,
  resolveEmailLogRecipientFromContact,
} from "@/features/admin/actions/email-log-action-helpers";
import { requireAdminArea } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const emailLogActionSchema = z.object({
  emailLogId: z.string().trim().min(1).max(64),
});

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

async function loadOwnerEmailLog(formData: FormData) {
  await requireAdminArea("owner");

  const parsed = emailLogActionSchema.safeParse({
    emailLogId: readFormString(formData, "emailLogId"),
  });

  if (!parsed.success) {
    return null;
  }

  return prisma.emailLog.findUnique({
    where: { id: parsed.data.emailLogId },
    include: {
      client: {
        select: {
          id: true,
          email: true,
        },
      },
      booking: {
        select: {
          id: true,
          clientEmailSnapshot: true,
        },
      },
    },
  });
}

type OwnerEmailLog = NonNullable<Awaited<ReturnType<typeof loadOwnerEmailLog>>>;

async function createResendEmailLog(emailLog: OwnerEmailLog) {
  const recipientEmail = resolveEmailLogRecipientFromContact({
    clientEmail: emailLog.client?.email ?? null,
    bookingClientEmailSnapshot: emailLog.booking?.clientEmailSnapshot ?? null,
  });
  if (!recipientEmail) {
    return null;
  }

  return prisma.emailLog.create({
    data: buildResendEmailLogCreateInput({
      resendOfId: emailLog.id,
      resendRootId: emailLog.resendRootId ?? emailLog.id,
      bookingId: emailLog.bookingId,
      clientId: emailLog.clientId,
      actionTokenId: emailLog.actionTokenId,
      type: emailLog.type,
      recipientEmail,
      subject: emailLog.subject,
      templateKey: emailLog.templateKey,
      payload: emailLog.payload,
    }),
  });
}

function revalidateResendPaths(sourceEmailLogId: string, resendEmailLogId: string) {
  revalidatePath("/admin/email-logy");
  revalidatePath(`/admin/email-logy/${sourceEmailLogId}`);
  revalidatePath(`/admin/email-logy/${resendEmailLogId}`);
}

export async function retryEmailLogAction(formData: FormData) {
  const emailLog = await loadOwnerEmailLog(formData);

  if (!emailLog || emailLog.status === EmailLogStatus.SENT || emailLog.processingStartedAt) {
    redirect("/admin/email-logy");
  }

  // Terminální failure je neměnný auditní záznam. Další ruční pokus proto
  // vždy zakládá nový explicitní resend log místo návratu původního do fronty.
  if (emailLog.status === EmailLogStatus.FAILED) {
    const createdEmailLog = await createResendEmailLog(emailLog);
    if (!createdEmailLog) {
      redirect(`/admin/email-logy/${emailLog.id}?flash=resend-missing-recipient`);
    }

    revalidateResendPaths(emailLog.id, createdEmailLog.id);
    redirect(`/admin/email-logy/${createdEmailLog.id}?flash=resend-success`);
  }

  await prisma.emailLog.update({
    where: {
      id: emailLog.id,
    },
    data: {
      status: EmailLogStatus.PENDING,
      nextAttemptAt: new Date(),
      processingStartedAt: null,
      processingToken: null,
      errorMessage: null,
    },
  });

  revalidatePath("/admin/email-logy");
  revalidatePath(`/admin/email-logy/${emailLog.id}`);
  redirect(`/admin/email-logy/${emailLog.id}?flash=retry-success`);
}

export async function releaseStuckEmailLogAction(formData: FormData) {
  const emailLog = await loadOwnerEmailLog(formData);

  if (
    !emailLog ||
    emailLog.status !== EmailLogStatus.PENDING ||
    emailLog.processingStartedAt === null
  ) {
    redirect("/admin/email-logy");
  }

  await prisma.emailLog.update({
    where: {
      id: emailLog.id,
    },
    data: {
      status: EmailLogStatus.PENDING,
      nextAttemptAt: new Date(),
      processingStartedAt: null,
      processingToken: null,
    },
  });

  revalidatePath("/admin/email-logy");
  revalidatePath(`/admin/email-logy/${emailLog.id}`);
  redirect(`/admin/email-logy/${emailLog.id}?flash=release-success`);
}

export async function resendEmailLogAction(formData: FormData) {
  const emailLog = await loadOwnerEmailLog(formData);

  if (!emailLog || emailLog.processingStartedAt) {
    redirect("/admin/email-logy");
  }

  const createdEmailLog = await createResendEmailLog(emailLog);
  if (!createdEmailLog) {
    redirect(`/admin/email-logy/${emailLog.id}?flash=resend-missing-recipient`);
  }

  revalidateResendPaths(emailLog.id, createdEmailLog.id);
  redirect(`/admin/email-logy/${createdEmailLog.id}?flash=resend-success`);
}
