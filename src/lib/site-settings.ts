import { cache } from "react";

import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

export const SITE_SETTINGS_ID = "site-settings";
const DEFAULT_OPERATOR_NAME = "Pavlína Pomykalová";
const DEFAULT_BUSINESS_ID = "234 275 66";

export type SiteSettingsRecord = {
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
  voucherPdfLogoMediaId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function getDefaultSiteSettingsData() {
  return {
    id: SITE_SETTINGS_ID,
    salonName: env.NEXT_PUBLIC_APP_NAME,
    addressLine: "Sadová 2",
    city: "Zlín",
    postalCode: "760 01",
    phone: "+420 732 856 036",
    contactEmail: "info@ppstudio.cz",
    instagramUrl: "https://www.instagram.com/ppstudio.cz/",
    bookingMinAdvanceHours: 2,
    bookingMaxAdvanceDays: 90,
    bookingCancellationHours: 48,
    notificationAdminEmail: env.ADMIN_OWNER_EMAIL,
    emailSenderName: env.SMTP_FROM_NAME,
    emailSenderEmail: env.SMTP_FROM_EMAIL ?? "info@ppstudio.cz",
    emailFooterText:
      "Pokud budete potřebovat pomoci, napište nám nebo zavolejte. Rádi vám pomůžeme s výběrem i změnou termínu.",
    voucherPdfLogoMediaId: null,
  };
}

function buildDefaultSiteSettingsRecord(): SiteSettingsRecord {
  const now = new Date();

  return {
    ...getDefaultSiteSettingsData(),
    updatedByUserId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function isTestRuntime() {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.npm_lifecycle_event === "test" ||
    process.execArgv.includes("--test")
  );
}

async function readSiteSettingsFromDb() {
  if (isTestRuntime()) {
    return null;
  }

  return prisma.siteSettings.findUnique({
    where: {
      id: SITE_SETTINGS_ID,
    },
  });
}

const readSiteSettings = cache(async (): Promise<SiteSettingsRecord | null> => readSiteSettingsFromDb());

const createSiteSettings = cache(async (): Promise<SiteSettingsRecord> => {
  return prisma.siteSettings.upsert({
    where: {
      id: SITE_SETTINGS_ID,
    },
    update: {},
    create: getDefaultSiteSettingsData(),
  });
});

export async function getSiteSettings() {
  const settings = await readSiteSettings().catch(() => null);

  return settings ?? buildDefaultSiteSettingsRecord();
}

export async function ensureSiteSettings() {
  return createSiteSettings();
}

export function getSalonAddressLine(settings: Pick<SiteSettingsRecord, "addressLine" | "postalCode" | "city">) {
  return `${settings.addressLine}, ${settings.postalCode} ${settings.city}`;
}

export async function getPublicSalonProfile() {
  const settings = await getSiteSettings();

  return {
    name: settings.salonName,
    operatorName: DEFAULT_OPERATOR_NAME,
    businessId: DEFAULT_BUSINESS_ID,
    phone: settings.phone,
    email: settings.contactEmail,
    instagramUrl: settings.instagramUrl,
    streetAddress: settings.addressLine,
    postalCode: settings.postalCode,
    city: settings.city,
    addressLine: getSalonAddressLine(settings),
    bookingLabel: "Dle vypsaných termínů a individuální domluvy",
  };
}

export type PublicSalonProfile = Awaited<ReturnType<typeof getPublicSalonProfile>>;

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

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isSenderEmailAllowedBySmtpPolicy(senderEmail: string) {
  if (env.EMAIL_DELIVERY_MODE !== "background") {
    return true;
  }

  if (!env.SMTP_FROM_EMAIL) {
    return true;
  }

  return normalizeEmail(senderEmail) === normalizeEmail(env.SMTP_FROM_EMAIL);
}

export function getSafeEnvelopeFromEmail(senderEmail: string) {
  if (isSenderEmailAllowedBySmtpPolicy(senderEmail)) {
    return senderEmail;
  }

  return env.SMTP_FROM_EMAIL ?? senderEmail;
}

export async function getSiteSettingsAuditMeta() {
  const settings = await ensureSiteSettings();

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
