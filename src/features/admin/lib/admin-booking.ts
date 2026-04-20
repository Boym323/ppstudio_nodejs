import { BookingActorType, BookingSource, BookingStatus } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
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
  clientNote: string | null;
  internalNote: string | null;
  availableActions: AdminBookingActionOption[];
  historyItems: Array<{
    id: string;
    statusLabel: string;
    actorLabel: string;
    createdAtLabel: string;
    reason: string | null;
    note: string | null;
  }>;
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
    case BookingSource.PUBLIC_WEB:
      return "Webová rezervace";
    case BookingSource.OWNER_ADMIN:
      return "Vytvořeno v adminu";
    case BookingSource.SALON_ADMIN:
      return "Vytvořeno provozem";
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

function formatBookingDateLabel(startsAt: Date, endsAt: Date) {
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

export async function getAdminBookingDetailData(
  area: AdminArea,
  bookingId: string,
): Promise<AdminBookingDetailData | null> {
  const booking = await prisma.booking.findUnique({
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
    },
  });

  if (!booking) {
    return null;
  }

  return {
    id: booking.id,
    area,
    title: `${booking.clientNameSnapshot} • ${booking.serviceNameSnapshot}`,
    status: booking.status,
    statusLabel: getBookingStatusLabel(booking.status),
    scheduledAtLabel: formatBookingDateLabel(booking.scheduledStartsAt, booking.scheduledEndsAt),
    createdAtLabel: formatDateTimeLabel(booking.createdAt),
    updatedAtLabel: formatDateTimeLabel(booking.updatedAt),
    clientName: booking.client.fullName,
    clientEmail: booking.clientEmailSnapshot,
    clientPhone: booking.clientPhoneSnapshot ?? booking.client.phone ?? "Telefon není vyplněný",
    serviceName: booking.serviceNameSnapshot,
    sourceLabel: getBookingSourceLabel(booking.source),
    clientNote: booking.clientNote,
    internalNote: booking.internalNote,
    availableActions: getAdminBookingActionOptions(booking.status),
    historyItems: booking.statusHistory.map((historyItem) => ({
      id: historyItem.id,
      statusLabel: getBookingStatusLabel(historyItem.status),
      actorLabel: getActorLabel(historyItem.actorType, historyItem.actorUser?.name),
      createdAtLabel: formatDateTimeLabel(historyItem.createdAt),
      reason: historyItem.reason,
      note: historyItem.note,
    })),
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
          source: "admin-booking-detail-v1",
          fromStatus: booking.status,
          toStatus: targetStatus,
        },
      },
    });

    return { status: "success" as const };
  });
}
