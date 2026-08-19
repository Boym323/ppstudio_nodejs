import { BookingStatus } from "@/generated/prisma/client";

export const ACTIVE_BOOKING_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;
