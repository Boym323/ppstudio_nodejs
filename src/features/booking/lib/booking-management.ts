import {
  BookingActionTokenType,
  BookingStatus,
} from "@prisma/client";

import {
  buildBookingActionExpiry,
  buildBookingActionToken,
  buildBookingCancellationUrl,
  hashBookingActionToken,
} from "@/features/booking/lib/booking-action-tokens";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";
import {
  getPublicBookingCatalog,
  type PublicBookingCatalog,
} from "@/features/booking/lib/booking-public";
import { rescheduleBooking } from "@/features/booking/lib/booking-rescheduling";
import { prisma } from "@/lib/prisma";
import {
  canClientCancelBooking,
  getBookingPolicySettings,
} from "@/lib/site-settings";

type BookingManageDetails = {
  bookingId?: string;
  serviceName?: string;
  clientName?: string;
  scheduledAtLabel?: string;
  statusLabel?: string;
};

type LoadedManageToken = {
  id: string;
  bookingId: string;
  type: BookingActionTokenType;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  booking: {
    id: string;
    status: BookingStatus;
    updatedAt: Date;
    serviceId: string;
    serviceDurationMinutes: number;
    serviceNameSnapshot: string;
    clientNameSnapshot: string;
    scheduledStartsAt: Date;
    scheduledEndsAt: Date;
  };
};

export type BookingManagementTokenRecord = LoadedManageToken | null;

export type PublicBookingManagementPageState =
  | (BookingManageDetails & {
      status: "ready";
      bookingId: string;
      serviceId: string;
      serviceName: string;
      serviceDurationMinutes: number;
      clientName: string;
      scheduledAtLabel: string;
      statusLabel: string;
      scheduledStartsAt: string;
      scheduledEndsAt: string;
      expectedUpdatedAt: string;
      expiresAt: string;
      cancellationHours: number;
      cancellationUrl: string;
      slots: PublicBookingCatalog["slots"];
    })
  | (BookingManageDetails & {
      status: "invalid" | "expired" | "already_cancelled" | "not_reschedulable";
      message: string;
    });

export type PublicBookingManageRescheduleResult =
  | {
      status: "rescheduled";
      bookingId: string;
      serviceName: string;
      clientName: string;
      previousScheduledAtLabel: string;
      scheduledAtLabel: string;
      notificationStatus: "queued" | "logged" | "skipped" | "failed";
    }
  | (BookingManageDetails & {
      status: "invalid" | "expired" | "already_cancelled" | "not_reschedulable";
      message: string;
    });

type PublicBookingManagementBlockedState = Extract<
  PublicBookingManagementPageState,
  { status: "invalid" | "expired" | "already_cancelled" | "not_reschedulable" }
>;

function getBookingStatusLabel(status: BookingStatus) {
  switch (status) {
    case BookingStatus.PENDING:
      return "Čeká na potvrzení";
    case BookingStatus.CONFIRMED:
      return "Potvrzená";
    case BookingStatus.CANCELLED:
      return "Zrušená";
    case BookingStatus.COMPLETED:
      return "Dokončená";
    case BookingStatus.NO_SHOW:
      return "Nedorazila";
    default:
      return String(status);
  }
}

function toManageDetails(token: LoadedManageToken) {
  return {
    bookingId: token.booking.id,
    serviceName: token.booking.serviceNameSnapshot,
    clientName: token.booking.clientNameSnapshot,
    scheduledAtLabel: formatBookingDateLabel(
      token.booking.scheduledStartsAt,
      token.booking.scheduledEndsAt,
    ),
    statusLabel: getBookingStatusLabel(token.booking.status),
  } satisfies BookingManageDetails;
}

async function findManageToken(tokenHash: string) {
  return prisma.bookingActionToken.findUnique({
    where: {
      tokenHash,
    },
    select: {
      id: true,
      bookingId: true,
      type: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      booking: {
        select: {
          id: true,
          status: true,
          updatedAt: true,
          serviceId: true,
          serviceDurationMinutes: true,
          serviceNameSnapshot: true,
          clientNameSnapshot: true,
          scheduledStartsAt: true,
          scheduledEndsAt: true,
        },
      },
    },
  });
}

export function resolvePublicBookingManagementState(
  token: BookingManagementTokenRecord,
  cancellationHours: number,
): PublicBookingManagementBlockedState | { status: "ready"; token: LoadedManageToken } {
  if (!token) {
    return {
      status: "invalid",
      message: "Odkaz pro správu rezervace je neplatný nebo už neexistuje.",
    };
  }

  const details = toManageDetails(token);

  if (token.type !== BookingActionTokenType.RESCHEDULE) {
    return {
      status: "invalid",
      message: "Tento odkaz neslouží pro správu rezervace.",
      ...details,
    };
  }

  if (token.revokedAt || token.usedAt) {
    return {
      status: "invalid",
      message: "Tento odkaz už není aktivní.",
      ...details,
    };
  }

  if (token.expiresAt <= new Date()) {
    return {
      status: "expired",
      message: "Platnost odkazu už vypršela. Pokud potřebujete termín upravit, kontaktujte prosím studio.",
      ...details,
    };
  }

  if (token.booking.status === BookingStatus.CANCELLED) {
    return {
      status: "already_cancelled",
      message: "Tato rezervace už byla zrušena.",
      ...details,
    };
  }

  if (
    token.booking.status !== BookingStatus.PENDING
    && token.booking.status !== BookingStatus.CONFIRMED
  ) {
    return {
      status: "not_reschedulable",
      message: "Tuto rezervaci už nelze měnit online. Kontaktujte prosím studio.",
      ...details,
    };
  }

  if (!canClientCancelBooking(token.booking.scheduledStartsAt, new Date(), cancellationHours)) {
    return {
      status: "not_reschedulable",
      message: `Změnu termínu už nelze provést online méně než ${cancellationHours} hodin před začátkem. Kontaktujte prosím studio.`,
      ...details,
    };
  }

  return {
    status: "ready",
    token,
  };
}

async function issueCancellationUrl(bookingId: string, now = new Date()) {
  const cancellationToken = buildBookingActionToken();

  await prisma.bookingActionToken.create({
    data: {
      bookingId,
      type: BookingActionTokenType.CANCEL,
      tokenHash: cancellationToken.tokenHash,
      expiresAt: buildBookingActionExpiry(now),
      lastSentAt: now,
    },
  });

  return buildBookingCancellationUrl(cancellationToken.rawToken);
}

type BookingManagementDependencies = {
  findManageToken: typeof findManageToken;
  getBookingPolicySettings: typeof getBookingPolicySettings;
  getPublicBookingCatalog: typeof getPublicBookingCatalog;
  issueCancellationUrl: typeof issueCancellationUrl;
  rescheduleBooking: typeof rescheduleBooking;
};

const defaultBookingManagementDependencies: BookingManagementDependencies = {
  findManageToken,
  getBookingPolicySettings,
  getPublicBookingCatalog,
  issueCancellationUrl,
  rescheduleBooking,
};

export function createBookingManagementApi(
  dependencies: BookingManagementDependencies = defaultBookingManagementDependencies,
) {
  return {
    async getPublicBookingManagementPageState(
      rawToken: string,
    ): Promise<PublicBookingManagementPageState> {
      const tokenHash = hashBookingActionToken(rawToken);
      const [token, bookingPolicy] = await Promise.all([
        dependencies.findManageToken(tokenHash),
        dependencies.getBookingPolicySettings(),
      ]);
      const resolved = resolvePublicBookingManagementState(token, bookingPolicy.cancellationHours);

      if (resolved.status !== "ready") {
        return resolved;
      }

      const [catalog, cancellationUrl] = await Promise.all([
        dependencies.getPublicBookingCatalog(),
        dependencies.issueCancellationUrl(resolved.token.booking.id),
      ]);

      return {
        status: "ready",
        bookingId: resolved.token.booking.id,
        serviceId: resolved.token.booking.serviceId,
        serviceName: resolved.token.booking.serviceNameSnapshot,
        serviceDurationMinutes: resolved.token.booking.serviceDurationMinutes,
        clientName: resolved.token.booking.clientNameSnapshot,
        scheduledAtLabel: formatBookingDateLabel(
          resolved.token.booking.scheduledStartsAt,
          resolved.token.booking.scheduledEndsAt,
        ),
        statusLabel: getBookingStatusLabel(resolved.token.booking.status),
        scheduledStartsAt: resolved.token.booking.scheduledStartsAt.toISOString(),
        scheduledEndsAt: resolved.token.booking.scheduledEndsAt.toISOString(),
        expectedUpdatedAt: resolved.token.booking.updatedAt.toISOString(),
        expiresAt: resolved.token.expiresAt.toISOString(),
        cancellationHours: bookingPolicy.cancellationHours,
        cancellationUrl,
        slots: catalog.slots,
      };
    },

    async reschedulePublicBookingByToken(input: {
      token: string;
      slotId: string;
      newStartAt: string;
      expectedUpdatedAt: string;
    }): Promise<PublicBookingManageRescheduleResult> {
      const tokenHash = hashBookingActionToken(input.token);
      const [token, bookingPolicy] = await Promise.all([
        dependencies.findManageToken(tokenHash),
        dependencies.getBookingPolicySettings(),
      ]);
      const resolved = resolvePublicBookingManagementState(token, bookingPolicy.cancellationHours);

      if (resolved.status !== "ready") {
        return resolved;
      }

      const result = await dependencies.rescheduleBooking({
        bookingId: resolved.token.booking.id,
        slotId: input.slotId,
        newStartAt: input.newStartAt,
        changedByUserId: null,
        changedByClient: true,
        notifyClient: true,
        includeCalendarAttachment: true,
        expectedUpdatedAt: input.expectedUpdatedAt,
      });

      return {
        status: "rescheduled",
        bookingId: resolved.token.booking.id,
        serviceName: resolved.token.booking.serviceNameSnapshot,
        clientName: resolved.token.booking.clientNameSnapshot,
        previousScheduledAtLabel: result.previousScheduledAtLabel,
        scheduledAtLabel: result.scheduledAtLabel,
        notificationStatus: result.notificationStatus,
      };
    },
  };
}

const bookingManagementApi = createBookingManagementApi();

export const getPublicBookingManagementPageState =
  bookingManagementApi.getPublicBookingManagementPageState;

export const reschedulePublicBookingByToken =
  bookingManagementApi.reschedulePublicBookingByToken;
