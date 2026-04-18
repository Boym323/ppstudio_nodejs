import { connection } from "next/server";

import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";
import { BookingPage } from "@/features/booking/components/booking-page";

export default async function ReservationPage() {
  await connection();

  const catalog = await getPublicBookingCatalog();

  return <BookingPage catalog={catalog} />;
}
