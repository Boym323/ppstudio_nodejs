import {
  BookingActionTokenType,
  BookingActorType,
  BookingAcquisitionSource,
  BookingSource,
  BookingStatus,
  EmailLogStatus,
  EmailLogType,
  VoucherStatus,
  VoucherType,
} from "@prisma/client";

import { env } from "@/config/env";
import { type AdminArea } from "@/config/navigation";
import {
  buildBookingActionExpiry,
  buildBookingActionToken,
  buildBookingCancellationUrl,
  buildBookingManagementUrl,
} from "@/features/booking/lib/booking-action-tokens";
import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";
import {
  formatVoucherRemaining,
  formatVoucherStatus,
  formatVoucherType,
  formatVoucherValue,
  getEffectiveVoucherStatus,
} from "@/features/vouchers/lib/voucher-format";
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

export type AdminBookingPaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

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
  serviceId: string;
  serviceName: string;
  servicePriceFromCzk: number | null;
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
  voucher: {
    paymentSummary: {
      totalPriceCzk: number | null;
      voucherPaidCzk: number;
      paidAmountCzk: number;
      remainingAmountCzk: number | null;
      paymentStatus: AdminBookingPaymentStatus;
      paymentStatusLabel: string;
    };
    intendedVoucherCodeSnapshot: string | null;
    intendedVoucherValidatedAtLabel: string | null;
    intendedVoucher: {
      id: string;
      code: string;
      type: VoucherType;
      typeLabel: string;
      status: VoucherStatus;
      effectiveStatus: VoucherStatus;
      statusLabel: string;
      valueLabel: string;
      remainingLabel: string;
      remainingValueCzk: number | null;
      serviceId: string | null;
      serviceNameSnapshot: string | null;
      servicePriceSnapshotCzk: number | null;
      safeDescription: string;
      defaultRedeemAmountCzk: number | null;
    } | null;
    redemptions: Array<{
      id: string;
      voucherCode: string;
      voucherType: VoucherType;
      voucherTypeLabel: string;
      amountCzk: number | null;
      serviceNameSnapshot: string | null;
      redeemedAtLabel: string;
      redeemedByUserLabel: string;
      note: string | null;
    }>;
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

export function getBookingStatusLabel(status: BookingStatus): string {
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

  return String(status);
}

export function getBookingSourceLabel(source: BookingSource): string {
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

  return String(source);
}

export function getBookingAcquisitionLabel(source: BookingAcquisitionSource | null): string | null {
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

  return String(source);
}

export function getAdminBookingActionOptions(status: BookingStatus): AdminBookingActionOption[] {
  return allowedTransitions[status].map((value) => {
    switch (value) {
      case BookingStatus.CONFIRMED:
        return {
          value,
          label: "Potvrdit rezervaci",
          description: "Přesune rezervaci mezi potvrzené termíny.",
        };
      case BookingStatus.COMPLETED:
        return {
          value,
          label: "Označit jako hotové",
          description: "Uzavře rezervaci jako hotovou.",
        };
      case BookingStatus.CANCELLED:
        return {
          value,
          label: "Zrušit rezervaci",
          description: "Uvolní termín a přesune rezervaci mezi zrušené.",
        };
      case BookingStatus.NO_SHOW:
        return {
          value,
          label: "Označit jako nedorazila",
          description: "Uzavře rezervaci jako nedorazila.",
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

function getActorLabel(actorType: BookingActorType, actorName?: string | null): string {
  switch (actorType) {
    case BookingActorType.USER:
      return actorName ? `Admin • ${actorName}` : "Admin";
    case BookingActorType.CLIENT:
      return "Klientka";
    case BookingActorType.SYSTEM:
      return "Systém";
  }

  return String(actorType);
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

function formatRedemptionUserLabel(user: { name: string; email: string } | null) {
  if (!user) {
    return "Neuvedeno";
  }

  return `${user.name} (${user.email})`;
}

function buildVoucherSafeDescription(voucher: {
  type: VoucherType;
  originalValueCzk: number | null;
  remainingValueCzk: number | null;
  serviceNameSnapshot: string | null;
  servicePriceSnapshotCzk: number | null;
}) {
  if (voucher.type === VoucherType.VALUE) {
    return `Hodnotový voucher, zbývá ${formatVoucherRemaining({
      type: voucher.type,
      remainingValueCzk: voucher.remainingValueCzk,
      status: VoucherStatus.ACTIVE,
    })}.`;
  }

  return `Voucher na službu ${voucher.serviceNameSnapshot ?? "bez uloženého názvu"}${
    voucher.servicePriceSnapshotCzk ? ` v hodnotě ${czkFormatter.format(voucher.servicePriceSnapshotCzk)}` : ""
  }.`;
}

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

export function getAdminBookingPaymentStatusLabel(status: AdminBookingPaymentStatus): string {
  switch (status) {
    case "UNPAID":
      return "Neuhrazeno";
    case "PARTIALLY_PAID":
      return "Částečně uhrazeno";
    case "PAID":
      return "Uhrazeno";
  }
}

function buildPaymentSummary({
  totalPriceCzk,
  voucherPaidCzk,
}: {
  totalPriceCzk: number | null;
  voucherPaidCzk: number;
}): AdminBookingDetailData["voucher"]["paymentSummary"] {
  const paidAmountCzk = voucherPaidCzk;

  if (totalPriceCzk === null) {
    const paymentStatus: AdminBookingPaymentStatus =
      paidAmountCzk > 0 ? "PARTIALLY_PAID" : "UNPAID";

    return {
      totalPriceCzk,
      voucherPaidCzk,
      paidAmountCzk,
      remainingAmountCzk: null,
      paymentStatus,
      paymentStatusLabel: getAdminBookingPaymentStatusLabel(paymentStatus),
    };
  }

  const remainingAmountCzk = Math.max(totalPriceCzk - paidAmountCzk, 0);
  const paymentStatus: AdminBookingPaymentStatus =
    remainingAmountCzk === 0
      ? "PAID"
      : paidAmountCzk > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

  return {
    totalPriceCzk,
    voucherPaidCzk,
    paidAmountCzk,
    remainingAmountCzk,
    paymentStatus,
    paymentStatusLabel: getAdminBookingPaymentStatusLabel(paymentStatus),
  };
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
        service: {
          select: {
            priceFromCzk: true,
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
        intendedVoucher: {
          select: {
            id: true,
            code: true,
            type: true,
            status: true,
            originalValueCzk: true,
            remainingValueCzk: true,
            serviceId: true,
            serviceNameSnapshot: true,
            servicePriceSnapshotCzk: true,
            validUntil: true,
          },
        },
        voucherRedemptions: {
          orderBy: { redeemedAt: "desc" },
          include: {
            voucher: {
              select: {
                code: true,
                type: true,
              },
            },
            redeemedByUser: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    }),
    getPublicBookingCatalog({ includeServices: false }),
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
  const totalPriceCzk = booking.servicePriceFromCzk ?? booking.service.priceFromCzk;
  const voucherPaidCzk = booking.voucherRedemptions.reduce(
    (total, redemption) => total + (redemption.amountCzk ?? 0),
    0,
  );
  const paymentSummary = buildPaymentSummary({ totalPriceCzk, voucherPaidCzk });

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
    serviceId: booking.serviceId,
    serviceName: booking.serviceNameSnapshot,
    servicePriceFromCzk: booking.servicePriceFromCzk,
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
    voucher: {
      paymentSummary,
      intendedVoucherCodeSnapshot: booking.intendedVoucherCodeSnapshot,
      intendedVoucherValidatedAtLabel: booking.intendedVoucherValidatedAt
        ? formatDateTimeLabel(booking.intendedVoucherValidatedAt)
        : null,
      intendedVoucher: booking.intendedVoucher
        ? {
            id: booking.intendedVoucher.id,
            code: booking.intendedVoucher.code,
            type: booking.intendedVoucher.type,
            typeLabel: formatVoucherType(booking.intendedVoucher.type),
            status: booking.intendedVoucher.status,
            effectiveStatus: getEffectiveVoucherStatus(booking.intendedVoucher),
            statusLabel: formatVoucherStatus(getEffectiveVoucherStatus(booking.intendedVoucher)),
            valueLabel: formatVoucherValue(booking.intendedVoucher),
            remainingLabel: formatVoucherRemaining(booking.intendedVoucher),
            remainingValueCzk: booking.intendedVoucher.remainingValueCzk,
            serviceId: booking.intendedVoucher.serviceId,
            serviceNameSnapshot: booking.intendedVoucher.serviceNameSnapshot,
            servicePriceSnapshotCzk: booking.intendedVoucher.servicePriceSnapshotCzk,
            safeDescription: buildVoucherSafeDescription(booking.intendedVoucher),
            defaultRedeemAmountCzk:
              booking.intendedVoucher.type === VoucherType.VALUE
                ? Math.min(
                    booking.intendedVoucher.remainingValueCzk ?? 0,
                    paymentSummary.remainingAmountCzk ?? 0,
                  )
                : booking.intendedVoucher.servicePriceSnapshotCzk ?? totalPriceCzk,
          }
        : null,
      redemptions: booking.voucherRedemptions.map((redemption) => ({
        id: redemption.id,
        voucherCode: redemption.voucher.code,
        voucherType: redemption.voucher.type,
        voucherTypeLabel: formatVoucherType(redemption.voucher.type),
        amountCzk: redemption.amountCzk,
        serviceNameSnapshot: redemption.serviceNameSnapshot,
        redeemedAtLabel: formatDateTimeLabel(redemption.redeemedAt),
        redeemedByUserLabel: formatRedemptionUserLabel(redemption.redeemedByUser),
        note: redemption.note,
      })),
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
      const manageToken = buildBookingActionToken();
      const cancellationToken = buildBookingActionToken();

      await Promise.all([
        tx.bookingActionToken.create({
          data: {
            bookingId: booking.id,
            type: BookingActionTokenType.RESCHEDULE,
            tokenHash: manageToken.tokenHash,
            expiresAt: buildBookingActionExpiry(now),
            lastSentAt: now,
          },
        }),
        tx.bookingActionToken.create({
          data: {
            bookingId: booking.id,
            type: BookingActionTokenType.CANCEL,
            tokenHash: cancellationToken.tokenHash,
            expiresAt: buildBookingActionExpiry(now),
            lastSentAt: now,
          },
        }),
      ]);

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
            manageReservationUrl: buildBookingManagementUrl(manageToken.rawToken),
            cancellationUrl: buildBookingCancellationUrl(cancellationToken.rawToken),
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
