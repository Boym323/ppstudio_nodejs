import { notFound } from "next/navigation";

import { AdminBookingDetailPage } from "@/features/admin/components/admin-booking-detail-page";
import {
  isAdminSectionSlug,
  requireAdminSectionAccess,
} from "@/features/admin/lib/admin-guards";
import { getAdminBookingDetailData } from "@/features/admin/lib/admin-booking";

type OwnerAdminBookingDetailRouteProps = {
  params: Promise<{
    section: string;
    bookingId: string;
  }>;
};

export default async function OwnerAdminBookingDetailRoute({
  params,
}: OwnerAdminBookingDetailRouteProps) {
  const { section, bookingId } = await params;

  if (!isAdminSectionSlug(section) || section !== "rezervace") {
    notFound();
  }

  await requireAdminSectionAccess("owner", section);

  const data = await getAdminBookingDetailData("owner", bookingId);

  if (!data) {
    notFound();
  }

  return <AdminBookingDetailPage data={data} />;
}
