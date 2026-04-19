import { notFound } from "next/navigation";

import { AdminBookingDetailPage } from "@/features/admin/components/admin-booking-detail-page";
import {
  isAdminSectionSlug,
  requireAdminSectionAccess,
} from "@/features/admin/lib/admin-guards";
import { getAdminBookingDetailData } from "@/features/admin/lib/admin-booking";

type SalonAdminBookingDetailRouteProps = {
  params: Promise<{
    section: string;
    bookingId: string;
  }>;
};

export default async function SalonAdminBookingDetailRoute({
  params,
}: SalonAdminBookingDetailRouteProps) {
  const { section, bookingId } = await params;

  if (!isAdminSectionSlug(section) || section !== "rezervace") {
    notFound();
  }

  await requireAdminSectionAccess("salon", section);

  const data = await getAdminBookingDetailData("salon", bookingId);

  if (!data) {
    notFound();
  }

  return <AdminBookingDetailPage data={data} />;
}
