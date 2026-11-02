import {
  BookingActorType,
  BookingStatus,
  EmailAudience,
  EmailLogStatus,
  EmailLogType,
  Prisma,
} from "@/generated/prisma/client";

import { rotateClientBookingTokensForEmailChange } from "@/features/admin/lib/client-contact-token-rotation";
import { loadClientMergePreview } from "@/features/admin/lib/client-merge-preview";
import { normalizeClientEmail } from "@/features/booking/lib/booking-public";
import { CLIENT_MERGE_AUDIT_MARKER } from "@/features/clients/lib/client-merge-marker";
import { runSerializableTransaction } from "@/lib/serializable-transaction";

export class ClientMergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientMergeError";
  }
}

export async function mergeClientProfiles(input: {
  sourceClientId: string;
  targetClientId: string;
  actorUserId: string | null;
  expectedSourceEmail: string;
  expectedTargetEmail: string;
  expectedFingerprint: string;
  nameChoice: "source" | "target";
  phoneChoice: "source" | "target";
}) {
  if (input.sourceClientId === input.targetClientId) {
    throw new ClientMergeError("Zdrojový a cílový profil musí být různé.");
  }

  return runSerializableTransaction(async (tx) => {
    const clientIds = [input.sourceClientId, input.targetClientId].sort();
    const lockedClients = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "Client"
      WHERE "id" IN (${Prisma.join(clientIds)})
      ORDER BY "id" FOR UPDATE
    `);
    if (lockedClients.length !== 2) throw new ClientMergeError("Jeden z profilů už neexistuje.");

    const source = await tx.client.findUnique({ where: { id: input.sourceClientId } });
    const target = await tx.client.findUnique({ where: { id: input.targetClientId } });
    if (!source || !target) throw new ClientMergeError("Jeden z profilů už neexistuje.");
    if (source.internalNote?.includes(CLIENT_MERGE_AUDIT_MARKER) || target.internalNote?.includes(CLIENT_MERGE_AUDIT_MARKER)) {
      throw new ClientMergeError("Profil obsahuje existující značku sloučení a vyžaduje ruční kontrolu.");
    }
    if (!source.email?.trim()) throw new ClientMergeError("Zdrojový profil nemá e-mail, který lze bezpečně potvrdit.");
    if (!target.email?.trim()) throw new ClientMergeError("Cílový profil nemá e-mailovou adresu.");
    const sourceEmail = source.email;
    const targetEmail = target.email;
    if (normalizeClientEmail(sourceEmail) !== normalizeClientEmail(input.expectedSourceEmail)) {
      throw new ClientMergeError("E-mail zdrojového profilu se mezitím změnil. Obnovte stránku a ověřte údaje znovu.");
    }
    if (normalizeClientEmail(targetEmail) !== normalizeClientEmail(input.expectedTargetEmail)) {
      throw new ClientMergeError("E-mail cílového profilu se mezitím změnil. Obnovte stránku a ověřte údaje znovu.");
    }
    if (!source.isActive || !target.isActive) throw new ClientMergeError("Sloučit lze pouze aktivní profily.");

    const initialBookings = await tx.booking.findMany({
      where: { clientId: { in: clientIds } },
      orderBy: { id: "asc" },
      select: { id: true, clientId: true },
    });
    const bookingIds = initialBookings.filter((booking) => booking.clientId === source.id).map((booking) => booking.id);
    const allBookingIds = initialBookings.map((booking) => booking.id);
    if (allBookingIds.length > 0) {
      await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "Booking"
        WHERE "id" IN (${Prisma.join(allBookingIds)})
        ORDER BY "id" FOR UPDATE
      `);
    }
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "EmailLog"
      WHERE "clientId" = ${source.id}
      ${bookingIds.length > 0 ? Prisma.sql`OR "bookingId" IN (${Prisma.join(bookingIds)})` : Prisma.empty}
      ORDER BY "id" FOR UPDATE
    `);
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "BookingSubmissionLog"
      WHERE "clientId" = ${source.id}
      ${bookingIds.length > 0 ? Prisma.sql`OR "bookingId" IN (${Prisma.join(bookingIds)})` : Prisma.empty}
      ORDER BY "id" FOR UPDATE
    `);

    const currentBookingIds = (await tx.booking.findMany({
      where: { clientId: source.id },
      orderBy: { id: "asc" },
      select: { id: true },
    })).map((booking) => booking.id);
    if (currentBookingIds.length !== bookingIds.length || currentBookingIds.some((id, index) => id !== bookingIds[index])) {
      throw new ClientMergeError("Rezervace profilu se mezitím změnily. Obnovte stránku a zkuste sloučení znovu.");
    }
    const currentPreview = await loadClientMergePreview(source.id, target.id, tx);
    if (!currentPreview || currentPreview.fingerprint !== input.expectedFingerprint) {
      throw new ClientMergeError("Údaje v náhledu se mezitím změnily. Načtěte náhled znovu a ověřte oba profily.");
    }
    const allBookings = await tx.booking.findMany({
        where: { clientId: { in: clientIds } },
        select: {
          id: true,
          clientId: true,
          status: true,
          scheduledStartsAt: true,
          clientEmailSnapshot: true,
          clientPhoneSnapshot: true,
          communicationGeneration: true,
          clientDeliveryLeaseExpiresAt: true,
          reminder24hQueuedAt: true,
          reminder24hSentAt: true,
        },
    });
    const sourceEmailLogs = await tx.emailLog.findMany({
        where: {
          OR: [
            { clientId: source.id },
            ...(bookingIds.length > 0 ? [{ bookingId: { in: bookingIds } }] : []),
          ],
        },
        select: { id: true, clientId: true, bookingId: true, status: true, processingStartedAt: true, audience: true, type: true, recipientEmail: true, resendRootId: true },
    });
    const sourceSubmissionLogs = await tx.bookingSubmissionLog.findMany({
        where: {
          OR: [
            { clientId: source.id },
            ...(bookingIds.length > 0 ? [{ bookingId: { in: bookingIds } }] : []),
          ],
        },
        select: { id: true, clientId: true, bookingId: true },
    });
    const oldTokens = await tx.bookingActionToken.findMany({ where: { bookingId: { in: bookingIds } }, select: { id: true, bookingId: true, type: true, revokedAt: true, usedAt: true, expiresAt: true } });
    const bookings = allBookings.filter((booking) => booking.clientId === source.id);
    const now = new Date();
    const activeFutureBookings = allBookings.filter((booking) => (
      (booking.status === BookingStatus.PENDING || booking.status === BookingStatus.CONFIRMED)
      && booking.scheduledStartsAt >= now
    ));
    const bookingsToRefresh = activeFutureBookings.filter((booking) => booking.clientId === source.id && (
      normalizeClientEmail(booking.clientEmailSnapshot) !== normalizeClientEmail(targetEmail)
    ));

    if (sourceEmailLogs.some((log) => log.status === EmailLogStatus.PENDING || log.processingStartedAt !== null)) {
      throw new ClientMergeError("Profil má e-mail ve frontě nebo právě zpracovávaný. Počkejte na dokončení a zkuste sloučení znovu.");
    }
    if (bookings.some((booking) => booking.clientDeliveryLeaseExpiresAt && booking.clientDeliveryLeaseExpiresAt > now)) {
      throw new ClientMergeError("U některé rezervace právě probíhá autorizované odesílání. Zkuste to později.");
    }
    if (sourceEmailLogs.some((log) => log.clientId && log.clientId !== source.id)
      || sourceSubmissionLogs.some((log) => log.clientId && log.clientId !== source.id)) {
      throw new ClientMergeError("Historie rezervací obsahuje vazbu na jiný profil. Sloučení vyžaduje ruční kontrolu.");
    }

    if (bookingIds.length > 0) {
      await tx.booking.updateMany({
        where: { id: { in: bookingIds }, clientId: source.id },
        data: { clientId: target.id },
      });
    }
    await tx.emailLog.updateMany({
      where: {
        OR: [
          { clientId: source.id },
          ...(bookingIds.length > 0 ? [{ bookingId: { in: bookingIds } }] : []),
        ],
      },
      data: { clientId: target.id },
    });
    await tx.bookingSubmissionLog.updateMany({
      where: {
        OR: [
          { clientId: source.id },
          ...(bookingIds.length > 0 ? [{ bookingId: { in: bookingIds } }] : []),
        ],
      },
      data: { clientId: target.id },
    });

    const selectedPhone = input.phoneChoice === "source" ? source.phone : target.phone;
    const selectedName = input.nameChoice === "source" ? source.fullName : target.fullName;
    const phoneChangedBookingIds = activeFutureBookings
      .filter((booking) => (booking.clientPhoneSnapshot ?? null) !== (selectedPhone ?? null))
      .map((booking) => booking.id);
    if (phoneChangedBookingIds.length > 0) {
      await tx.booking.updateMany({
        where: { id: { in: phoneChangedBookingIds } },
        data: { clientPhoneSnapshot: selectedPhone },
      });
    }

    if (bookingsToRefresh.length > 0) {
      await rotateClientBookingTokensForEmailChange(tx, {
        clientId: target.id,
        bookingIds: bookingsToRefresh.map((booking) => booking.id),
        newEmail: targetEmail,
        now,
      });
    }

    const mergedNote = source.internalNote?.trim()
      ? `Sloučený profil ${source.fullName} (${source.email ?? "bez e-mailu"}):\n${source.internalNote.trim()}`
      : null;
    const lastBookedAt = source.lastBookedAt && (!target.lastBookedAt || source.lastBookedAt > target.lastBookedAt)
      ? source.lastBookedAt
      : target.lastBookedAt;
    await tx.client.update({
      where: { id: target.id },
      data: {
        fullName: selectedName,
        phone: selectedPhone,
        lastBookedAt,
        ...(mergedNote ? { internalNote: [target.internalNote?.trim(), mergedNote].filter(Boolean).join("\n\n") } : {}),
      },
    });

    const replacementEmails: Array<{ bookingId: string; email: { id: string } | null }> = [];
    for (const booking of bookingsToRefresh) {
      const email = await tx.emailLog.findFirst({
        where: {
          id: { notIn: sourceEmailLogs.map((log) => log.id) },
          bookingId: booking.id,
          clientId: target.id,
          audience: EmailAudience.CLIENT,
          type: booking.status === BookingStatus.CONFIRMED ? EmailLogType.BOOKING_CONFIRMED : EmailLogType.BOOKING_RECEIVED,
          communicationGeneration: booking.communicationGeneration + 1,
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      replacementEmails.push({ bookingId: booking.id, email });
    }
    if (replacementEmails.some((item) => !item.email)) throw new ClientMergeError("Nepodařilo se připravit potvrzení rezervace; sloučení bylo vráceno.");
    const newTokens = await tx.bookingActionToken.findMany({
      where: { bookingId: { in: bookingIds }, id: { notIn: oldTokens.map((token) => token.id) } },
      select: { id: true, bookingId: true },
    });
    const createdEmailLogs = await tx.emailLog.findMany({
      where: { bookingId: { in: bookingIds }, id: { notIn: sourceEmailLogs.map((log) => log.id) } },
      select: { id: true, bookingId: true },
    });
    const audit = {
      version: 1,
      at: now.toISOString(),
      actorUserId: input.actorUserId,
      sourceBefore: { ...source, createdAt: source.createdAt.toISOString(), updatedAt: source.updatedAt.toISOString(), lastBookedAt: source.lastBookedAt?.toISOString() ?? null },
      targetBefore: { ...target, createdAt: target.createdAt.toISOString(), updatedAt: target.updatedAt.toISOString(), lastBookedAt: target.lastBookedAt?.toISOString() ?? null },
      selectedName,
      selectedPhone,
      bookingBefore: allBookings,
      emailLinksBefore: sourceEmailLogs.map(({ id, clientId, bookingId }) => ({ id, clientId, bookingId })),
      submissionLinksBefore: sourceSubmissionLogs,
      tokenBefore: oldTokens,
      createdTokenIds: newTokens.map((token) => token.id),
      createdEmailLogIds: createdEmailLogs.map((log) => log.id),
      replacementEmails,
    };
    const archivedNote = `${CLIENT_MERGE_AUDIT_MARKER}${JSON.stringify(audit)}`;
    await tx.client.update({
      where: { id: source.id },
      data: {
        email: null,
        phone: null,
        isActive: false,
        internalNote: source.internalNote?.trim()
          ? `${source.internalNote.trim()}\n${archivedNote}`
          : archivedNote,
      },
    });

    const historyBookings = allBookings.filter((booking) => booking.clientId === source.id || phoneChangedBookingIds.includes(booking.id));
    if (historyBookings.length > 0) {
      await tx.bookingStatusHistory.createMany({
        data: historyBookings.map((booking) => ({
          bookingId: booking.id,
          status: booking.status,
          actorType: input.actorUserId ? BookingActorType.USER : BookingActorType.SYSTEM,
          actorUserId: input.actorUserId,
          reason: "Duplicitní klientský profil sloučen",
          metadata: {
            source: "admin-client-merge-v1",
            sourceClientId: source.id,
            targetClientId: target.id,
            mergeReplacementEmailId: replacementEmails.find((item) => item.bookingId === booking.id)?.email?.id ?? null,
            mergeSupersededRootIds: [...new Set(sourceEmailLogs.filter((log) => {
              const root = sourceEmailLogs.find((candidate) => candidate.id === (log.resendRootId ?? log.id));
              const allowedTypes: EmailLogType[] = booking.status === BookingStatus.CONFIRMED
                ? [EmailLogType.BOOKING_RECEIVED, EmailLogType.BOOKING_CONFIRMED]
                : [EmailLogType.BOOKING_RECEIVED];
              return log.bookingId === booking.id && root?.bookingId === booking.id
                && log.audience === EmailAudience.CLIENT && root.audience === EmailAudience.CLIENT
                && allowedTypes.includes(log.type) && allowedTypes.includes(root.type)
                && normalizeClientEmail(log.recipientEmail) !== normalizeClientEmail(targetEmail);
            }).map((log) => log.resendRootId ?? log.id))],
          },
        })),
      });
    }

    return {
      sourceClientId: source.id,
      targetClientId: target.id,
      movedBookingCount: bookings.length,
      movedBookingIds: bookings.map((booking) => booking.id),
      affectedBookingIds: [...new Set([...bookingIds, ...phoneChangedBookingIds])],
      affectedEmailLogIds: [...new Set([...sourceEmailLogs.map((log) => log.id), ...replacementEmails.flatMap((item) => item.email ? [item.email.id] : [])])],
      refreshedBookingCount: bookingsToRefresh.length,
      movedEmailLogCount: sourceEmailLogs.length,
      movedSubmissionLogCount: sourceSubmissionLogs.length,
      targetFullName: selectedName,
    };
  });
}
