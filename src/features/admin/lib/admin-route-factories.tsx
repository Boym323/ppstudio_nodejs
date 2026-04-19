import { notFound } from "next/navigation";

import { type AdminArea } from "@/config/navigation";
import { AdminBookingDetailPage } from "@/features/admin/components/admin-booking-detail-page";
import { AdminOverviewPage } from "@/features/admin/components/admin-overview-page";
import { AdminSectionPage } from "@/features/admin/components/admin-section-page";
import { AdminSlotsResetPage } from "@/features/admin/components/admin-slots-reset-page";
import { requireAdminArea } from "@/lib/auth/session";

import { getAdminBookingDetailData } from "./admin-booking";
import { isAdminSectionSlug, requireAdminSectionAccess } from "./admin-guards";

type AdminSectionParams = Promise<{
  section: string;
}>;

type AdminBookingDetailParams = Promise<{
  section: string;
  bookingId: string;
}>;

type AdminSlotParams = Promise<{
  slotId: string;
}>;

export function createAdminOverviewRoute(area: AdminArea) {
  return async function AdminOverviewRoute() {
    await requireAdminArea(area);

    return <AdminOverviewPage area={area} />;
  };
}

export function createAdminSectionRoute(area: AdminArea) {
  return async function AdminSectionRoute({
    params,
  }: {
    params: AdminSectionParams;
  }) {
    const { section } = await params;

    if (!isAdminSectionSlug(section)) {
      notFound();
    }

    await requireAdminSectionAccess(area, section);

    return <AdminSectionPage area={area} section={section} />;
  };
}

export function createAdminBookingDetailRoute(area: AdminArea) {
  return async function AdminBookingDetailRoute({
    params,
  }: {
    params: AdminBookingDetailParams;
  }) {
    const { section, bookingId } = await params;

    if (!isAdminSectionSlug(section) || section !== "rezervace") {
      notFound();
    }

    await requireAdminSectionAccess(area, section);

    const data = await getAdminBookingDetailData(area, bookingId);

    if (!data) {
      notFound();
    }

    return <AdminBookingDetailPage data={data} />;
  };
}

export function createAdminSlotsRoute(area: AdminArea, mode: "list" | "create") {
  return async function AdminSlotsRoute() {
    await requireAdminSectionAccess(area, "volne-terminy");

    return <AdminSlotsResetPage area={area} mode={mode} />;
  };
}

export function createAdminSlotDetailRoute(area: AdminArea, mode: "detail" | "edit") {
  return async function AdminSlotDetailRoute({
    params,
  }: {
    params: AdminSlotParams;
  }) {
    await requireAdminSectionAccess(area, "volne-terminy");
    const { slotId } = await params;

    return <AdminSlotsResetPage area={area} mode={mode} slotId={slotId} />;
  };
}
