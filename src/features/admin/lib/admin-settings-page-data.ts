import { ensureSiteSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { getOwnerCalendarFeedAdminState } from "@/features/calendar/lib/calendar-feed-service";

export async function getAdminSettingsPageData(email: string) {
  const settings = await ensureSiteSettings();
  const selectedMediaIds = [...new Set([settings.voucherPdfLogoMediaId, settings.contactPhotoMediaId, settings.homePortraitMediaId, settings.aboutPortraitMediaId].filter((id): id is string => Boolean(id)))];
  const [calendarFeed, ownerNotificationSettings, mediaAssets] = await Promise.all([
    getOwnerCalendarFeedAdminState(),
    prisma.adminUser.findFirst({
      where: {
        email: {
          equals: email.trim(),
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
    selectedMediaIds.length ? prisma.mediaAsset.findMany({ where: { id: { in: selectedMediaIds }, deletionRequestedAt: null }, select: { id: true, title: true, fileName: true, altText: true, visibility: true, isPublished: true, thumbnailUrl: true, optimizedUrl: true, url: true } }) : Promise.resolve([]),
  ]);

  const formatDateTime = new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    salonName: settings.salonName,
    addressLine: settings.addressLine,
    city: settings.city,
    postalCode: settings.postalCode,
    phone: settings.phone,
    contactEmail: settings.contactEmail,
    instagramUrl: settings.instagramUrl,
    voucherPdfLogoMediaId: settings.voucherPdfLogoMediaId,
    contactPhotoMediaId: settings.contactPhotoMediaId ?? null,
    homePortraitMediaId: settings.homePortraitMediaId ?? null,
    aboutPortraitMediaId: settings.aboutPortraitMediaId ?? null,
    selectedMediaOptions: mediaAssets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      fileName: asset.fileName,
      altText: asset.altText,
      thumbnailPublicUrl: asset.visibility === "PUBLIC" && asset.isPublished ? asset.thumbnailUrl ?? asset.optimizedUrl ?? asset.url : null,
      publicUrl: asset.visibility === "PUBLIC" && asset.isPublished ? asset.optimizedUrl ?? asset.url : null,
    })),
    bookingMinAdvanceHours: settings.bookingMinAdvanceHours,
    bookingMaxAdvanceDays: settings.bookingMaxAdvanceDays,
    bookingCancellationHours: settings.bookingCancellationHours,
    autoLunchEnabled: settings.autoLunchEnabled,
    notificationAdminEmail: settings.notificationAdminEmail,
    emailSenderName: settings.emailSenderName,
    emailSenderEmail: settings.emailSenderEmail,
    emailFooterText: settings.emailFooterText,
    updatedAt: formatDateTime.format(settings.updatedAt),
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
  };
}
