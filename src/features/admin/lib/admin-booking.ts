import {
  BookingPaymentStatus as BookingPaymentRecordStatus,
  AdminRole,
  BookingActionTokenType,
  BookingActorType,
  BookingAcquisitionSource,
  BookingPaymentMethod,
  BookingSource,
  BookingStatus,
  EmailLogStatus,
  EmailLogType,
  Prisma,
  VoucherStatus,
  VoucherType,
} from "@/generated/prisma/client";

import { env } from "@/config/env";
import { type AdminArea } from "@/config/navigation";
import {
  buildBookingActionExpiry,
  buildBookingActionToken,
  buildBookingCancellationUrl,
  buildBookingManagementUrl,
} from "@/features/booking/lib/booking-action-tokens";
import { resolveBookingTimingSnapshot } from "@/features/booking/lib/booking-cleanup";
import { compactAdjacentEditableSlotsForBooking } from "@/features/booking/lib/booking-slot-compaction";
import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";
import { resolvePublishedSlotCoverage } from "@/features/booking/lib/booking-slot-availability";
import { formatClientPhoneForDisplay } from "@/features/booking/lib/client-phone";
import {
  BOOKING_PAYMENT_METHOD_LABELS,
  BOOKING_PAYMENT_STATUS_LABELS,
  getBookingPaymentSummary,
  type BookingPaymentStatus,
} from "@/features/booking/payments/lib/booking-payment-summary";
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
  timeZone: "Europe/Prague",
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

export type AdminBookingPaymentStatus = BookingPaymentStatus;

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
  availableServices: Array<{
    id: string;
    categoryName: string;
    name: string;
    durationMinutes: number;
    cleanupBlockMinutes: number;
    priceFromCzk: number | null;
  }>;
  servicePriceFromCzk: number | null;
  effectivePriceCzk: number;
  priceAdjustment: {
    finalPriceCzk: number | null;
    basePriceCzk: number;
    adjustmentCzk: number;
    reason: string | null;
    adjustedAtLabel: string | null;
    adjustedByUserLabel: string | null;
    canUpdate: boolean;
  };
  sourceLabel: string;
  acquisitionLabel: string | null;
  clientNote: string | null;
  internalNote: string | null;
  rescheduleCount: number;
  rescheduledAtLabel: string | null;
  cleanup: {
    cleanupBlockMinutes: number;
    cleanupLabel: string;
    blockedUntilLabel: string;
  };
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
    cleanupBlockMinutes: number;
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
      directPaidCzk: number;
      paidTotalCzk: number;
      remainingCzk: number;
      overpaidCzk: number;
      status: AdminBookingPaymentStatus;
      statusLabel: string;
    };
    payments: Array<{
      id: string;
      amountCzk: number;
      amountLabel: string;
      method: BookingPaymentMethod;
      methodLabel: string;
      paidAt: string;
      paidAtLabel: string;
      note: string | null;
      status: BookingPaymentRecordStatus;
      voidedAtLabel: string | null;
      voidReason: string | null;
      voidedByUserLabel: string | null;
      createdByUserLabel: string;
      createdAtLabel: string;
      updatedAt: string;
      lastEditedByUserLabel: string | null;
      lastEditedAtLabel: string | null;
      canEdit: boolean;
      canDelete: boolean;
    }>;
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

type UpdateAdminBookingServiceInput = {
  bookingId: string;
  serviceId: string;
  actorUserId: string | null;
  expectedUpdatedAt?: string;
  reason?: string | null;
};

type AdminBookingActionContext = {
  scheduledEndsAt?: Date | null;
  now?: Date;
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

export function canCompleteBookingAt(scheduledEndsAt: Date, now = new Date()) {
  return scheduledEndsAt.getTime() <= now.getTime();
}

export function getAdminBookingActionOptions(
  status: BookingStatus,
  context: AdminBookingActionContext = {},
): AdminBookingActionOption[] {
  const now = context.now ?? new Date();

  return allowedTransitions[status].filter((value) => {
    if (value !== BookingStatus.COMPLETED || !context.scheduledEndsAt) {
      return true;
    }

    return canCompleteBookingAt(context.scheduledEndsAt, now);
  }).map((value) => {
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

function formatTimeLabel(value: Date | null | undefined) {
  if (!value) {
    return "Bez času";
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(value);
}

export function buildBookingCleanupMetadata(input: {
  cleanupBlockMinutes?: number | null;
  blockedUntil?: Date | null;
  scheduledEndsAt: Date;
}) {
  const cleanupBlockMinutes = Math.max(0, input.cleanupBlockMinutes ?? 0);
  const blockedUntil = input.blockedUntil ?? input.scheduledEndsAt;

  return {
    cleanupBlockMinutes,
    cleanupLabel: cleanupBlockMinutes > 0
      ? `${cleanupBlockMinutes} min`
      : "Bez úklidové blokace",
    blockedUntilLabel: formatTimeLabel(blockedUntil),
  };
}

function formatAdminBookingDateLabel(startsAt: Date, endsAt: Date) {
  return `${formatDateTimeLabel(startsAt)} - ${formatTimeLabel(endsAt)}`;
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
    case "admin-booking-complete-flow-v1":
      return "Dokončení návštěvy";
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

function formatCzk(value: number | null | undefined) {
  return czkFormatter.format(value ?? 0);
}

export function getAdminBookingPaymentStatusLabel(status: AdminBookingPaymentStatus): string {
  return BOOKING_PAYMENT_STATUS_LABELS[status];
}

function buildPaymentSummary({
  totalPriceCzk,
  voucherPaidCzk,
  directPaidCzk,
}: {
  totalPriceCzk: number;
  voucherPaidCzk: number;
  directPaidCzk: number;
}): AdminBookingDetailData["voucher"]["paymentSummary"] {
  const summary = getBookingPaymentSummary({
    totalPriceCzk,
    voucherRedemptions: [{ amountCzk: voucherPaidCzk }],
    payments: [{ amountCzk: directPaidCzk }],
  });

  return {
    totalPriceCzk: summary.totalPriceCzk,
    voucherPaidCzk: summary.voucherPaidCzk,
    paidAmountCzk: summary.paidTotalCzk,
    remainingAmountCzk: summary.remainingCzk,
    paymentStatus: summary.status,
    paymentStatusLabel: getAdminBookingPaymentStatusLabel(summary.status),
    directPaidCzk: summary.directPaidCzk,
    paidTotalCzk: summary.paidTotalCzk,
    remainingCzk: summary.remainingCzk,
    overpaidCzk: summary.overpaidCzk,
    status: summary.status,
    statusLabel: getAdminBookingPaymentStatusLabel(summary.status),
  };
}

export async function getAdminBookingDetailData(
  area: AdminArea,
  bookingId: string,
): Promise<AdminBookingDetailData | null> {
  const now = new Date();
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
            category: {
              select: {
                name: true,
              },
            },
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
        payments: {
          orderBy: {
            paidAt: "desc",
          },
          include: {
            createdByUser: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
            voidedByUser: {
              select: {
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        priceAdjustedByUser: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    getPublicBookingCatalog({
      includeServices: true,
      excludeBookingId: bookingId,
    }),
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
  const paymentLastEdits = new Map<string, { actorLabel: string; createdAtLabel: string }>();
  for (const historyItem of booking.statusHistory) {
    const metadata = historyItem.metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) continue;
    const source = metadata.source;
    const paymentId = metadata.paymentId;
    if (source === "admin-booking-payment-update-v1" && typeof paymentId === "string" && !paymentLastEdits.has(paymentId)) {
      paymentLastEdits.set(paymentId, { actorLabel: historyItem.actorUser?.name ?? "Neuvedeno", createdAtLabel: formatDateTimeLabel(historyItem.createdAt) });
    }
  }
  const basePriceCzk = Math.max(0, booking.servicePriceFromCzk ?? booking.service.priceFromCzk ?? 0);
  const effectivePriceCzk = Math.max(0, booking.finalPriceCzk ?? basePriceCzk);
  const priceAdjustmentCzk = effectivePriceCzk - basePriceCzk;
  const voucherPaidCzk = booking.voucherRedemptions.reduce(
    (total, redemption) => total + (redemption.amountCzk ?? 0),
    0,
  );
  const directPaidCzk = booking.payments.reduce(
    (total, payment) => total + (payment.status === BookingPaymentRecordStatus.VOIDED ? 0 : payment.amountCzk),
    0,
  );
  const paymentSummary = buildPaymentSummary({
    totalPriceCzk: effectivePriceCzk,
    voucherPaidCzk,
    directPaidCzk,
  });
  const clientPhone = booking.clientPhoneSnapshot ?? booking.client.phone;

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
    clientPhone: clientPhone ? formatClientPhoneForDisplay(clientPhone) : "Telefon není vyplněný",
    serviceId: booking.serviceId,
    serviceName: booking.serviceNameSnapshot,
    availableServices: [
      ...(!bookingCatalog.services.some((service) => service.id === booking.serviceId)
        ? [{
            id: booking.serviceId,
            categoryName: booking.service.category?.name ?? "Aktuální služba",
            name: booking.serviceNameSnapshot,
            durationMinutes: booking.serviceDurationMinutes,
            cleanupBlockMinutes: booking.cleanupBlockMinutes,
            priceFromCzk: booking.servicePriceFromCzk,
          }]
        : []),
      ...bookingCatalog.services.map((service) => ({
        id: service.id,
        categoryName: service.categoryName,
        name: service.name,
        durationMinutes: service.durationMinutes,
        cleanupBlockMinutes: service.cleanupBlockMinutes,
        priceFromCzk: service.priceFromCzk,
      })),
    ],
    servicePriceFromCzk: booking.servicePriceFromCzk,
    effectivePriceCzk,
    priceAdjustment: {
      finalPriceCzk: booking.finalPriceCzk,
      basePriceCzk,
      adjustmentCzk: priceAdjustmentCzk,
      reason: booking.priceAdjustmentReason,
      adjustedAtLabel: booking.priceAdjustedAt ? formatDateTimeLabel(booking.priceAdjustedAt) : null,
      adjustedByUserLabel: formatOptionalAdminUserLabel(booking.priceAdjustedByUser),
      canUpdate: true,
    },
    sourceLabel: getBookingSourceLabel(booking.source),
    acquisitionLabel: getBookingAcquisitionLabel(booking.acquisitionSource),
    clientNote: booking.clientNote,
    internalNote: booking.internalNote,
    rescheduleCount: booking.rescheduleCount,
    rescheduledAtLabel: booking.rescheduledAt ? formatDateTimeLabel(booking.rescheduledAt) : null,
    cleanup: buildBookingCleanupMetadata({
      cleanupBlockMinutes: booking.cleanupBlockMinutes,
      blockedUntil: booking.blockedUntil,
      scheduledEndsAt: booking.scheduledEndsAt,
    }),
    availableActions: getAdminBookingActionOptions(booking.status, {
      scheduledEndsAt: booking.scheduledEndsAt,
    }),
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
      cleanupBlockMinutes: booking.cleanupBlockMinutes,
      currentStartsAt: booking.scheduledStartsAt.toISOString(),
      currentEndsAt: booking.scheduledEndsAt.toISOString(),
      expectedUpdatedAt: booking.updatedAt.toISOString(),
      slots: bookingCatalog.slots,
    },
    voucher: {
      paymentSummary,
      payments: booking.payments.map((payment) => ({
        id: payment.id,
        amountCzk: payment.amountCzk,
        amountLabel: formatCzk(payment.amountCzk),
        method: payment.method,
        methodLabel: BOOKING_PAYMENT_METHOD_LABELS[payment.method],
        paidAt: payment.paidAt.toISOString(),
        paidAtLabel: formatDateTimeLabel(payment.paidAt),
        note: payment.note,
        status: payment.status,
        voidedAtLabel: payment.voidedAt ? formatDateTimeLabel(payment.voidedAt) : null,
        voidReason: payment.voidReason,
        voidedByUserLabel: formatOptionalAdminUserLabel(payment.voidedByUser),
        createdByUserLabel: formatBookingPaymentUserLabel(payment.createdByUser),
        createdAtLabel: formatDateTimeLabel(payment.createdAt),
        updatedAt: payment.updatedAt.toISOString(),
        lastEditedByUserLabel: paymentLastEdits.get(payment.id)?.actorLabel ?? null,
        lastEditedAtLabel: paymentLastEdits.get(payment.id)?.createdAtLabel ?? null,
        canEdit: payment.status === BookingPaymentRecordStatus.ACTIVE,
        canDelete: area === "owner" && payment.status === BookingPaymentRecordStatus.ACTIVE,
      })),
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
            effectiveStatus: getEffectiveVoucherStatus(booking.intendedVoucher, now),
            statusLabel: formatVoucherStatus(getEffectiveVoucherStatus(booking.intendedVoucher, now)),
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
                : booking.intendedVoucher.servicePriceSnapshotCzk ?? effectivePriceCzk,
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

function formatBookingPaymentUserLabel(
  user: { name: string; email: string; role: AdminRole } | null,
) {
  if (!user) {
    return "Neuvedeno";
  }

  return `${user.name} (${user.email})`;
}

function formatOptionalAdminUserLabel(
  user: { name: string; email: string; role: AdminRole } | null,
) {
  return user ? `${user.name} (${user.email})` : null;
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
  return prisma.$transaction(
    (tx) => applyAdminBookingStatusChangeInTransaction(tx, {
      bookingId,
      targetStatus,
      actorUserId,
      reason,
      internalNote,
    }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function applyAdminBookingStatusChangeInTransaction(
  tx: Prisma.TransactionClient,
  {
    bookingId,
    targetStatus,
    actorUserId,
    reason,
    internalNote,
  }: ApplyAdminBookingStatusChangeInput,
) {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        clientId: true,
        slotId: true,
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
    if (targetStatus === BookingStatus.COMPLETED && !canCompleteBookingAt(booking.scheduledEndsAt, now)) {
      return {
        status: "completion-too-early" as const,
        scheduledEndsAt: booking.scheduledEndsAt,
      };
    }

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

    if (targetStatus === BookingStatus.CANCELLED) {
      await compactAdjacentEditableSlotsForBooking(tx, booking.slotId);
    }

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

      await tx.bookingActionToken.create({
        data: {
          bookingId: booking.id,
          type: BookingActionTokenType.RESCHEDULE,
          tokenHash: manageToken.tokenHash,
          expiresAt: buildBookingActionExpiry(now),
          lastSentAt: now,
        },
      });
      await tx.bookingActionToken.create({
        data: {
          bookingId: booking.id,
          type: BookingActionTokenType.CANCEL,
          tokenHash: cancellationToken.tokenHash,
          expiresAt: buildBookingActionExpiry(now),
          lastSentAt: now,
        },
      });

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

export async function updateAdminBookingService({
  bookingId,
  serviceId,
  actorUserId,
  expectedUpdatedAt,
  reason,
}: UpdateAdminBookingServiceInput) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Booking"
      WHERE "id" = ${bookingId}
      FOR UPDATE
    `);

    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        clientId: true,
        status: true,
        slotId: true,
        serviceId: true,
        serviceNameSnapshot: true,
        serviceDurationMinutes: true,
        cleanupMinutes: true,
        cleanupBlockMinutes: true,
        servicePriceFromCzk: true,
        scheduledStartsAt: true,
        scheduledEndsAt: true,
        blockedUntil: true,
        manualOverride: true,
        finalPriceCzk: true,
        intendedVoucherId: true,
        updatedAt: true,
      },
    });

    if (!booking) {
      return { status: "not-found" as const };
    }

    if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
      return {
        status: "status-not-allowed" as const,
        currentStatus: booking.status,
      };
    }

    if (expectedUpdatedAt) {
      const expectedDate = new Date(expectedUpdatedAt);

      if (!Number.isNaN(expectedDate.getTime()) && expectedDate.getTime() !== booking.updatedAt.getTime()) {
        return {
          status: "concurrent-modification" as const,
        };
      }
    }

    if (booking.serviceId === serviceId) {
      return { status: "same-service" as const };
    }

    const slot = await tx.availabilitySlot.findUniqueOrThrow({
      where: {
        id: booking.slotId,
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        status: true,
        serviceRestrictionMode: true,
        allowedServices: {
          select: {
            serviceId: true,
          },
        },
      },
    });

    const intendedVoucher = booking.intendedVoucherId
      ? await tx.voucher.findUnique({
          where: {
            id: booking.intendedVoucherId,
          },
          select: {
            id: true,
            type: true,
            serviceId: true,
          },
        })
      : null;

    const voucherRedemptions = await tx.voucherRedemption.findMany({
      where: {
        bookingId: booking.id,
      },
      select: {
        id: true,
        serviceId: true,
      },
    });

    const nextService = await tx.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
        isPubliclyBookable: true,
      },
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        cleanupMinutes: true,
        priceFromCzk: true,
      },
    });

    if (!nextService) {
      return { status: "service-not-found" as const };
    }

    if (
      intendedVoucher?.type === VoucherType.SERVICE
      && intendedVoucher.serviceId
      && intendedVoucher.serviceId !== nextService.id
    ) {
      return {
        status: "voucher-conflict" as const,
        message: "Na rezervaci je navázaný službový voucher pro jinou službu. Nejprve upravte nebo odeberte voucher.",
      };
    }

    const conflictingRedemption = voucherRedemptions.some(
      (redemption) => redemption.serviceId && redemption.serviceId !== nextService.id,
    );

    if (conflictingRedemption) {
      return {
        status: "voucher-conflict" as const,
        message: "Na rezervaci už je uplatněný službový voucher pro jinou službu. Změnu služby proto nepovolíme.",
      };
    }

    const nextTiming = resolveBookingTimingSnapshot({
      startsAt: booking.scheduledStartsAt,
      serviceDurationMinutes: nextService.durationMinutes,
      cleanupMinutes: nextService.cleanupMinutes,
    });
    const nextScheduledEndsAt = nextTiming.serviceEnd;
    const nextBlockedUntil = nextTiming.blockedUntil;

    const overlappingSlots = await tx.availabilitySlot.findMany({
      where: {
        id: {
          not: booking.slotId,
        },
        startsAt: {
          lt: nextBlockedUntil,
        },
        endsAt: {
          gt: booking.scheduledStartsAt,
        },
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        status: true,
        serviceRestrictionMode: true,
        allowedServices: {
          select: {
            serviceId: true,
          },
        },
      },
      orderBy: [{ startsAt: "asc" }],
    });

    const publishedCoverage = resolvePublishedSlotCoverage(
      [slot, ...overlappingSlots],
      nextService.id,
      booking.scheduledStartsAt,
      nextBlockedUntil,
      slot.id,
    );

    const slotAllowsNewService = slot.serviceRestrictionMode === "ANY"
      || slot.allowedServices.some((allowedService) => allowedService.serviceId === nextService.id);
    const currentSlotCoversNewTiming =
      booking.scheduledStartsAt.getTime() >= slot.startsAt.getTime()
      && nextBlockedUntil.getTime() <= slot.endsAt.getTime();

    const canStayOnManualOverrideSlot = slot.status !== "PUBLISHED"
      && slotAllowsNewService
      && currentSlotCoversNewTiming;

    if (!publishedCoverage && !canStayOnManualOverrideSlot) {
      return {
        status: "slot-too-short" as const,
      };
    }

    const resolvedCoverageSlots = publishedCoverage?.coverage ?? [slot];
    const restrictConflictToCoverage = slot.status === "PUBLISHED" && publishedCoverage !== null;
    const allowedCapacity = canStayOnManualOverrideSlot
      ? slot.capacity
      : Math.min(...resolvedCoverageSlots.map((slot) => slot.capacity));

    const activeBookingCount = await tx.booking.count({
      where: {
        id: {
          not: booking.id,
        },
        status: {
          in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        },
        scheduledStartsAt: {
          lt: nextBlockedUntil,
        },
        OR: [
          {
            blockedUntil: {
              gt: booking.scheduledStartsAt,
            },
          },
          {
            blockedUntil: null,
            scheduledEndsAt: {
              gt: booking.scheduledStartsAt,
            },
          },
        ],
        ...(restrictConflictToCoverage
          ? {
              slotId: {
                in: resolvedCoverageSlots.map((slot) => slot.id),
              },
            }
          : {}),
      },
    });

    if (activeBookingCount >= allowedCapacity) {
      return { status: "conflict" as const };
    }

    if (slot.status !== "PUBLISHED") {
      await tx.availabilitySlot.update({
        where: {
          id: slot.id,
        },
        data: {
          endsAt: nextBlockedUntil,
        },
      });
    }

    await tx.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        serviceId: nextService.id,
        serviceNameSnapshot: nextService.name,
        serviceDurationMinutes: nextTiming.serviceDurationMinutes,
        cleanupMinutes: nextTiming.cleanupMinutes,
        cleanupBlockMinutes: nextTiming.cleanupBlockMinutes,
        servicePriceFromCzk: nextService.priceFromCzk,
        scheduledEndsAt: nextScheduledEndsAt,
        blockedUntil: nextBlockedUntil,
      },
    });

    const normalizedReason = reason?.trim() ? reason.trim() : null;
    const metadata = {
      source: "admin-booking-service-change-v1",
      previousServiceId: booking.serviceId,
      previousServiceName: booking.serviceNameSnapshot,
      previousDurationMinutes: booking.serviceDurationMinutes,
      previousCleanupBlockMinutes: booking.cleanupBlockMinutes,
      previousScheduledEndsAt: booking.scheduledEndsAt.toISOString(),
      nextServiceId: nextService.id,
      nextServiceName: nextService.name,
      nextDurationMinutes: nextTiming.serviceDurationMinutes,
      nextCleanupBlockMinutes: nextTiming.cleanupBlockMinutes,
      nextScheduledEndsAt: nextScheduledEndsAt.toISOString(),
      keptFinalPriceCzk: booking.finalPriceCzk,
    };

    await tx.bookingStatusHistory.create({
      data: {
        bookingId: booking.id,
        status: booking.status,
        actorType: BookingActorType.USER,
        actorUserId,
        reason: normalizedReason
          ? `Služba změněna: ${booking.serviceNameSnapshot} -> ${nextService.name}. ${normalizedReason}`
          : `Služba změněna: ${booking.serviceNameSnapshot} -> ${nextService.name}.`,
        note: null,
        metadata,
      },
    });

    return {
      status: "success" as const,
      clientId: booking.clientId,
      previousServiceName: booking.serviceNameSnapshot,
      nextServiceName: nextService.name,
      previousScheduledEndsAt: booking.scheduledEndsAt,
      nextScheduledEndsAt,
      previousCleanupBlockMinutes: booking.cleanupBlockMinutes,
      nextCleanupBlockMinutes: nextTiming.cleanupBlockMinutes,
      keptFinalPriceCzk: booking.finalPriceCzk,
    };
  });
}
