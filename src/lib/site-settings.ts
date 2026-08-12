import { cache } from "react";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { env, siteSettingsSnapshotPath } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover-core";

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
  autoLunchEnabled: boolean;
  notificationAdminEmail: string;
  emailSenderName: string;
  emailSenderEmail: string;
  emailFooterText: string | null;
  voucherPdfLogoMediaId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SiteSettingsSource = "database" | "snapshot" | "default";

export type SiteSettingsReadResult = {
  settings: SiteSettingsRecord;
  source: SiteSettingsSource;
};

const siteSettingsSnapshotSchema = z.object({
  id: z.literal(SITE_SETTINGS_ID),
  salonName: z.string(),
  addressLine: z.string(),
  city: z.string(),
  postalCode: z.string(),
  phone: z.string(),
  contactEmail: z.string(),
  instagramUrl: z.string().nullable(),
  bookingMinAdvanceHours: z.number().int().nonnegative(),
  bookingMaxAdvanceDays: z.number().int().positive(),
  bookingCancellationHours: z.number().int().nonnegative(),
  autoLunchEnabled: z.boolean().default(true),
  notificationAdminEmail: z.string(),
  emailSenderName: z.string(),
  emailSenderEmail: z.string(),
  emailFooterText: z.string().nullable(),
  voucherPdfLogoMediaId: z.string().nullable(),
  updatedByUserId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const SITE_SETTINGS_FALLBACK_ALERT_WINDOW_MS = 5 * 60 * 1000;
let lastFallbackAlertAt = 0;

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
    bookingCancellationHours: 24,
    autoLunchEnabled: true,
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

export async function persistSiteSettingsSnapshot(settings: SiteSettingsRecord) {
  const directory = path.dirname(siteSettingsSnapshotPath);
  const temporaryPath = `${siteSettingsSnapshotPath}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, JSON.stringify(settings), { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, siteSettingsSnapshotPath);
  } catch (error) {
    console.error("Failed to persist site settings snapshot", { error });
    await unlink(temporaryPath).catch(() => undefined);
  }
}

async function readSiteSettingsSnapshot(): Promise<SiteSettingsRecord | null> {
  try {
    const raw = await readFile(siteSettingsSnapshotPath, "utf8");
    const parsed = siteSettingsSnapshotSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      console.error("Ignoring invalid site settings snapshot", {
        snapshotPath: siteSettingsSnapshotPath,
        issues: parsed.error.issues.map((issue) => issue.path.join(".")),
      });
      return null;
    }

    return parsed.data;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;

    if (code !== "ENOENT") {
      console.error("Failed to read site settings snapshot", { error });
    }

    return null;
  }
}

function notifySiteSettingsFallback(error: unknown) {
  const now = Date.now();

  if (now - lastFallbackAlertAt < SITE_SETTINGS_FALLBACK_ALERT_WINDOW_MS) {
    return;
  }

  lastFallbackAlertAt = now;
  console.error("Site settings database fallback activated", {
    event: "site_settings_database_fallback",
    snapshotPath: siteSettingsSnapshotPath,
    error,
  });
  void sendOwnerSystemErrorPushover({
    title: "PP Studio - nastaveni z fallbacku",
    message: "Databaze nastaveni neni dostupna. Web pouziva posledni ulozeny snapshot; nove online rezervace jsou docasne zablokovane.",
    context: { contextId: "site-settings-database-fallback" },
    error,
  });
}

const createSiteSettings = cache(async (): Promise<SiteSettingsRecord> => {
  return prisma.siteSettings.upsert({
    where: {
      id: SITE_SETTINGS_ID,
    },
    update: {},
    create: getDefaultSiteSettingsData(),
  });
});

export async function getSiteSettingsReadResult(): Promise<SiteSettingsReadResult> {
  try {
    const settings = await readSiteSettings();

    if (settings) {
      void persistSiteSettingsSnapshot(settings);
      return { settings, source: "database" };
    }
  } catch (error) {
    notifySiteSettingsFallback(error);
  }

  const snapshot = await readSiteSettingsSnapshot();

  if (snapshot) {
    return { settings: snapshot, source: "snapshot" };
  }

  return { settings: buildDefaultSiteSettingsRecord(), source: "default" };
}

export async function getSiteSettings() {
  return (await getSiteSettingsReadResult()).settings;
}

export async function hasCurrentBookingPolicySettings() {
  if (isTestRuntime()) {
    return true;
  }

  return (await getSiteSettingsReadResult()).source === "database";
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
