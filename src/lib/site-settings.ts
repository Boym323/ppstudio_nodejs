import { cache } from "react";

import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

export const SITE_SETTINGS_ID = "site-settings";

type SiteSettingsRecord = {
  id: string;
  salonName: string;
  addressLine: string;
  city: string;
  postalCode: string;
  phone: string;
  contactEmail: string;
  instagramUrl: string | null;
  bookingMinAdvanceHours: number;
  bookingMaxAdvanceDays: number;
  bookingCancellationHours: number;
  notificationAdminEmail: string;
  emailSenderName: string;
  emailSenderEmail: string;
  emailFooterText: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function getDefaultSiteSettings() {
  return {
    id: SITE_SETTINGS_ID,
    salonName: env.NEXT_PUBLIC_APP_NAME,
    addressLine: "Masarykova 12",
    city: "Brno",
    postalCode: "602 00",
    phone: "+420 777 000 000",
    contactEmail: "hello@ppstudio.cz",
    instagramUrl: "https://www.instagram.com/ppstudio.cz/",
    bookingMinAdvanceHours: 2,
    bookingMaxAdvanceDays: 90,
    bookingCancellationHours: 48,
    notificationAdminEmail: env.ADMIN_OWNER_EMAIL,
    emailSenderName: env.SMTP_FROM_NAME,
    emailSenderEmail: env.SMTP_FROM_EMAIL ?? "hello@ppstudio.cz",
    emailFooterText:
      "Pokud budete potřebovat pomoci, napište nám nebo zavolejte. Rádi vám pomůžeme s výběrem i změnou termínu.",
  };
}

const loadSiteSettings = cache(async (): Promise<SiteSettingsRecord> => {
  const defaults = getDefaultSiteSettings();

  return prisma.siteSettings.upsert({
    where: {
      id: SITE_SETTINGS_ID,
    },
    update: {},
    create: defaults,
  });
});

export async function getSiteSettings() {
  return loadSiteSettings();
}

export function getSalonAddressLine(settings: Pick<SiteSettingsRecord, "addressLine" | "postalCode" | "city">) {
  return `${settings.addressLine}, ${settings.postalCode} ${settings.city}`;
}

export async function getPublicSalonProfile() {
  const settings = await getSiteSettings();

  return {
    name: settings.salonName,
    phone: settings.phone,
    email: settings.contactEmail,
    instagramUrl: settings.instagramUrl,
    addressLine: getSalonAddressLine(settings),
    bookingLabel: "Dle vypsaných termínů a individuální domluvy",
  };
}

export async function getBookingPolicySettings() {
  const settings = await getSiteSettings();

  return {
    minAdvanceHours: settings.bookingMinAdvanceHours,
    maxAdvanceDays: settings.bookingMaxAdvanceDays,
    cancellationHours: settings.bookingCancellationHours,
  };
}

export async function getEmailBrandingSettings() {
  const settings = await getSiteSettings();

  return {
    salonName: settings.salonName,
    phone: settings.phone,
    contactEmail: settings.contactEmail,
    senderName: settings.emailSenderName,
    senderEmail: settings.emailSenderEmail,
    footerText: settings.emailFooterText,
    notificationAdminEmail: settings.notificationAdminEmail,
  };
}

export async function getSiteSettingsAuditMeta() {
  const settings = await getSiteSettings();

  return {
    updatedAt: settings.updatedAt,
    updatedByUserId: settings.updatedByUserId,
  };
}

export function getBookingWindowStart(now: Date, minAdvanceHours: number) {
  return new Date(now.getTime() + minAdvanceHours * 60 * 60 * 1000);
}

export function getBookingWindowEnd(now: Date, maxAdvanceDays: number) {
  return new Date(now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000);
}

export function isBookingWithinWindow(
  startsAt: Date,
  now: Date,
  minAdvanceHours: number,
  maxAdvanceDays: number,
) {
  return (
    startsAt >= getBookingWindowStart(now, minAdvanceHours) &&
    startsAt <= getBookingWindowEnd(now, maxAdvanceDays)
  );
}

export function canClientCancelBooking(
  startsAt: Date,
  now: Date,
  cancellationHours: number,
) {
  return startsAt.getTime() - now.getTime() >= cancellationHours * 60 * 60 * 1000;
}
