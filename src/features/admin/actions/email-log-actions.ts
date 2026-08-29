"use server";

import { EmailAudience, EmailIncidentManualResolutionReason, EmailLogStatus } from "@/generated/prisma/browser";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  buildResendEmailLogCreateInput,
  resolveResendIncidentRootId,
  resolveEmailLogRecipient,
} from "@/features/admin/actions/email-log-action-helpers";
import { requireAdminArea } from "@/lib/auth/session";
import { manuallyResolveEmailIncident } from "@/lib/email/incident-resolution";
import { prisma } from "@/lib/prisma";
import { getEmailBrandingSettings } from "@/lib/site-settings";

const emailLogActionSchema = z.object({
  emailLogId: z.string().trim().min(1).max(64),
});

const closeEmailIncidentSchema = emailLogActionSchema.extend({
  reason: z.nativeEnum(EmailIncidentManualResolutionReason),
  note: z.string().trim().max(300).optional(),
}).superRefine((value, context) => {
  if (value.reason === EmailIncidentManualResolutionReason.OTHER && !value.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "Doplňte krátkou poznámku." });
  }
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
  const emailBranding = emailLog.audience === EmailAudience.ADMIN
    ? await getEmailBrandingSettings()
    : null;
  const recipientEmail = resolveEmailLogRecipient({
    audience: emailLog.audience,
    clientEmail: emailLog.client?.email ?? null,
    bookingClientEmailSnapshot: emailLog.booking?.clientEmailSnapshot ?? null,
    originalRecipientEmail: emailLog.recipientEmail,
    adminNotificationEmail: emailBranding?.notificationAdminEmail,
  });
  if (!recipientEmail) {
    return null;
  }

  const incidentRoot = emailLog.resendRootId
    ? await prisma.emailLog.findUnique({
        where: { id: emailLog.resendRootId },
        select: { incidentResolvedAt: true },
      })
    : emailLog;

  return prisma.emailLog.create({
    data: buildResendEmailLogCreateInput({
      resendOfId: emailLog.id,
      resendRootId: resolveResendIncidentRootId({
        sourceEmailLogId: emailLog.id,
        sourceResendRootId: emailLog.resendRootId,
        incidentResolvedAt: incidentRoot?.incidentResolvedAt ?? emailLog.incidentResolvedAt,
      }),
      bookingId: emailLog.bookingId,
      clientId: emailLog.clientId,
      actionTokenId: emailLog.actionTokenId,
      type: emailLog.type,
      audience: emailLog.audience,
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

export async function closeEmailIncidentAction(formData: FormData) {
  const session = await requireAdminArea("owner");
  const parsed = closeEmailIncidentSchema.safeParse({
    emailLogId: readFormString(formData, "emailLogId"),
    reason: readFormString(formData, "reason"),
    note: readFormString(formData, "note"),
  });

  if (!parsed.success) {
    redirect("/admin/email-logy");
  }

  const result = await manuallyResolveEmailIncident({
    emailLogId: parsed.data.emailLogId,
    actorUserId: session.sub,
    actorRole: session.role,
    reason: parsed.data.reason,
    note: parsed.data.note || null,
  });

  if (result.outcome === "missing" || result.outcome === "forbidden" || result.outcome === "not_an_incident") {
    redirect("/admin/email-logy");
  }

  revalidatePath("/admin/email-logy");
  revalidatePath(`/admin/email-logy/${parsed.data.emailLogId}`);
  if (result.rootId !== parsed.data.emailLogId) {
    revalidatePath(`/admin/email-logy/${result.rootId}`);
  }
  redirect(`/admin/email-logy/${parsed.data.emailLogId}?flash=incident-closed`);
}
