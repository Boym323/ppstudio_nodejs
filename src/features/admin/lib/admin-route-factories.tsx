import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

import { type AdminArea } from "@/config/navigation";
import { AdminBookingDetailPage } from "@/features/admin/components/admin-booking-detail-page";
import { AdminBookingsPage } from "@/features/admin/components/admin-bookings-page";
import { AdminOverviewPage } from "@/features/admin/components/admin-overview-page";
import { AdminSectionPage } from "@/features/admin/components/admin-section-page";
import { AdminSettingsPage } from "@/features/admin/components/admin-settings-page";
import { AdminMediaPage } from "@/features/admin/components/admin-media-page";
import { AdminClientDetailPage } from "@/features/admin/components/admin-client-detail-page";
import { AdminClientsPage } from "@/features/admin/components/admin-clients-page";
import { AdminUsersPage } from "@/features/admin/components/admin-users-page";
import { AdminServiceCategoriesPage } from "@/features/admin/components/admin-service-categories-page";
import { AdminServicesPage } from "@/features/admin/components/admin-services-page";
import { AdminWeeklyPlannerPage } from "@/features/admin/components/admin-weekly-planner-page";
import { getOwnerCalendarFeedAdminState } from "@/features/calendar/lib/calendar-feed-service";
import { ensureSiteSettings } from "@/lib/site-settings";
import { requireAdminArea } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { getAdminBookingDetailData } from "./admin-booking";
import { getAdminClientDetailData } from "./admin-clients";
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

type AdminSearchParams = Promise<{
  week?: string;
  day?: string;
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

    if (section === "nastaveni") {
      const session = await requireAdminSectionAccess(area, section);
      const [settings, calendarFeed, ownerNotificationSettings] = await Promise.all([
        ensureSiteSettings(),
        getOwnerCalendarFeedAdminState(),
        prisma.adminUser.findFirst({
          where: {
            email: {
              equals: session.email.trim(),
              mode: "insensitive",
            },
          },
          select: {
            notificationSettings: {
              select: {
                pushoverUserKey: true,
                pushoverEnabled: true,
                notifyNewBooking: true,
                notifyBookingPending: true,
                notifyBookingConfirmed: true,
                notifyBookingCancelled: true,
                notifyBookingRescheduled: true,
                notifyEmailFailed: true,
                notifyReminderFailed: true,
                notifySystemErrors: true,
              },
            },
          },
        }),
      ]);
      const formatDateTime = new Intl.DateTimeFormat("cs-CZ", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const formattedUpdatedAt = formatDateTime.format(settings.updatedAt);

      return (
        <AdminSettingsPage
          settings={{
            salonName: settings.salonName,
            addressLine: settings.addressLine,
            city: settings.city,
            postalCode: settings.postalCode,
            phone: settings.phone,
            contactEmail: settings.contactEmail,
            instagramUrl: settings.instagramUrl,
            bookingMinAdvanceHours: settings.bookingMinAdvanceHours,
            bookingMaxAdvanceDays: settings.bookingMaxAdvanceDays,
            bookingCancellationHours: settings.bookingCancellationHours,
            notificationAdminEmail: settings.notificationAdminEmail,
            emailSenderName: settings.emailSenderName,
            emailSenderEmail: settings.emailSenderEmail,
            emailFooterText: settings.emailFooterText,
            updatedAt: formattedUpdatedAt,
            calendarFeed: {
              isActive: calendarFeed.isActive,
              subscriptionUrl: calendarFeed.subscriptionUrl,
              updatedAtLabel: formatDateTime.format(calendarFeed.updatedAt),
              rotatedAtLabel: calendarFeed.rotatedAt ? formatDateTime.format(calendarFeed.rotatedAt) : null,
              revokedAtLabel: calendarFeed.revokedAt ? formatDateTime.format(calendarFeed.revokedAt) : null,
              updatedByName: calendarFeed.updatedByName,
            },
            pushover: {
              pushoverUserKey: ownerNotificationSettings?.notificationSettings?.pushoverUserKey ?? null,
              pushoverEnabled: ownerNotificationSettings?.notificationSettings?.pushoverEnabled ?? false,
              notifyNewBooking: ownerNotificationSettings?.notificationSettings?.notifyNewBooking ?? true,
              notifyBookingPending: ownerNotificationSettings?.notificationSettings?.notifyBookingPending ?? true,
              notifyBookingConfirmed: ownerNotificationSettings?.notificationSettings?.notifyBookingConfirmed ?? true,
              notifyBookingCancelled: ownerNotificationSettings?.notificationSettings?.notifyBookingCancelled ?? true,
              notifyBookingRescheduled: ownerNotificationSettings?.notificationSettings?.notifyBookingRescheduled ?? true,
              notifyEmailFailed: ownerNotificationSettings?.notificationSettings?.notifyEmailFailed ?? true,
              notifyReminderFailed: ownerNotificationSettings?.notificationSettings?.notifyReminderFailed ?? true,
              notifySystemErrors: ownerNotificationSettings?.notificationSettings?.notifySystemErrors ?? true,
            },
          }}
        />
      );
    }

    if (section === "uzivatele") {
      return <AdminUsersPage />;
    }

    return <AdminSectionPage area={area} section={section} />;
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

export function createAdminSlotsRoute(area: AdminArea, _mode: "list" | "create") {
  return async function AdminSlotsRoute({
    searchParams,
  }: {
    searchParams: AdminSearchParams;
  }) {
    void _mode;
    await requireAdminSectionAccess(area, "volne-terminy");
    const { week, day } = await searchParams;

    return <AdminWeeklyPlannerPage area={area} week={week} day={day} />;
  };
}

export function createAdminSlotDetailRoute(area: AdminArea, _mode: "detail" | "edit") {
  return async function AdminSlotDetailRoute({
    params,
  }: {
    params: AdminSlotParams;
  }) {
    void _mode;
    await requireAdminSectionAccess(area, "volne-terminy");
    const { slotId } = await params;
    const slotContext = await findSlotWeekContext(slotId);
    const baseHref = area === "owner" ? "/admin/volne-terminy" : "/admin/provoz/volne-terminy";

    if (!slotContext) {
      notFound();
    }

    redirect(`${baseHref}?week=${slotContext.weekKey}&day=${slotContext.dateKey}`);
  };
}
