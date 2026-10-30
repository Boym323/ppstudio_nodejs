"use server";

import {
  BookingActorType,
  BookingStatus,
  Prisma,
} from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

import { type AdminArea } from "@/config/navigation";
import { type UpdateClientContactActionState } from "@/features/admin/actions/update-client-contact-action-state";
import { type UpdateClientNoteActionState } from "@/features/admin/actions/update-client-note-action-state";
import { createResendEmailLog } from "@/features/admin/actions/email-log-resend";
import {
  updateClientContactSchema,
  updateClientNoteSchema,
} from "@/features/admin/lib/admin-client-validation";
import {
  CLIENT_PHONE_FORMAT_MESSAGE,
  isValidClientPhoneInput,
  normalizeClientEmail,
  normalizeClientPhone,
} from "@/features/booking/lib/booking-public";
import {
  getBookingIdsWithChangedEmailSnapshot,
  rotateClientBookingTokensForEmailChange,
} from "@/features/admin/lib/client-contact-token-rotation";
import { requireAdminArea } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isEmailDeliveryFailure } from "@/lib/email/incidents";
import { scrubSensitiveEmailPayload } from "@/lib/email/payload-security";
import { runSerializableTransaction } from "@/lib/serializable-transaction";

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
  const incidentEmailLogId = readFormString(formData, "incidentEmailLogId");
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
  if (incidentEmailLogId && area !== "owner") {
    return { status: "error", formError: "Opravu e-mailového incidentu může provést pouze vlastník." };
  }

  if (parsed.data.phone && !isValidClientPhoneInput(parsed.data.phone)) {
    return {
      status: "error",
      formError: "Kontakt se nepodařilo uložit. Zkontrolujte prosím formulář.",
      fieldErrors: {
        phone: CLIENT_PHONE_FORMAT_MESSAGE,
      },
    };
  }

  const normalizedEmail = parsed.data.email ? normalizeClientEmail(parsed.data.email) : null;
  let normalizedPhone = parsed.data.phone ? normalizeClientPhone(parsed.data.phone) : null;

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

    const touchedBookingIds = await runSerializableTransaction(async (tx) => {
      // Resend CLIENT recipient lockuje stejného Clienta před bookingy. Oba
      // flow proto používají pořadí Client -> Booking a nemohou rozhodnout o
      // kontaktu podle starého snapshotu před změnou e-mailu.
      await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "Client"
        WHERE "id" = ${client.id}
        FOR UPDATE
      `);
      const currentClient = await tx.client.findUnique({
        where: { id: client.id },
        select: { id: true, email: true, phone: true },
      });

      if (!currentClient) {
        throw new Error("Client disappeared during contact update.");
      }

      if (incidentEmailLogId) normalizedPhone = currentClient.phone;

      const now = new Date();
      const activeBookings = await tx.booking.findMany({
        where: {
          clientId: client.id,
          status: {
            in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
          },
          scheduledStartsAt: {
            gte: now,
          },
        },
        select: {
          id: true,
          status: true,
          clientEmailSnapshot: true,
          clientPhoneSnapshot: true,
          communicationGeneration: true,
        },
      });
      const source = incidentEmailLogId ? await tx.emailLog.findUnique({
        where: { id: incidentEmailLogId },
        include: {
          client: { select: { id: true, email: true } },
          booking: { select: { id: true, clientEmailSnapshot: true } },
          resendRoot: { select: { incidentResolvedAt: true } },
        },
      }) : null;
      const sourceBooking = source?.bookingId ? activeBookings.find((booking) => booking.id === source.bookingId) : null;
      if (incidentEmailLogId && (
        !source || source.clientId !== client.id || source.audience !== "CLIENT"
        || source.processingStartedAt !== null || !isEmailDeliveryFailure(source)
        || (source.resendRoot?.incidentResolvedAt ?? source.incidentResolvedAt) !== null
        || !normalizedEmail
        || (source.bookingId !== null && (!sourceBooking || source.communicationGeneration !== sourceBooking.communicationGeneration))
      )) {
        throw new Error("EMAIL_INCIDENT_CHANGED");
      }
      if (source && normalizedEmail === normalizeClientEmail(source.recipientEmail)) {
        throw new Error("EMAIL_RECIPIENT_UNCHANGED");
      }
      const bookingIdsWithChangedEmailSnapshot = getBookingIdsWithChangedEmailSnapshot(
        activeBookings,
        normalizedEmail,
      );
      const touchedBookings = activeBookings.filter((booking) => {
        const bookingEmail = booking.clientEmailSnapshot.trim();
        const bookingPhone = booking.clientPhoneSnapshot ?? null;

        return bookingEmail !== (normalizedEmail ?? "") || bookingPhone !== normalizedPhone;
      });

      await tx.client.update({
        where: { id: client.id },
        data: {
          email: normalizedEmail,
          phone: normalizedPhone,
        },
      });

      if (bookingIdsWithChangedEmailSnapshot.length > 0) {
        // Rotation nejdřív zamkne Bookingy a ověří lease; teprve potom smí
        // změnit e-mailový snapshot a zvýšit generaci.
        await rotateClientBookingTokensForEmailChange(tx, {
          clientId: client.id,
          bookingIds: bookingIdsWithChangedEmailSnapshot,
          newEmail: normalizedEmail,
          now,
        });
      }

      if (touchedBookings.length > 0) {
        await tx.booking.updateMany({
          where: {
            id: {
              in: touchedBookings.map((booking) => booking.id),
            },
            status: {
              in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
            },
            scheduledStartsAt: {
              gte: now,
            },
          },
          data: {
            clientEmailSnapshot: normalizedEmail ?? "",
            clientPhoneSnapshot: normalizedPhone,
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

      if (source && normalizedEmail) {
        if (sourceBooking && bookingIdsWithChangedEmailSnapshot.includes(sourceBooking.id)) {
          const pendingCopies = await tx.emailLog.findMany({
            where: { bookingId: sourceBooking.id, audience: "CLIENT", status: "PENDING", type: source.type, templateKey: source.templateKey },
            select: { id: true, payload: true, resendRootId: true, processingStartedAt: true },
          });
          if (pendingCopies.some((log) => log.resendRootId || log.processingStartedAt)) throw new Error("EMAIL_INCIDENT_CHANGED");
          for (const log of pendingCopies) {
            await tx.emailLog.update({ where: { id: log.id }, data: {
              status: "SENT", provider: "system-skip", sentAt: now,
              errorMessage: "E-mail byl nahrazen opakovaným odesláním po opravě adresy.",
              payload: scrubSensitiveEmailPayload(log.payload),
            } });
          }
        }
        const resend = await createResendEmailLog({
          emailLog: source,
          transaction: tx,
          expectedBookingGeneration: sourceBooking
            ? sourceBooking.communicationGeneration + (bookingIdsWithChangedEmailSnapshot.includes(sourceBooking.id) ? 1 : 0)
            : undefined,
        });
        if (!resend) throw new Error("EMAIL_INCIDENT_CHANGED");
      }

      return touchedBookings.map((booking) => booking.id);
    });

    revalidateClientPaths(client.id);
    revalidateBookingPaths(touchedBookingIds);
    revalidatePath("/admin/email-logy");

    return {
      status: "success",
      successMessage: incidentEmailLogId
        ? "Adresa je opravená a nový pokus je ve frontě. Problém se uzavře po potvrzení doručení."
        :
        touchedBookingIds.length > 0
          ? `Kontakt je uložený a propsal se do ${touchedBookingIds.length} aktivních rezervací. Proběhlé rezervace zůstaly beze změny.`
          : "Kontakt je uložený.",
    };
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_RECIPIENT_UNCHANGED") {
      return { status: "error", formError: "Zadejte opravenou e-mailovou adresu.", fieldErrors: { email: "Adresa se neliší od příjemce nedoručeného e-mailu." } };
    }
    if (error instanceof Error && error.message === "EMAIL_INCIDENT_CHANGED") {
      return { status: "error", formError: "E-mail nebo rezervace se mezitím změnily, případně zprávu už nelze bezpečně opakovat. Obnovte detail a zkontrolujte aktuální stav." };
    }
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
