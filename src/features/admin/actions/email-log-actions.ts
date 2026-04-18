"use server";

import { EmailLogStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

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
    select: {
      id: true,
      status: true,
      processingStartedAt: true,
    },
  });
}

export async function retryEmailLogAction(formData: FormData) {
  const emailLog = await loadOwnerEmailLog(formData);

  if (!emailLog || emailLog.status === EmailLogStatus.SENT || emailLog.processingStartedAt) {
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
