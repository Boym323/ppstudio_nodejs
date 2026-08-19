import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

import { type AdminArea } from "@/config/navigation";
import { AdminBookingDetailPage } from "@/features/admin/components/admin-booking-detail-page";
import { AdminBookingsPage } from "@/features/admin/components/admin-bookings-page";
import { AdminOverviewPage } from "@/features/admin/components/admin-overview-page";
import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import { AdminSettingsPage } from "@/features/admin/components/admin-settings-page";
import { AdminMediaPage } from "@/features/admin/components/admin-media-page";
import { AdminClientDetailPage } from "@/features/admin/components/admin-client-detail-page";
import { AdminVoucherForm } from "@/features/admin/components/admin-voucher-form";
import { AdminVoucherDetailPage } from "@/features/admin/components/admin-voucher-detail-page";
import { AdminClientsPage } from "@/features/admin/components/admin-clients-page";
import { AdminVouchersPage } from "@/features/admin/components/admin-vouchers-page";
import { AdminUsersPage } from "@/features/admin/components/admin-users-page";
import { AdminServiceCategoriesPage } from "@/features/admin/components/admin-service-categories-page";
import { AdminServicesPage } from "@/features/admin/components/admin-services-page";
import { AdminKpiDashboard } from "@/features/admin/components/admin-kpi-dashboard";
import { getAdminSectionPath } from "@/features/admin/lib/admin-paths";
import { getAdminSettingsPageData } from "@/features/admin/lib/admin-settings-page-data";
import { requireAdminArea } from "@/lib/auth/session";

import { getAdminBookingDetailData } from "./booking/booking-detail";
import { getAdminClientDetailData } from "./admin-clients";
import { getAdminVoucherCreatePageData, getAdminVoucherDetailData } from "./admin-vouchers";
import { isAdminSectionSlug, requireAdminSectionAccess } from "./admin-guards";
import { findSlotWeekContext } from "./admin-slots";

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

type AdminClientDetailParams = Promise<{
  clientId: string;
}>;

type AdminVoucherDetailParams = Promise<{
  voucherId: string;
}>;

export function createAdminOverviewRoute(area: AdminArea) {
  return async function AdminOverviewRoute() {
    await requireAdminArea(area);

    return <AdminOverviewPage area={area} />;
  };
}

export function createAdminKpiDashboardRoute(area: AdminArea) {
  return async function AdminKpiDashboardRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    await requireAdminSectionAccess(area, "statistiky");
    return <AdminKpiDashboard area={area} searchParams={await searchParams} />;
  };
}

export function createAdminSectionRoute(area: AdminArea) {
  return async function AdminSectionRoute({
    params,
    searchParams,
  }: {
    params: AdminSectionParams;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }) {
    const { section } = await params;

    if (!isAdminSectionSlug(section)) {
      notFound();
    }

    await requireAdminSectionAccess(area, section);

    if (section === "sluzby") {
      return <AdminServicesPage area={area} searchParams={await searchParams} />;
    }

    if (section === "rezervace") {
      return <AdminBookingsPage area={area} searchParams={await searchParams} />;
    }

    if (section === "kategorie-sluzeb") {
      return <AdminServiceCategoriesPage area={area} searchParams={await searchParams} />;
    }

    if (section === "media") {
      return <AdminMediaPage area={area} searchParams={await searchParams} />;
    }

    if (section === "klienti") {
      return <AdminClientsPage area={area} searchParams={await searchParams} />;
    }

    if (section === "vouchery") {
      return <AdminVouchersPage area={area} searchParams={await searchParams} />;
    }

    if (section === "nastaveni") {
      const session = await requireAdminSectionAccess(area, section);
      const settings = await getAdminSettingsPageData(session.email);

      return (
        <AdminSettingsPage settings={settings} />
      );
    }

    if (section === "uzivatele") {
      return <AdminUsersPage />;
    }

    notFound();
  };
}

export function createAdminClientDetailRoute(area: AdminArea) {
  return async function AdminClientDetailRoute({
    params,
  }: {
    params: AdminClientDetailParams;
  }) {
    await requireAdminSectionAccess(area, "klienti");
    const { clientId } = await params;
    const data = await getAdminClientDetailData(area, clientId);

    if (!data) {
      notFound();
    }

    return <AdminClientDetailPage data={data} />;
  };
}

export function createAdminVoucherDetailRoute(area: AdminArea) {
  return async function AdminVoucherDetailRoute({
    params,
  }: {
    params: AdminVoucherDetailParams;
  }) {
    await requireAdminSectionAccess(area, "vouchery");
    const { voucherId } = await params;
    const data = await getAdminVoucherDetailData(area, voucherId);

    if (!data) {
      notFound();
    }

    return <AdminVoucherDetailPage data={data} />;
  };
}

export function createAdminVoucherCreateRoute(area: AdminArea) {
  return async function AdminVoucherCreateRoute() {
    await requireAdminSectionAccess(area, "vouchery");
    const data = await getAdminVoucherCreatePageData(area);

    return (
      <AdminPageShell
        eyebrow={area === "owner" ? "Nový voucher" : "Provozní voucher"}
        title="Vytvořit voucher"
        description="Vystavení hodnotového poukazu nebo poukazu na aktivní službu. PDF je dostupné po vytvoření v detailu voucheru; odeslání e-mailem se spouští ručně z detailu voucheru."
        compact={area === "salon"}
      >
        <AdminPanel
          title="Nový voucher"
          description="Vyplňte typ, hodnotu nebo službu, platnost a volitelné údaje kupujícího."
          compact={area === "salon"}
          denseHeader
        >
          <AdminVoucherForm data={data} />
        </AdminPanel>
      </AdminPageShell>
    );
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

export function createAdminSlotDetailRoute(area: AdminArea) {
  return async function AdminSlotDetailRoute({
    params,
  }: {
    params: AdminSlotParams;
  }) {
    await requireAdminSectionAccess(area, "volne-terminy");
    const { slotId } = await params;
    const slotContext = await findSlotWeekContext(slotId);
    const baseHref = getAdminSectionPath(area, "volne-terminy");

    if (!slotContext) {
      notFound();
    }

    redirect(`${baseHref}?week=${slotContext.weekKey}&day=${slotContext.dateKey}`);
  };
}
