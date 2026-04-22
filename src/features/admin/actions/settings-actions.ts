"use server";

import { revalidatePath } from "next/cache";
import { CalendarFeedScope } from "@prisma/client";

import { env } from "@/config/env";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";
import {
  updateBookingSettingsSchema,
  updateEmailSettingsSchema,
  updateSalonSettingsSchema,
} from "@/features/admin/lib/admin-settings-validation";
import {
  activateCalendarFeed,
  deactivateCalendarFeed,
  rotateCalendarFeed,
} from "@/features/calendar/lib/calendar-feed-service";
import { prisma } from "@/lib/prisma";
import {
  getSiteSettings,
  isSenderEmailAllowedBySmtpPolicy,
  SITE_SETTINGS_ID,
} from "@/lib/site-settings";

import { type UpdateBookingSettingsActionState } from "./update-booking-settings-action-state";
import { type UpdateCalendarFeedActionState } from "./update-calendar-feed-action-state";
import { type UpdateEmailSettingsActionState } from "./update-email-settings-action-state";
import { type UpdateSalonSettingsActionState } from "./update-salon-settings-action-state";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateSettingsPaths() {
  for (const path of [
    "/admin/nastaveni",
    "/admin",
    "/",
    "/kontakt",
    "/faq",
    "/storno-podminky",
    "/rezervace",
  ]) {
    revalidatePath(path);
  }
}

function revalidateCalendarFeedAdminPaths() {
  revalidatePath("/admin/nastaveni");
  revalidatePath("/admin");
}

async function getActorUserId() {
  const session = await requireAdminSectionAccess("owner", "nastaveni");
  const dbUser = await prisma.adminUser.findFirst({
    where: {
      email: {
        equals: session.email.trim(),
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  return dbUser?.id ?? null;
}

export async function updateSalonSettingsAction(
  _previousState: UpdateSalonSettingsActionState,
  formData: FormData,
): Promise<UpdateSalonSettingsActionState> {
  const parsed = updateSalonSettingsSchema.safeParse({
    salonName: readFormString(formData, "salonName"),
    addressLine: readFormString(formData, "addressLine"),
    city: readFormString(formData, "city"),
    postalCode: readFormString(formData, "postalCode"),
    phone: readFormString(formData, "phone"),
    contactEmail: readFormString(formData, "contactEmail"),
    instagramUrl: readFormString(formData, "instagramUrl"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Zkontrolujte prosím zvýrazněná pole.",
      fieldErrors: {
        salonName: fieldErrors.salonName?.[0],
        addressLine: fieldErrors.addressLine?.[0],
        city: fieldErrors.city?.[0],
        postalCode: fieldErrors.postalCode?.[0],
        phone: fieldErrors.phone?.[0],
        contactEmail: fieldErrors.contactEmail?.[0],
        instagramUrl: fieldErrors.instagramUrl?.[0],
      },
    };
  }

  const actorUserId = await getActorUserId();
  const currentSettings = await getSiteSettings();

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: {
      ...parsed.data,
      instagramUrl: parsed.data.instagramUrl || null,
      updatedByUserId: actorUserId,
    },
    create: {
      ...currentSettings,
      ...parsed.data,
      id: SITE_SETTINGS_ID,
      instagramUrl: parsed.data.instagramUrl || null,
      updatedByUserId: actorUserId,
    },
  });

  revalidateSettingsPaths();

  return {
    status: "success",
    successMessage: "Údaje salonu jsou uložené.",
  };
}

export async function updateBookingSettingsAction(
  _previousState: UpdateBookingSettingsActionState,
  formData: FormData,
): Promise<UpdateBookingSettingsActionState> {
  const parsed = updateBookingSettingsSchema.safeParse({
    bookingMinAdvanceHours: readFormString(formData, "bookingMinAdvanceHours"),
    bookingMaxAdvanceDays: readFormString(formData, "bookingMaxAdvanceDays"),
    bookingCancellationHours: readFormString(formData, "bookingCancellationHours"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Zkontrolujte prosím pravidla rezervace.",
      fieldErrors: {
        bookingMinAdvanceHours: fieldErrors.bookingMinAdvanceHours?.[0],
        bookingMaxAdvanceDays: fieldErrors.bookingMaxAdvanceDays?.[0],
        bookingCancellationHours: fieldErrors.bookingCancellationHours?.[0],
      },
    };
  }

  const actorUserId = await getActorUserId();
  const currentSettings = await getSiteSettings();

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: {
      ...parsed.data,
      updatedByUserId: actorUserId,
    },
    create: {
      ...currentSettings,
      ...parsed.data,
      id: SITE_SETTINGS_ID,
      updatedByUserId: actorUserId,
    },
  });

  revalidateSettingsPaths();

  return {
    status: "success",
    successMessage: "Globální pravidla rezervace jsou uložená.",
  };
}

export async function updateEmailSettingsAction(
  _previousState: UpdateEmailSettingsActionState,
  formData: FormData,
): Promise<UpdateEmailSettingsActionState> {
  const parsed = updateEmailSettingsSchema.safeParse({
    notificationAdminEmail: readFormString(formData, "notificationAdminEmail"),
    emailSenderName: readFormString(formData, "emailSenderName"),
    emailSenderEmail: readFormString(formData, "emailSenderEmail"),
    emailFooterText: readFormString(formData, "emailFooterText"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Zkontrolujte prosím e-mailová nastavení.",
      fieldErrors: {
        notificationAdminEmail: fieldErrors.notificationAdminEmail?.[0],
        emailSenderName: fieldErrors.emailSenderName?.[0],
        emailSenderEmail: fieldErrors.emailSenderEmail?.[0],
        emailFooterText: fieldErrors.emailFooterText?.[0],
      },
    };
  }

  const actorUserId = await getActorUserId();
  const currentSettings = await getSiteSettings();

  if (!isSenderEmailAllowedBySmtpPolicy(parsed.data.emailSenderEmail)) {
    return {
      status: "error",
      formError:
        "Odesílatelský e-mail teď nejde uložit. V režimu EMAIL_DELIVERY_MODE=background musí odpovídat SMTP_FROM_EMAIL, jinak by doručování mohlo selhávat.",
      fieldErrors: {
        emailSenderEmail: `Použijte adresu ${env.SMTP_FROM_EMAIL} nebo upravte SMTP konfiguraci.`,
      },
    };
  }

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: {
      notificationAdminEmail: parsed.data.notificationAdminEmail,
      emailSenderName: parsed.data.emailSenderName,
      emailSenderEmail: parsed.data.emailSenderEmail,
      emailFooterText: parsed.data.emailFooterText || null,
      updatedByUserId: actorUserId,
    },
    create: {
      ...currentSettings,
      id: SITE_SETTINGS_ID,
      notificationAdminEmail: parsed.data.notificationAdminEmail,
      emailSenderName: parsed.data.emailSenderName,
      emailSenderEmail: parsed.data.emailSenderEmail,
      emailFooterText: parsed.data.emailFooterText || null,
      updatedByUserId: actorUserId,
    },
  });

  revalidateSettingsPaths();

  return {
    status: "success",
    successMessage: "E-mailová nastavení jsou uložená.",
  };
}

export async function updateCalendarFeedAction(
  _previousState: UpdateCalendarFeedActionState,
  formData: FormData,
): Promise<UpdateCalendarFeedActionState> {
  const intentValue = formData.get("intent");
  const intent = typeof intentValue === "string" ? intentValue.trim() : "";

  if (intent !== "activate" && intent !== "rotate" && intent !== "deactivate") {
    return {
      status: "error",
      formError: "Neznámá akce kalendáře.",
    };
  }

  const actorUserId = await getActorUserId();

  if (intent === "activate") {
    await activateCalendarFeed(CalendarFeedScope.OWNER_BOOKINGS, actorUserId);
    revalidateCalendarFeedAdminPaths();

    return {
      status: "success",
      successMessage: "Kalendářový feed je aktivní a připravený ke zkopírování do Apple Kalendáře.",
    };
  }

  if (intent === "rotate") {
    await rotateCalendarFeed(CalendarFeedScope.OWNER_BOOKINGS, actorUserId);
    revalidateCalendarFeedAdminPaths();

    return {
      status: "success",
      successMessage: "Kalendářový odkaz byl obnovený. Starý subscription link už neplatí.",
    };
  }

  await deactivateCalendarFeed(CalendarFeedScope.OWNER_BOOKINGS, actorUserId);
  revalidateCalendarFeedAdminPaths();

  return {
    status: "success",
    successMessage: "Kalendářový feed je vypnutý. Dosavadní subscription link už nefunguje.",
  };
}
