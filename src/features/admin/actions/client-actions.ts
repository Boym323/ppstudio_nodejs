"use server";

import { BookingActorType, BookingStatus, EmailLogStatus, Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

import { type AdminArea } from "@/config/navigation";
import { type UpdateClientContactActionState } from "@/features/admin/actions/update-client-contact-action-state";
import { type UpdateClientNoteActionState } from "@/features/admin/actions/update-client-note-action-state";
import {
  updateClientContactSchema,
  updateClientNoteSchema,
} from "@/features/admin/lib/admin-client-validation";
import {
  CLIENT_PHONE_FORMAT_MESSAGE,
  isValidClientPhoneInput,
  normalizeClientPhone,
} from "@/features/booking/lib/booking-public";
import { requireAdminArea } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function revalidateClientPaths(clientId: string) {
  const paths = [
    "/admin",
    "/admin/klienti",
    `/admin/klienti/${clientId}`,
    "/admin/provoz",
    "/admin/provoz/klienti",
    `/admin/provoz/klienti/${clientId}`,
  ];

  for (const path of paths) {
    revalidatePath(path);
  }
}

function revalidateBookingPaths(bookingIds: string[]) {
  for (const bookingId of bookingIds) {
    revalidatePath(`/admin/rezervace/${bookingId}`);
    revalidatePath(`/admin/provoz/rezervace/${bookingId}`);
  }
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function updateClientNoteAction(
  _previousState: UpdateClientNoteActionState,
  formData: FormData,
): Promise<UpdateClientNoteActionState> {
  const parsed = updateClientNoteSchema.safeParse({
    area: readFormString(formData, "area"),
    clientId: readFormString(formData, "clientId"),
    internalNote: readFormString(formData, "internalNote"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Poznámku se nepodařilo uložit. Zkontrolujte prosím formulář.",
      fieldErrors: {
        internalNote: fieldErrors.internalNote?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  await requireAdminArea(area);

  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { id: true },
  });

  if (!client) {
    return {
      status: "error",
      formError: "Klientku se nepodařilo najít.",
    };
  }

  await prisma.client.update({
    where: { id: client.id },
    data: {
      internalNote: parsed.data.internalNote || null,
    },
  });

  revalidateClientPaths(client.id);

  return {
    status: "success",
    successMessage: "Interní poznámka je uložená.",
  };
}

export async function updateClientContactAction(
  _previousState: UpdateClientContactActionState,
  formData: FormData,
): Promise<UpdateClientContactActionState> {
  const parsed = updateClientContactSchema.safeParse({
    area: readFormString(formData, "area"),
    clientId: readFormString(formData, "clientId"),
    email: readFormString(formData, "email"),
    phone: readFormString(formData, "phone"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Kontakt se nepodařilo uložit. Zkontrolujte prosím formulář.",
      fieldErrors: {
        email: fieldErrors.email?.[0],
        phone: fieldErrors.phone?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  const session = await requireAdminArea(area);

  if (parsed.data.phone && !isValidClientPhoneInput(parsed.data.phone)) {
    return {
      status: "error",
      formError: "Kontakt se nepodařilo uložit. Zkontrolujte prosím formulář.",
      fieldErrors: {
        phone: CLIENT_PHONE_FORMAT_MESSAGE,
      },
    };
  }

  const normalizedEmail = parsed.data.email ? parsed.data.email.toLocaleLowerCase("cs-CZ") : null;
  const normalizedPhone = parsed.data.phone ? normalizeClientPhone(parsed.data.phone) : null;

  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { id: true },
  });

  if (!client) {
    return {
      status: "error",
      formError: "Klientku se nepodařilo najít.",
    };
  }

  if (normalizedEmail) {
    const existingClient = await prisma.client.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingClient && existingClient.id !== client.id) {
      return {
        status: "error",
        formError: "Tento e-mail už používá jiná klientka.",
        fieldErrors: {
          email: "Použijte jiný e-mail nebo nejdřív sloučte duplicitní profil.",
        },
      };
    }
  }

  try {
    const actorUser = await prisma.adminUser.findFirst({
      where: {
        email: {
          equals: session.email.trim(),
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });

    const touchedBookingIds = await prisma.$transaction(async (tx) => {
      const activeBookings = await tx.booking.findMany({
        where: {
          clientId: client.id,
          status: {
            in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
          },
        },
        select: {
          id: true,
          status: true,
          clientEmailSnapshot: true,
          clientPhoneSnapshot: true,
        },
      });
      const touchedBookings = activeBookings.filter((booking) => {
        const bookingEmail = booking.clientEmailSnapshot.trim();
        const bookingPhone = booking.clientPhoneSnapshot ?? null;

        return bookingEmail !== (normalizedEmail ?? "") || bookingPhone !== normalizedPhone;
      });
      const activeBookingIds = touchedBookings.map((booking) => booking.id);

      await tx.client.update({
        where: { id: client.id },
        data: {
          email: normalizedEmail,
          phone: normalizedPhone,
        },
      });

      if (activeBookingIds.length > 0) {
        await tx.booking.updateMany({
          where: {
            id: {
              in: activeBookingIds,
            },
          },
          data: {
            clientEmailSnapshot: normalizedEmail ?? "",
            clientPhoneSnapshot: normalizedPhone,
          },
        });

        await tx.emailLog.updateMany({
          where: {
            clientId: client.id,
            bookingId: {
              in: activeBookingIds,
            },
            status: EmailLogStatus.PENDING,
            processingStartedAt: null,
          },
          data: {
            recipientEmail: normalizedEmail ?? "",
          },
        });

        await tx.bookingStatusHistory.createMany({
          data: touchedBookings.map((booking) => ({
            bookingId: booking.id,
            status: booking.status,
            actorType: BookingActorType.USER,
            actorUserId: actorUser?.id ?? null,
            reason: "Kontakt klientky upraven",
            metadata: {
              source: "admin-client-contact-update-v1",
              previousEmail: booking.clientEmailSnapshot,
              previousPhone: booking.clientPhoneSnapshot,
              nextEmail: normalizedEmail,
              nextPhone: normalizedPhone,
            },
          })),
        });
      }

      return activeBookingIds;
    });

    revalidateClientPaths(client.id);
    revalidateBookingPaths(touchedBookingIds);
    revalidatePath("/admin/email-logy");

    return {
      status: "success",
      successMessage:
        touchedBookingIds.length > 0
          ? `Kontakt je uložený a propsal se do ${touchedBookingIds.length} aktivních rezervací. Proběhlé rezervace zůstaly beze změny.`
          : "Kontakt je uložený.",
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        status: "error",
        formError: "Tento e-mail už používá jiná klientka.",
        fieldErrors: {
          email: "Použijte jiný e-mail nebo nejdřív sloučte duplicitní profil.",
        },
      };
    }

    console.error("Failed to update client contact", error);

    return {
      status: "error",
      formError: "Kontakt se teď nepodařilo uložit. Zkuste to prosím znovu.",
    };
  }
}
