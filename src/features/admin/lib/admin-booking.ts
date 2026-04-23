import {
  BookingActorType,
  BookingAcquisitionSource,
  BookingSource,
  BookingStatus,
  EmailLogStatus,
  EmailLogType,
} from "@prisma/client";

import { env } from "@/config/env";
import { type AdminArea } from "@/config/navigation";
import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";
import { prisma } from "@/lib/prisma";

const formatDateTime = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export type AdminBookingActionValue =
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type AdminBookingActionOption = {
  value: AdminBookingActionValue;
  label: string;
  description: string;
};

export type AdminBookingDetailData = {
  id: string;
  area: AdminArea;
  title: string;
  status: BookingStatus;
  statusLabel: string;
  scheduledAtLabel: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceName: string;
  sourceLabel: string;
  acquisitionLabel: string | null;
  clientNote: string | null;
  internalNote: string | null;
  rescheduleCount: number;
  rescheduledAtLabel: string | null;
  availableActions: AdminBookingActionOption[];
  historyItems: Array<{
    id: string;
    kind: "status" | "reschedule";
    badgeLabel: string;
    badgeTone: BookingStatus | "RESCHEDULED";
    description: string;
    actorLabel: string;
    createdAtLabel: string;
    reason: string | null;
    note: string | null;
    sourceLabel: string | null;
  }>;
  reschedule: {
    enabled: boolean;
    serviceId: string;
    serviceDurationMinutes: number;
    currentStartsAt: string;
    currentEndsAt: string;
    expectedUpdatedAt: string;
    slots: Awaited<ReturnType<typeof getPublicBookingCatalog>>["slots"];
  };
};

type ApplyAdminBookingStatusChangeInput = {
  bookingId: string;
  targetStatus: AdminBookingActionValue;
  actorUserId: string | null;
  reason?: string;
  internalNote?: string;
};

const allowedTransitions: Record<BookingStatus, AdminBookingActionValue[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
  ],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.NO_SHOW]: [],
};

export function getAdminBookingHref(area: AdminArea, bookingId: string) {
  return area === "owner"
    ? `/admin/rezervace/${bookingId}`
    : `/admin/provoz/rezervace/${bookingId}`;
}

export function getBookingStatusLabel(status: BookingStatus) {
  switch (status) {
    case BookingStatus.PENDING:
      return "Čeká na potvrzení";
    case BookingStatus.CONFIRMED:
      return "Potvrzená";
    case BookingStatus.CANCELLED:
      return "Zrušená";
    case BookingStatus.COMPLETED:
      return "Hotovo";
    case BookingStatus.NO_SHOW:
      return "Nedorazila";
  }
}

export function getBookingSourceLabel(source: BookingSource) {
  switch (source) {
    case BookingSource.WEB:
      return "Web";
    case BookingSource.PHONE:
      return "Telefon";
    case BookingSource.INSTAGRAM:
      return "Instagram";
    case BookingSource.IN_PERSON:
      return "Osobně";
    case BookingSource.OTHER:
      return "Jiný původ";
  }
}

export function getBookingAcquisitionLabel(source: BookingAcquisitionSource | null) {
  if (!source) {
    return null;
  }

  switch (source) {
    case "DIRECT":
      return "Direct / bez kampaně";
    case "FACEBOOK":
      return "Facebook";
    case "GOOGLE":
      return "Google";
    case "INSTAGRAM":
      return "Instagram";
    case "FIRMY_CZ":
      return "Firmy.cz / Seznam";
    case "OTHER":
      return "Jiný akviziční zdroj";
  }
}

export function getAdminBookingActionOptions(status: BookingStatus): AdminBookingActionOption[] {
  return allowedTransitions[status].map((value) => {
    switch (value) {
      case BookingStatus.CONFIRMED:
        return {
          value,
          label: "Potvrdit rezervaci",
          description: "Rezervace přejde mezi potvrzené termíny.",
        };
      case BookingStatus.COMPLETED:
        return {
          value,
          label: "Označit jako hotové",
          description: "Návštěva proběhla a rezervace je uzavřená.",
        };
      case BookingStatus.CANCELLED:
        return {
          value,
          label: "Zrušit rezervaci",
          description: "Termín se uvolní a rezervace se přesune mezi zrušené.",
        };
      case BookingStatus.NO_SHOW:
        return {
          value,
          label: "Označit jako nedorazila",
          description: "Klientka měla potvrzený termín, ale nepřišla.",
        };
      default:
        return {
          value,
          label: value,
          description: "",
        };
    }
  });
}

function formatDateTimeLabel(value: Date | null | undefined) {
  if (!value) {
    return "Bez času";
  }

  return formatDateTime.format(value);
}

function formatAdminBookingDateLabel(startsAt: Date, endsAt: Date) {
  return `${formatDateTimeLabel(startsAt)} - ${new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(endsAt)}`;
}

function getActorLabel(actorType: BookingActorType, actorName?: string | null) {
  switch (actorType) {
    case BookingActorType.USER:
      return actorName ? `Admin • ${actorName}` : "Admin";
    case BookingActorType.CLIENT:
      return "Klientka";
    case BookingActorType.SYSTEM:
      return "Systém";
  }
}

function getHistorySourceLabel(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const source = "source" in metadata ? metadata.source : null;

  switch (source) {
    case "admin-booking-detail-v1":
      return "Původní detail";
    case "admin-booking-detail-v2":
      return "Akce detailu";
    case "admin-booking-note-v1":
      return "Interní poznámka";
    case "admin-manual-booking-v1":
      return "Ruční vytvoření";
    case "public-booking-request-v1":
      return "Veřejný booking";
    default:
      return null;
  }
}

export async function getAdminBookingDetailData(
  area: AdminArea,
  bookingId: string,
): Promise<AdminBookingDetailData | null> {
  const [booking, bookingCatalog] = await Promise.all([
    prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        client: {
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          include: {
            actorUser: {
              select: { name: true },
            },
          },
        },
        rescheduleLogs: {
          orderBy: { createdAt: "desc" },
          include: {
            changedByUser: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    getPublicBookingCatalog(),
  ]);

  if (!booking) {
    return null;
  }

  const historyItems = [
    ...booking.statusHistory.map((historyItem) => ({
      id: historyItem.id,
      kind: "status" as const,
      badgeLabel: getBookingStatusLabel(historyItem.status),
      badgeTone: historyItem.status,
      description: `Stav rezervace je „${getBookingStatusLabel(historyItem.status)}“.`,
      actorLabel: getActorLabel(historyItem.actorType, historyItem.actorUser?.name),
      createdAtLabel: formatDateTimeLabel(historyItem.createdAt),
      reason: historyItem.reason,
      note: historyItem.note,
      sourceLabel: getHistorySourceLabel(historyItem.metadata),
      createdAt: historyItem.createdAt,
    })),
    ...booking.rescheduleLogs.map((log) => ({
      id: log.id,
      kind: "reschedule" as const,
      badgeLabel: "Přesun termínu",
      badgeTone: "RESCHEDULED" as const,
      description: `Z ${formatBookingDateLabel(log.oldStartAt, log.oldEndAt)} na ${formatBookingDateLabel(log.newStartAt, log.newEndAt)}.`,
      actorLabel: log.changedByClient ? "Klientka" : getActorLabel(BookingActorType.USER, log.changedByUser?.name),
      createdAtLabel: formatDateTimeLabel(log.createdAt),
      reason: log.reason,
      note: null,
      sourceLabel: "Doménová akce reschedule",
      createdAt: log.createdAt,
    })),
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  return {
    id: booking.id,
    area,
    title: `${booking.clientNameSnapshot} • ${booking.serviceNameSnapshot}`,
    status: booking.status,
    statusLabel: getBookingStatusLabel(booking.status),
    scheduledAtLabel: formatAdminBookingDateLabel(booking.scheduledStartsAt, booking.scheduledEndsAt),
    createdAtLabel: formatDateTimeLabel(booking.createdAt),
    updatedAtLabel: formatDateTimeLabel(booking.updatedAt),
    clientName: booking.client.fullName,
    clientEmail: booking.clientEmailSnapshot,
    clientPhone: booking.clientPhoneSnapshot ?? booking.client.phone ?? "Telefon není vyplněný",
    serviceName: booking.serviceNameSnapshot,
    sourceLabel: getBookingSourceLabel(booking.source),
    acquisitionLabel: getBookingAcquisitionLabel(booking.acquisitionSource),
    clientNote: booking.clientNote,
    internalNote: booking.internalNote,
    rescheduleCount: booking.rescheduleCount,
    rescheduledAtLabel: booking.rescheduledAt ? formatDateTimeLabel(booking.rescheduledAt) : null,
    availableActions: getAdminBookingActionOptions(booking.status),
    historyItems: historyItems.map((item) => ({
      id: item.id,
      kind: item.kind,
      badgeLabel: item.badgeLabel,
      badgeTone: item.badgeTone,
      description: item.description,
      actorLabel: item.actorLabel,
      createdAtLabel: item.createdAtLabel,
      reason: item.reason,
      note: item.note,
      sourceLabel: item.sourceLabel,
    })),
    reschedule: {
      enabled: booking.status === BookingStatus.PENDING || booking.status === BookingStatus.CONFIRMED,
      serviceId: booking.serviceId,
      serviceDurationMinutes: booking.serviceDurationMinutes,
      currentStartsAt: booking.scheduledStartsAt.toISOString(),
      currentEndsAt: booking.scheduledEndsAt.toISOString(),
      expectedUpdatedAt: booking.updatedAt.toISOString(),
      slots: bookingCatalog.slots,
    },
  };
}

export function canApplyAdminBookingTransition(
  currentStatus: BookingStatus,
  targetStatus: AdminBookingActionValue,
) {
  return allowedTransitions[currentStatus].includes(targetStatus);
}

export async function applyAdminBookingStatusChange({
  bookingId,
  targetStatus,
  actorUserId,
  reason,
  internalNote,
}: ApplyAdminBookingStatusChangeInput) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        clientId: true,
        clientNameSnapshot: true,
        clientEmailSnapshot: true,
        serviceNameSnapshot: true,
        scheduledStartsAt: true,
        scheduledEndsAt: true,
      },
    });

    if (!booking) {
      return { status: "not-found" as const };
    }

    if (!canApplyAdminBookingTransition(booking.status, targetStatus)) {
      return {
        status: "invalid-transition" as const,
        currentStatus: booking.status,
      };
    }

    const now = new Date();
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: targetStatus,
        confirmedAt: targetStatus === BookingStatus.CONFIRMED ? now : undefined,
        cancelledAt: targetStatus === BookingStatus.CANCELLED ? now : undefined,
        completedAt: targetStatus === BookingStatus.COMPLETED ? now : undefined,
        internalNote: internalNote ? internalNote : undefined,
      },
    });

    await tx.bookingStatusHistory.create({
      data: {
        bookingId: booking.id,
        status: targetStatus,
        actorType: BookingActorType.USER,
        actorUserId,
        reason: reason || null,
        note: internalNote || null,
        metadata: {
          source: "admin-booking-detail-v2",
          fromStatus: booking.status,
          toStatus: targetStatus,
        },
      },
    });

    if (targetStatus === BookingStatus.CONFIRMED) {
      await tx.emailLog.create({
        data: {
          bookingId: booking.id,
          clientId: booking.clientId,
          type: EmailLogType.BOOKING_CONFIRMED,
          status: env.EMAIL_DELIVERY_MODE === "background" ? undefined : EmailLogStatus.SENT,
          attemptCount: env.EMAIL_DELIVERY_MODE === "background" ? undefined : 1,
          nextAttemptAt: env.EMAIL_DELIVERY_MODE === "background" ? now : undefined,
          processingStartedAt: null,
          processingToken: null,
          recipientEmail: booking.clientEmailSnapshot,
          subject: `Rezervace potvrzena: ${booking.serviceNameSnapshot}`,
          templateKey: "booking-approved-v1",
          payload: {
            bookingId: booking.id,
            serviceName: booking.serviceNameSnapshot,
            clientName: booking.clientNameSnapshot,
            scheduledStartsAt: booking.scheduledStartsAt.toISOString(),
            scheduledEndsAt: booking.scheduledEndsAt.toISOString(),
          },
          provider: env.EMAIL_DELIVERY_MODE === "background" ? undefined : "log",
          sentAt: env.EMAIL_DELIVERY_MODE === "background" ? undefined : now,
        },
      });
    }

    return { status: "success" as const };
  });
}

export async function updateAdminBookingInternalNote({
  bookingId,
  actorUserId,
  internalNote,
}: {
  bookingId: string;
  actorUserId: string | null;
  internalNote: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!booking) {
      return { status: "not-found" as const };
    }

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        internalNote,
      },
    });

    await tx.bookingStatusHistory.create({
      data: {
        bookingId: booking.id,
        status: booking.status,
        actorType: BookingActorType.USER,
        actorUserId,
        reason: internalNote ? "Interní poznámka upravena" : "Interní poznámka odstraněna",
        note: internalNote,
        metadata: {
          source: "admin-booking-note-v1",
        },
      },
    });

    return { status: "success" as const };
  });
}
