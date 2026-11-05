import { createHash } from "node:crypto";

import { BookingStatus, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type ClientMergePreviewProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  bookingCount: number;
  lastVisit: { service: string; startsAt: string } | null;
  upcoming: Array<{ id: string; service: string; startsAt: string }>;
};

export type ClientMergePreview = {
  source: ClientMergePreviewProfile;
  target: ClientMergePreviewProfile;
  fingerprint: string;
};

/** Přehled i jeho otisk vycházejí ze stejných dat, která se znovu ověří v transakci. */
export async function loadClientMergePreview(
  sourceId: string,
  targetId: string,
  db: typeof prisma | Prisma.TransactionClient = prisma,
): Promise<ClientMergePreview | null> {
  const source = await db.client.findUnique({ where: { id: sourceId } });
  const target = await db.client.findUnique({ where: { id: targetId } });
  const bookings = await db.booking.findMany({
      where: { clientId: { in: [sourceId, targetId] } },
      orderBy: { id: "asc" },
      select: { id: true, clientId: true, updatedAt: true, scheduledStartsAt: true, status: true, serviceNameSnapshot: true },
  });
  if (!source?.email || !target?.email || !source.isActive || !target.isActive || source.id === target.id) return null;
  const sourceBookingIds = bookings.filter((booking) => booking.clientId === sourceId).map((booking) => booking.id);
  const relationWhere = {
    OR: [
      { clientId: sourceId },
      ...(sourceBookingIds.length ? [{ bookingId: { in: sourceBookingIds } }] : []),
    ],
  };
  const emailLogs = await db.emailLog.findMany({ where: relationWhere, orderBy: { id: "asc" }, select: { id: true, updatedAt: true } });
  const submissionLogs = await db.bookingSubmissionLog.findMany({ where: relationWhere, orderBy: { id: "asc" }, select: { id: true, updatedAt: true } });
  const now = new Date();
  const profile = (client: typeof source): ClientMergePreviewProfile => {
    const items = bookings.filter((booking) => booking.clientId === client.id);
    const lastVisit = items.filter((booking) => booking.status === BookingStatus.COMPLETED)
      .sort((a, b) => b.scheduledStartsAt.getTime() - a.scheduledStartsAt.getTime())[0];
    return {
      id: client.id,
      fullName: client.fullName,
      email: client.email!,
      phone: client.phone,
      bookingCount: items.length,
      lastVisit: lastVisit ? { service: lastVisit.serviceNameSnapshot, startsAt: lastVisit.scheduledStartsAt.toISOString() } : null,
      upcoming: items
        .filter((booking) => (booking.status === BookingStatus.PENDING || booking.status === BookingStatus.CONFIRMED) && booking.scheduledStartsAt >= now)
        .sort((a, b) => a.scheduledStartsAt.getTime() - b.scheduledStartsAt.getTime())
        .map((booking) => ({ id: booking.id, service: booking.serviceNameSnapshot, startsAt: booking.scheduledStartsAt.toISOString() })),
    };
  };
  const fingerprint = createHash("sha256").update(JSON.stringify({
    source: { id: source.id, updatedAt: source.updatedAt },
    target: { id: target.id, updatedAt: target.updatedAt },
    bookings: bookings.map(({ id, clientId, updatedAt }) => ({ id, clientId, updatedAt })),
    upcomingBookingIds: bookings.filter((booking) => (booking.status === BookingStatus.PENDING || booking.status === BookingStatus.CONFIRMED) && booking.scheduledStartsAt >= now).map((booking) => booking.id),
    emailLogs,
    submissionLogs,
  })).digest("hex");
  return { source: profile(source), target: profile(target), fingerprint };
}
