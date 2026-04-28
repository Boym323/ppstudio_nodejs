"use server";

import { revalidatePath } from "next/cache";
import { CalendarFeedScope } from "@prisma/client";

import { env } from "@/config/env";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";
import {
  updateBookingSettingsSchema,
  updateEmailSettingsSchema,
  updatePushoverSettingsSchema,
  updateSalonSettingsSchema,
} from "@/features/admin/lib/admin-settings-validation";
import {
  activateCalendarFeed,
  deactivateCalendarFeed,
  rotateCalendarFeed,
} from "@/features/calendar/lib/calendar-feed-service";
import { prisma } from "@/lib/prisma";
import {
  ensureSiteSettings,
  isSenderEmailAllowedBySmtpPolicy,
  SITE_SETTINGS_ID,
} from "@/lib/site-settings";
import { sendDirectOwnerPushover } from "@/lib/notifications/pushover";

import { type UpdateBookingSettingsActionState } from "./update-booking-settings-action-state";
import { type UpdateCalendarFeedActionState } from "./update-calendar-feed-action-state";
import { type UpdateEmailSettingsActionState } from "./update-email-settings-action-state";
import {
  type TestPushoverActionState,
  type UpdatePushoverSettingsActionState,
} from "./update-pushover-settings-action-state";
import { type UpdateSalonSettingsActionState } from "./update-salon-settings-action-state";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readFormBoolean(formData: FormData, key: string) {
  return formData.get(key) === "1";
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

async function getCurrentOwnerDbUser() {
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

  return dbUser;
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
    voucherPdfLogoMediaId: readFormString(formData, "voucherPdfLogoMediaId"),
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
        voucherPdfLogoMediaId: fieldErrors.voucherPdfLogoMediaId?.[0],
      },
    };
  }

  const actorUserId = await getActorUserId();
  const currentSettings = await ensureSiteSettings();
  const voucherPdfLogoMediaId = parsed.data.voucherPdfLogoMediaId || null;

  if (voucherPdfLogoMediaId) {
    const logoAsset = await prisma.mediaAsset.findUnique({
      where: {
        id: voucherPdfLogoMediaId,
      },
      select: {
        id: true,
      },
    });

    if (!logoAsset) {
      return {
        status: "error",
        formError: "Vybrané logo pro PDF vouchery už v médiích neexistuje.",
        fieldErrors: {
          voucherPdfLogoMediaId: "Vyberte existující médium nebo pole vyprázdněte.",
        },
      };
    }
  }

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: {
      ...parsed.data,
      instagramUrl: parsed.data.instagramUrl || null,
      voucherPdfLogoMediaId,
      updatedByUserId: actorUserId,
    },
    create: {
      ...currentSettings,
      ...parsed.data,
      id: SITE_SETTINGS_ID,
      instagramUrl: parsed.data.instagramUrl || null,
      voucherPdfLogoMediaId,
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
  const currentSettings = await ensureSiteSettings();

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
  const currentSettings = await ensureSiteSettings();

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

export async function updatePushoverSettingsAction(
  _previousState: UpdatePushoverSettingsActionState,
  formData: FormData,
): Promise<UpdatePushoverSettingsActionState> {
  const parsed = updatePushoverSettingsSchema.safeParse({
    pushoverUserKey: readFormString(formData, "pushoverUserKey"),
    pushoverEnabled: readFormBoolean(formData, "pushoverEnabled"),
    notifyNewBooking: readFormBoolean(formData, "notifyNewBooking"),
    notifyBookingPending: readFormBoolean(formData, "notifyBookingPending"),
    notifyBookingConfirmed: readFormBoolean(formData, "notifyBookingConfirmed"),
    notifyBookingCancelled: readFormBoolean(formData, "notifyBookingCancelled"),
    notifyBookingRescheduled: readFormBoolean(formData, "notifyBookingRescheduled"),
    notifyEmailFailed: readFormBoolean(formData, "notifyEmailFailed"),
    notifyReminderFailed: readFormBoolean(formData, "notifyReminderFailed"),
    notifySystemErrors: readFormBoolean(formData, "notifySystemErrors"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Zkontrolujte prosím Pushover nastavení.",
      fieldErrors: {
        pushoverUserKey: fieldErrors.pushoverUserKey?.[0],
      },
    };
  }

  const owner = await getCurrentOwnerDbUser();

  if (!owner) {
    return {
      status: "error",
      formError: "Pushover nastavení jde uložit jen k existujícímu OWNER účtu v databázi.",
    };
  }

  if (parsed.data.pushoverEnabled && !parsed.data.pushoverUserKey?.trim()) {
    return {
      status: "error",
      formError: "Pro zapnutí Pushover notifikací doplňte Pushover User Key.",
      fieldErrors: {
        pushoverUserKey: "Bez User Key není kam notifikaci poslat.",
      },
    };
  }

  await prisma.userNotificationSettings.upsert({
    where: {
      userId: owner.id,
    },
    update: {
      ...parsed.data,
      pushoverUserKey: parsed.data.pushoverUserKey?.trim() || null,
    },
    create: {
      userId: owner.id,
      ...parsed.data,
      pushoverUserKey: parsed.data.pushoverUserKey?.trim() || null,
    },
  });

  revalidatePath("/admin/nastaveni");

  return {
    status: "success",
    successMessage: "Pushover notifikace jsou uložené.",
  };
}

export async function sendPushoverTestAction(
  _previousState: TestPushoverActionState,
): Promise<TestPushoverActionState> {
  void _previousState;

  const owner = await getCurrentOwnerDbUser();

  if (!owner) {
    return {
      status: "error",
      formError: "Testovací notifikaci lze poslat jen existujícímu OWNER účtu.",
    };
  }

  const result = await sendDirectOwnerPushover(owner.id, {
    type: "SYSTEM_ERROR",
    title: "PP Studio - test Pushover",
    message: "Testovací notifikace z administrace PP Studio.",
    url: `${env.NEXT_PUBLIC_APP_URL}/admin/nastaveni`,
    priority: 0,
    context: {
      contextId: `test-${owner.id}`,
    },
  });

  switch (result.status) {
    case "sent":
      return {
        status: "success",
        successMessage: "Testovací Pushover notifikace byla odeslaná.",
      };
    case "disabled":
      return {
        status: "error",
        formError: "Pushover je vypnutý v serverové konfiguraci.",
      };
    case "missing-config":
      return {
        status: "error",
        formError: "Chybí serverová konfigurace PUSHOVER_APP_TOKEN.",
      };
    case "missing-user-key":
      return {
        status: "error",
        formError: "Nejdřív vyplňte Pushover User Key a nastavení uložte.",
      };
    case "not-owner":
      return {
        status: "error",
        formError: "Testovací notifikace je dostupná pouze pro OWNER účet.",
      };
    case "failed":
      return {
        status: "error",
        formError: "Pushover test selhal. Zkontrolujte User Key a serverové logy.",
      };
  }
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
