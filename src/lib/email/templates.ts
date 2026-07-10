import { z } from "zod";

import { env } from "@/config/env";
import { buildBookingCalendarIcsFromPayload } from "@/features/calendar/lib/booking-calendar-attachment";
import {
  formatBookingCalendarDate,
  formatBookingTimeRange,
} from "@/features/booking/lib/booking-format";
import { buildVoucherEmailTemplate } from "@/features/vouchers/lib/voucher-email-template";
import {
  buildVoucherPdfFilename,
  buildVoucherVerificationUrl,
  generateVoucherPdf,
} from "@/features/vouchers/lib/voucher-pdf-core";
import { getVoucherDetail } from "@/features/vouchers/lib/voucher-read-models";
import { getEmailBrandingSettings, getPublicSalonProfile } from "@/lib/site-settings";
import { sanitizeEmailHeaderValue } from "@/lib/email/header";

const bookingConfirmationPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
  manageReservationUrl: z.url().optional(),
  cancellationUrl: z.url().optional(),
  intendedVoucherCode: z.string().min(1).optional(),
});

const bookingCancelledPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
  intendedVoucherCode: z.string().min(1).optional(),
});

const bookingApprovedPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
  manageReservationUrl: z.url().optional(),
  cancellationUrl: z.url().optional(),
  includeCalendarAttachment: z.boolean().optional(),
  intendedVoucherCode: z.string().min(1).optional(),
});

const bookingReminder24hPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
  manageReservationUrl: z.url().optional(),
  cancellationUrl: z.url(),
});

const bookingRescheduledPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  previousStartsAt: z.string().datetime(),
  previousEndsAt: z.string().datetime(),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
  manageReservationUrl: z.url().optional(),
  cancellationUrl: z.url(),
  includeCalendarAttachment: z.boolean().optional(),
});

const bookingRejectedPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
});

const adminBookingNotificationPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  clientEmail: z.string().email(),
  clientPhone: z.string().optional().nullable(),
  clientNote: z.string().trim().max(600).optional().nullable(),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
  approveUrl: z.url(),
  rejectUrl: z.url(),
  adminUrl: z.url(),
});

const adminBookingCancelledPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  clientEmail: z.string().email(),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
});

const adminBookingRescheduledPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  clientEmail: z.string().email(),
  previousStartsAt: z.string().datetime(),
  previousEndsAt: z.string().datetime(),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
  adminUrl: z.url(),
});

const voucherSentPayloadSchema = z.object({
  voucherId: z.string().min(1),
});

export type RenderedEmailTemplate = {
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType: string;
  }>;
};

const clientStudio = {
  name: "PP Studio",
  address: "Sadová 2, 760 01 Zlín",
  email: "info@ppstudio.cz",
  phone: "+420 732 856 036",
};

const clientStudioMapUrl = "https://maps.app.goo.gl/iRdsWbiX99fw3Q36A";

type EmailSalonContact = {
  name: string;
  address: string;
  email: string;
  phone: string;
  mapUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPhoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function normalizeContactValue(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : fallback;
}

function buildReminderParkingUrl() {
  const url = new URL("/kontakt", env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("utm_source", "email");
  url.searchParams.set("utm_medium", "booking_reminder");
  url.searchParams.set("utm_campaign", "parking_info");
  url.hash = "parkovani";

  return url.toString();
}

function buildEmailSalonContact({
  salonProfile,
  emailBranding,
}: {
  salonProfile: {
    name?: string | null;
    addressLine?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  emailBranding: {
    salonName?: string | null;
    contactEmail?: string | null;
    phone?: string | null;
  };
}): EmailSalonContact {
  const name = normalizeContactValue(salonProfile.name ?? emailBranding.salonName, clientStudio.name);
  const address = normalizeContactValue(salonProfile.addressLine, clientStudio.address);
  const email = normalizeContactValue(salonProfile.email ?? emailBranding.contactEmail, clientStudio.email);
  const phone = normalizeContactValue(salonProfile.phone ?? emailBranding.phone, clientStudio.phone);

  return {
    name,
    address,
    email,
    phone,
    mapUrl: clientStudioMapUrl,
  };
}

function buildEmailButton({
  href,
  label,
  variant = "secondary",
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary" | "destructive";
}) {
  const styles =
    variant === "primary"
      ? "background:#1f1714;color:#ffffff;border:1px solid #1f1714;"
      : variant === "destructive"
        ? "background:#fff4f2;color:#b03c2e;border:1px solid #f3d3cd;"
        : "background:#f6efe8;color:#1f1714;border:1px solid #eaded4;";

  return `<a href="${escapeHtml(href)}" style="display:inline-block;min-height:20px;padding:13px 20px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;letter-spacing:0;text-align:center;text-decoration:none;white-space:normal;${styles}">${escapeHtml(label)}</a>`;
}

function buildEmailActionButton({
  href,
  label,
  variant = "secondary",
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary" | "destructive";
}) {
  const isPrimary = variant === "primary";
  const isDestructive = variant === "destructive";
  const backgroundColor = isPrimary ? "#1f1714" : isDestructive ? "#fff7f5" : "#f6efe8";
  const borderColor = isPrimary ? "#1f1714" : isDestructive ? "#f0d4cf" : "#eaded4";
  const textColor = isPrimary ? "#ffffff" : isDestructive ? "#9f2f24" : "#1f1714";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;margin:0;">
    <tr>
      <td align="center" bgcolor="${backgroundColor}" style="background:${backgroundColor};border:1px solid ${borderColor};border-radius:999px;">
        <a href="${escapeHtml(href)}" style="display:block;padding:13px 18px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;font-weight:700;letter-spacing:0;text-align:center;text-decoration:none;color:${textColor};white-space:normal;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

function buildEmailShell(
  brand: { name: string; email: string; phone: string; footerText?: string | null },
  title: string,
  intro: string,
  body: string,
  options?: {
    includeFooter?: boolean;
    maxWidthPx?: number;
  },
) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background:#f7f1eb;">
      <tr>
        <td align="center" style="padding:28px 14px;font-family:Arial,Helvetica,sans-serif;color:#2e241f;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${options?.maxWidthPx ?? 600}px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #eaded4;border-radius:18px;">
            <tr>
              <td style="padding:28px 24px;">
                <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:#9e7f65;">${escapeHtml(brand.name)}</p>
                ${title ? `<h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:34px;font-weight:700;color:#1f1714;">${escapeHtml(title)}</h1>` : ""}
                ${intro ? `<p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#5b4c44;">${escapeHtml(intro)}</p>` : ""}
                ${body}
                ${options?.includeFooter === false ? "" : `
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-collapse:collapse;border-top:1px solid #eaded4;">
                    <tr>
                      <td style="padding-top:16px;">
                        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#8a7468;">${escapeHtml(brand.name)}</p>
                      </td>
                    </tr>
                  </table>
                `}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `.trim();
}

function buildEmailCard(body: string, background = "#fbf7f3") {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;border:1px solid #eaded4;border-radius:14px;background:${background};">
      <tr>
        <td style="padding:18px 18px;">
          ${body}
        </td>
      </tr>
    </table>
  `;
}

function buildEmailDetailRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #eaded4;">
        <p style="margin:0 0 5px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9e7f65;">${escapeHtml(label)}</p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:25px;color:#1f1714;"><strong>${escapeHtml(value)}</strong></p>
      </td>
    </tr>
  `;
}

function buildBookingDetailCard({
  serviceName,
  bookingDate,
  bookingTime,
  extraRows = "",
}: {
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  extraRows?: string;
}) {
  return buildEmailCard(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      ${buildEmailDetailRow("Služba", serviceName)}
      ${buildEmailDetailRow("Datum", bookingDate)}
      ${buildEmailDetailRow("Čas", bookingTime)}
      ${extraRows}
    </table>
  `);
}

function buildClientLocationBlock(salon: EmailSalonContact, options?: { parkingUrl?: string }) {
  return buildEmailCard(`
    <p style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9e7f65;">Místo</p>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#1f1714;"><strong>${escapeHtml(salon.name)}</strong><br />${escapeHtml(salon.address)}</p>
    <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;"><a href="${escapeHtml(salon.mapUrl)}" style="color:#1f1714;text-decoration:underline;">Zobrazit na mapě</a></p>
    ${options?.parkingUrl ? `<p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#5b4c44;">Před cestou se můžete podívat i na <a href="${escapeHtml(options.parkingUrl)}" style="color:#1f1714;text-decoration:underline;">tipy k parkování u salonu</a>.</p>` : ""}
  `, "#fffaf6");
}

function buildClientContactBlock(salon: EmailSalonContact) {
  return buildEmailCard(`
    <p style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9e7f65;">Kontakt</p>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#5b4c44;">
      Napište nám: <a href="mailto:${escapeHtml(salon.email)}" style="color:#1f1714;text-decoration:underline;">${escapeHtml(salon.email)}</a><br />
      Zavolejte: <a href="${escapeHtml(buildPhoneHref(salon.phone))}" style="color:#1f1714;text-decoration:underline;">${escapeHtml(salon.phone)}</a>
    </p>
  `, "#ffffff");
}

function buildClientActionLinks(manageReservationUrl?: string, cancellationUrl?: string) {
  if (!manageReservationUrl && !cancellationUrl) {
    return "";
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-collapse:collapse;border-top:1px solid #eaded4;">
      <tr>
        <td style="padding-top:14px;">
          <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9e7f65;">Správa rezervace</p>
          ${manageReservationUrl ? `<a href="${escapeHtml(manageReservationUrl)}" style="display:inline-block;margin:0 14px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:700;letter-spacing:0;color:#1f1714;text-decoration:underline;">Změnit termín</a>` : ""}
          ${cancellationUrl ? `<a href="${escapeHtml(cancellationUrl)}" style="display:inline-block;margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:700;letter-spacing:0;color:#7f322a;text-decoration:underline;">Zrušit rezervaci</a>` : ""}
        </td>
      </tr>
    </table>
  `;
}

export async function renderEmailTemplate(
  templateKey: string,
  subject: string,
  payload: unknown,
): Promise<RenderedEmailTemplate> {
  const safeSubject = sanitizeEmailHeaderValue(subject, "E-mail subject");
  const [salonProfile, emailBranding] = await Promise.all([
    getPublicSalonProfile().catch(() => ({
      name: env.NEXT_PUBLIC_APP_NAME,
      phone: "+420 732 856 036",
      email: "info@ppstudio.cz",
      instagramUrl: null,
      addressLine: "Sadová 2, 760 01 Zlín",
      bookingLabel: "Dle vypsaných termínů a individuální domluvy",
    })),
    getEmailBrandingSettings().catch(() => ({
      salonName: env.NEXT_PUBLIC_APP_NAME,
      phone: "+420 732 856 036",
      contactEmail: "info@ppstudio.cz",
      senderName: env.SMTP_FROM_NAME,
      senderEmail: env.SMTP_FROM_EMAIL ?? "info@ppstudio.cz",
      footerText: null,
      notificationAdminEmail: env.ADMIN_OWNER_EMAIL,
    })),
  ]);
  const brand = {
    name: salonProfile.name,
    email: emailBranding.contactEmail,
    phone: emailBranding.phone,
    footerText: emailBranding.footerText,
  };
  const salonContact = buildEmailSalonContact({ salonProfile, emailBranding });

  switch (templateKey) {
    case "booking-confirmation-v1": {
      const data = bookingConfirmationPayloadSchema.parse(payload);
      const scheduledStartsAt = new Date(data.scheduledStartsAt);
      const scheduledEndsAt = new Date(data.scheduledEndsAt);
      const bookingDate = formatBookingCalendarDate(scheduledStartsAt);
      const bookingTime = formatBookingTimeRange(scheduledStartsAt, scheduledEndsAt);

      const text = [
        `Dobrý den, ${data.clientName},`,
        "",
        "Rezervace přijata",
        "Děkujeme za rezervaci. Termín teď zkontrolujeme a finální potvrzení pošleme dalším e-mailem.",
        "",
        `Služba: ${data.serviceName}`,
        `Datum: ${bookingDate}`,
        `Čas: ${bookingTime}`,
        ...(data.intendedVoucherCode
          ? [
              "",
              `Dárkový poukaz: ${data.intendedVoucherCode}`,
              "U rezervace jste uvedla dárkový poukaz. Poukaz bude ověřen a uplatněn při návštěvě v salonu.",
            ]
          : []),
        "",
        "Místo:",
        salonContact.name,
        salonContact.address,
        `Zobrazit na mapě: ${salonContact.mapUrl}`,
        "",
        "Kontakt:",
        `Napište nám: ${salonContact.email}`,
        `Zavolejte: ${salonContact.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Rezervace přijata",
        "Děkujeme za rezervaci. Termín teď zkontrolujeme a finální potvrzení pošleme dalším e-mailem.",
        `
          ${buildBookingDetailCard({
            serviceName: data.serviceName,
            bookingDate,
            bookingTime,
          })}
          ${data.intendedVoucherCode ? `
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildEmailCard(`
            <p style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9e7f65;">Dárkový poukaz</p>
            <p style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;font-weight:700;color:#1f1714;">${escapeHtml(data.intendedVoucherCode)}</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#5b4c44;">U rezervace jste uvedla dárkový poukaz. Poukaz bude ověřen a uplatněn při návštěvě v salonu.</p>
          `, "#ffffff")}
          ` : ""}
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildClientLocationBlock(salonContact)}
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildClientContactBlock(salonContact)}
        `,
        { maxWidthPx: 600 },
      );

      return { subject: safeSubject, html, text };
    }
    case "booking-cancelled-v1": {
      const data = bookingCancelledPayloadSchema.parse(payload);
      const scheduledStartsAt = new Date(data.scheduledStartsAt);
      const scheduledEndsAt = new Date(data.scheduledEndsAt);
      const bookingDate = formatBookingCalendarDate(scheduledStartsAt);
      const bookingTime = formatBookingTimeRange(scheduledStartsAt, scheduledEndsAt);
      const newBookingUrl = `${env.NEXT_PUBLIC_APP_URL}/rezervace`;

      const text = [
        `Dobrý den, ${data.clientName},`,
        "",
        "Rezervace byla zrušena",
        "Vaši rezervaci jsme zrušili. Kdybyste si chtěla vybrat nový termín, můžete pokračovat přes odkaz níže.",
        "",
        `Služba: ${data.serviceName}`,
        `Datum: ${bookingDate}`,
        `Čas: ${bookingTime}`,
        ...(data.intendedVoucherCode
          ? [
              "",
              `Dárkový poukaz: ${data.intendedVoucherCode}`,
              "U rezervace jste uvedla dárkový poukaz. Poukaz bude ověřen a uplatněn při návštěvě v salonu.",
            ]
          : []),
        "",
        "Místo:",
        salonContact.name,
        salonContact.address,
        "",
        `Nový termín: ${newBookingUrl}`,
        "",
        "Kontakt:",
        `Napište nám: ${salonContact.email}`,
        `Zavolejte: ${salonContact.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Rezervace byla zrušena",
        "Vaši rezervaci jsme zrušili. Kdybyste si chtěla vybrat nový termín, můžete pokračovat přes odkaz níže.",
        `
          ${buildBookingDetailCard({
            serviceName: data.serviceName,
            bookingDate,
            bookingTime,
          })}
          ${data.intendedVoucherCode ? `
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildEmailCard(`
            <p style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9e7f65;">Dárkový poukaz</p>
            <p style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;font-weight:700;color:#1f1714;">${escapeHtml(data.intendedVoucherCode)}</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#5b4c44;">U rezervace jste uvedla dárkový poukaz. Poukaz bude ověřen a uplatněn při návštěvě v salonu.</p>
          `, "#ffffff")}
          ` : ""}
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildClientLocationBlock(salonContact)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-collapse:collapse;">
            <tr>
              <td>
                ${buildEmailButton({
                  href: newBookingUrl,
                  label: "Vybrat nový termín",
                  variant: "secondary",
                })}
              </td>
            </tr>
          </table>
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildClientContactBlock(salonContact)}
        `,
        { maxWidthPx: 600 },
      );

      return { subject: safeSubject, html, text };
    }
    case "booking-approved-v1": {
      const data = bookingApprovedPayloadSchema.parse(payload);
      const scheduledStartsAt = new Date(data.scheduledStartsAt);
      const scheduledEndsAt = new Date(data.scheduledEndsAt);
      const bookingDate = formatBookingCalendarDate(scheduledStartsAt);
      const bookingTime = formatBookingTimeRange(scheduledStartsAt, scheduledEndsAt);
      const includeCalendarAttachment = data.includeCalendarAttachment ?? true;
      const calendarAttachment = includeCalendarAttachment
        ? await buildBookingCalendarIcsFromPayload({
            bookingId: data.bookingId,
            serviceName: data.serviceName,
            scheduledStartsAt,
            scheduledEndsAt,
          })
        : null;

      const text = [
        `Dobrý den, ${data.clientName},`,
        "",
        "Rezervace byla potvrzena",
        "Termín máte potvrzený. Níže najdete praktické údaje k návštěvě a možnosti pro případnou změnu.",
        "",
        `Služba: ${data.serviceName}`,
        `Datum: ${bookingDate}`,
        `Čas: ${bookingTime}`,
        ...(data.intendedVoucherCode
          ? [
              "",
              `Dárkový poukaz: ${data.intendedVoucherCode}`,
              "U rezervace jste uvedla dárkový poukaz. Poukaz bude ověřen a uplatněn při návštěvě v salonu.",
            ]
          : []),
        "",
        "Místo:",
        salonContact.name,
        salonContact.address,
        `Zobrazit na mapě: ${salonContact.mapUrl}`,
        "",
        ...(includeCalendarAttachment ? ["Termín najdete také v přiložené kalendářové události.", ""] : []),
        ...(data.manageReservationUrl || data.cancellationUrl
          ? [
              ...(data.manageReservationUrl ? [`Změnit termín: ${data.manageReservationUrl}`] : []),
              ...(data.cancellationUrl ? [`Zrušit rezervaci: ${data.cancellationUrl}`] : []),
              "",
            ]
          : []),
        "Kontakt:",
        `Napište nám: ${salonContact.email}`,
        `Zavolejte: ${salonContact.phone}`,
        "",
        salonContact.name,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Rezervace byla potvrzena",
        "Termín máte potvrzený. Níže najdete praktické údaje k návštěvě a možnosti pro případnou změnu.",
        `
          ${buildBookingDetailCard({
            serviceName: data.serviceName,
            bookingDate,
            bookingTime,
          })}
          ${data.intendedVoucherCode ? `
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildEmailCard(`
            <p style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9e7f65;">Dárkový poukaz</p>
            <p style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;font-weight:700;color:#1f1714;">${escapeHtml(data.intendedVoucherCode)}</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#5b4c44;">U rezervace jste uvedla dárkový poukaz. Poukaz bude ověřen a uplatněn při návštěvě v salonu.</p>
          `, "#ffffff")}
          ` : ""}
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildClientLocationBlock(salonContact)}
          ${includeCalendarAttachment ? `
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildEmailCard(`
            <p style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9e7f65;">Kalendář</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#5b4c44;">Termín najdete také v přiložené kalendářové události.</p>
          `, "#ffffff")}
          ` : ""}
          ${buildClientActionLinks(data.manageReservationUrl, data.cancellationUrl)}
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildClientContactBlock(salonContact)}
        `,
        {
          maxWidthPx: 600,
        },
      );

      return {
        subject: safeSubject,
        html,
        text,
        attachments: calendarAttachment
          ? [
              {
                filename: "pp-studio-rezervace.ics",
                content: calendarAttachment,
                contentType: "text/calendar; charset=utf-8",
              },
            ]
          : undefined,
      };
    }
    case "booking-reminder-24h-v1": {
      const data = bookingReminder24hPayloadSchema.parse(payload);
      const scheduledStartsAt = new Date(data.scheduledStartsAt);
      const scheduledEndsAt = new Date(data.scheduledEndsAt);
      const bookingDate = formatBookingCalendarDate(scheduledStartsAt);
      const bookingTime = formatBookingTimeRange(scheduledStartsAt, scheduledEndsAt);
      const parkingUrl = buildReminderParkingUrl();

      const text = [
        `Dobrý den, ${data.clientName},`,
        "",
        "Zítra se na vás těšíme",
        "Jen krátce připomínáme Váš termín. Níže najdete čas i adresu salonu.",
        "",
        `Služba: ${data.serviceName}`,
        `Datum: ${bookingDate}`,
        `Čas: ${bookingTime}`,
        "",
        "Místo:",
        salonContact.name,
        salonContact.address,
        `Zobrazit na mapě: ${salonContact.mapUrl}`,
        `Parkování: ${parkingUrl}`,
        "",
        "Potřebujete změnu?",
        ...(data.manageReservationUrl
          ? [`Změnit termín: ${data.manageReservationUrl}`]
          : []),
        `Zrušit rezervaci: ${data.cancellationUrl}`,
        "",
        "Kontakt:",
        `Napište nám: ${salonContact.email}`,
        `Zavolejte: ${salonContact.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Zítra se na vás těšíme",
        "Jen krátce připomínáme Váš termín. Níže najdete čas i adresu salonu.",
        `
          ${buildBookingDetailCard({
            serviceName: data.serviceName,
            bookingDate,
            bookingTime,
          })}
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildClientLocationBlock(salonContact, { parkingUrl })}
          ${buildClientActionLinks(data.manageReservationUrl, data.cancellationUrl)}
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildClientContactBlock(salonContact)}
        `,
        { maxWidthPx: 600 },
      );

      return { subject: safeSubject, html, text };
    }
    case "booking-rescheduled-v1": {
      const data = bookingRescheduledPayloadSchema.parse(payload);
      const previousStartsAt = new Date(data.previousStartsAt);
      const previousEndsAt = new Date(data.previousEndsAt);
      const scheduledStartsAt = new Date(data.scheduledStartsAt);
      const scheduledEndsAt = new Date(data.scheduledEndsAt);
      const previousDate = formatBookingCalendarDate(previousStartsAt);
      const previousTime = formatBookingTimeRange(previousStartsAt, previousEndsAt);
      const bookingDate = formatBookingCalendarDate(scheduledStartsAt);
      const bookingTime = formatBookingTimeRange(scheduledStartsAt, scheduledEndsAt);
      const includeCalendarAttachment = data.includeCalendarAttachment ?? true;
      const calendarAttachment = includeCalendarAttachment
        ? await buildBookingCalendarIcsFromPayload({
            bookingId: data.bookingId,
            serviceName: data.serviceName,
            scheduledStartsAt,
            scheduledEndsAt,
          })
        : null;

      const text = [
        `Dobrý den, ${data.clientName},`,
        "",
        "Termín rezervace byl změněn",
        "Rezervaci jsme přesunuli na nový čas. Aktuální termín najdete níže.",
        "",
        `Služba: ${data.serviceName}`,
        `Datum: ${bookingDate}`,
        `Čas: ${bookingTime}`,
        `Původně: ${previousDate}, ${previousTime}`,
        "",
        "Místo:",
        salonContact.name,
        salonContact.address,
        `Zobrazit na mapě: ${salonContact.mapUrl}`,
        "",
        ...(includeCalendarAttachment
          ? [
              "Termín najdete také v přiložené kalendářové události.",
              "",
            ]
          : []),
        ...(data.manageReservationUrl
          ? [`Další změna termínu: ${data.manageReservationUrl}`]
          : []),
        `Zrušit rezervaci: ${data.cancellationUrl}`,
        "",
        "Kontakt:",
        `Napište nám: ${salonContact.email}`,
        `Zavolejte: ${salonContact.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Termín rezervace byl změněn",
        "Rezervaci jsme přesunuli na nový čas. Aktuální termín najdete níže.",
        `
          ${buildBookingDetailCard({
            serviceName: data.serviceName,
            bookingDate,
            bookingTime,
            extraRows: buildEmailDetailRow("Původně", `${previousDate}, ${previousTime}`),
          })}
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildClientLocationBlock(salonContact)}
          ${includeCalendarAttachment ? `
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildEmailCard(`
            <p style="margin:0 0 7px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9e7f65;">Kalendář</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#5b4c44;">Termín najdete také v přiložené kalendářové události.</p>
          `, "#ffffff")}
          ` : ""}
          ${buildClientActionLinks(data.manageReservationUrl, data.cancellationUrl)}
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildClientContactBlock(salonContact)}
        `,
        { maxWidthPx: 600 },
      );

      return {
        subject: safeSubject,
        html,
        text,
        attachments: calendarAttachment
          ? [
              {
                filename: "pp-studio-rezervace.ics",
                content: calendarAttachment,
                contentType: "text/calendar; charset=utf-8",
              },
            ]
          : undefined,
      };
    }
    case "booking-rejected-v1": {
      const data = bookingRejectedPayloadSchema.parse(payload);
      const scheduledStartsAt = new Date(data.scheduledStartsAt);
      const scheduledEndsAt = new Date(data.scheduledEndsAt);
      const bookingDate = formatBookingCalendarDate(scheduledStartsAt);
      const bookingTime = formatBookingTimeRange(scheduledStartsAt, scheduledEndsAt);
      const newBookingUrl = `${env.NEXT_PUBLIC_APP_URL}/rezervace`;

      const text = [
        `Dobrý den, ${data.clientName},`,
        "",
        "Rezervaci se tentokrát nepodařilo potvrdit",
        "Požadovaný termín už bohužel není dostupný. Můžete si vybrat jiný termín nebo se nám ozvat.",
        "",
        `Služba: ${data.serviceName}`,
        `Datum: ${bookingDate}`,
        `Čas: ${bookingTime}`,
        "",
        "Místo:",
        salonContact.name,
        salonContact.address,
        "",
        `Nový termín: ${newBookingUrl}`,
        "",
        "Kontakt:",
        `Napište nám: ${salonContact.email}`,
        `Zavolejte: ${salonContact.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Rezervaci se tentokrát nepodařilo potvrdit",
        "Požadovaný termín už bohužel není dostupný. Můžete si vybrat jiný termín nebo se nám ozvat.",
        `
          ${buildBookingDetailCard({
            serviceName: data.serviceName,
            bookingDate,
            bookingTime,
          })}
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildClientLocationBlock(salonContact)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-collapse:collapse;">
            <tr>
              <td>
                ${buildEmailButton({
                  href: newBookingUrl,
                  label: "Vybrat nový termín",
                  variant: "secondary",
                })}
              </td>
            </tr>
          </table>
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildClientContactBlock(salonContact)}
        `,
        { maxWidthPx: 600 },
      );

      return { subject: safeSubject, html, text };
    }
    case "admin-booking-notification-v1": {
      const data = adminBookingNotificationPayloadSchema.parse(payload);
      const scheduledStartsAt = new Date(data.scheduledStartsAt);
      const scheduledEndsAt = new Date(data.scheduledEndsAt);
      const bookingDate = formatBookingCalendarDate(scheduledStartsAt);
      const bookingTime = formatBookingTimeRange(scheduledStartsAt, scheduledEndsAt);
      const phoneLine = data.clientPhone ? `Telefon: ${data.clientPhone}` : null;
      const clientNote = data.clientNote?.trim() || null;
      const text = [
        "Nová rezervace",
        "",
        `Služba: ${data.serviceName}`,
        `Termín: ${bookingDate}, ${bookingTime}`,
        `Klientka: ${data.clientName}`,
        `Email: ${data.clientEmail}`,
        ...(phoneLine ? [phoneLine] : []),
        ...(clientNote ? ["", `Poznámka od klientky: ${clientNote}`] : []),
        "",
        `Potvrdit rezervaci: ${data.approveUrl}`,
        `Přesunout termín: ${data.adminUrl}`,
        `Zrušit rezervaci: ${data.rejectUrl}`,
        `Administrace: ${data.adminUrl}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Nová rezervace",
        "",
        `
          <div style="border:1px solid #eaded4;border-radius:12px;padding:20px;background:#fbf7f3;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:0 0 16px;border-bottom:1px solid #eaded4;">
                  <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;text-transform:uppercase;color:#9e7f65;">Služba</p>
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:28px;color:#1f1714;"><strong>${escapeHtml(data.serviceName)}</strong></p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 0;border-bottom:1px solid #eaded4;">
                  <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;text-transform:uppercase;color:#9e7f65;">Termín</p>
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:26px;color:#1f1714;"><strong>${escapeHtml(bookingDate)}</strong></p>
                  <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:26px;color:#1f1714;">${escapeHtml(bookingTime)}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 0 0;">
                  <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;text-transform:uppercase;color:#9e7f65;">Klientka</p>
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:26px;color:#1f1714;"><strong>${escapeHtml(data.clientName)}</strong></p>
                  <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#5b4c44;">${escapeHtml(data.clientEmail)}</p>
                  ${data.clientPhone ? `<p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#5b4c44;">${escapeHtml(data.clientPhone)}</p>` : ""}
                </td>
              </tr>
              ${clientNote ? `
              <tr>
                <td style="padding:16px 0 0;border-top:1px solid #eaded4;">
                  <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;text-transform:uppercase;color:#9e7f65;">Poznámka od klientky</p>
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#5b4c44;">${escapeHtml(clientNote)}</p>
                </td>
              </tr>
              ` : ""}
            </table>
          </div>
          <div style="margin-top:18px;border:1px solid #eaded4;border-radius:12px;padding:20px;background:#ffffff;">
            <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;font-weight:700;color:#1f1714;">Rychlé akce</p>
            <div style="margin:0 0 12px;">${buildEmailActionButton({
                href: data.approveUrl,
                label: "Potvrdit rezervaci",
                variant: "primary",
              })}</div>
            <div style="margin:0 0 12px;">${buildEmailActionButton({
                href: data.adminUrl,
                label: "Přesunout termín",
                variant: "secondary",
              })}</div>
            <div style="margin:0 0 12px;">${buildEmailActionButton({
                href: data.rejectUrl,
                label: "Zrušit rezervaci",
                variant: "destructive",
              })}</div>
            <div style="margin:0;">${buildEmailActionButton({
                href: data.adminUrl,
                label: "Otevřít v administraci",
                variant: "secondary",
              })}</div>
          </div>
        `,
        { includeFooter: false, maxWidthPx: 600 },
      );

      return { subject: safeSubject, html, text };
    }
    case "admin-booking-cancelled-v1": {
      const data = adminBookingCancelledPayloadSchema.parse(payload);
      const scheduledStartsAt = new Date(data.scheduledStartsAt);
      const scheduledEndsAt = new Date(data.scheduledEndsAt);
      const bookingDate = formatBookingCalendarDate(scheduledStartsAt);
      const bookingTime = formatBookingTimeRange(scheduledStartsAt, scheduledEndsAt);
      const text = [
        "Rezervace zrušena",
        "",
        `Služba: ${data.serviceName}`,
        `Datum: ${bookingDate}`,
        `Čas: ${bookingTime}`,
        `Klientka: ${data.clientName}`,
        `Email: ${data.clientEmail}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Rezervace zrušena",
        "",
        `
          ${buildEmailCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              ${buildEmailDetailRow("Služba", data.serviceName)}
              ${buildEmailDetailRow("Datum", bookingDate)}
              ${buildEmailDetailRow("Čas", bookingTime)}
              ${buildEmailDetailRow("Klientka", data.clientName)}
              ${buildEmailDetailRow("Email", data.clientEmail)}
            </table>
          `)}
        `,
        { includeFooter: false, maxWidthPx: 600 },
      );

      return { subject: safeSubject, html, text };
    }
    case "admin-booking-rescheduled-v1": {
      const data = adminBookingRescheduledPayloadSchema.parse(payload);
      const previousStartsAt = new Date(data.previousStartsAt);
      const previousEndsAt = new Date(data.previousEndsAt);
      const scheduledStartsAt = new Date(data.scheduledStartsAt);
      const scheduledEndsAt = new Date(data.scheduledEndsAt);
      const previousDate = formatBookingCalendarDate(previousStartsAt);
      const previousTime = formatBookingTimeRange(previousStartsAt, previousEndsAt);
      const bookingDate = formatBookingCalendarDate(scheduledStartsAt);
      const bookingTime = formatBookingTimeRange(scheduledStartsAt, scheduledEndsAt);

      const text = [
        "Rezervace přesunuta klientkou",
        "",
        `Služba: ${data.serviceName}`,
        `Nový termín: ${bookingDate}, ${bookingTime}`,
        `Původní termín: ${previousDate}, ${previousTime}`,
        `Klientka: ${data.clientName}`,
        `Email: ${data.clientEmail}`,
        "",
        `Detail v administraci: ${data.adminUrl}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Rezervace přesunuta klientkou",
        "",
        `
          ${buildEmailCard(`
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              ${buildEmailDetailRow("Služba", data.serviceName)}
              ${buildEmailDetailRow("Nový termín", `${bookingDate}, ${bookingTime}`)}
              ${buildEmailDetailRow("Původní termín", `${previousDate}, ${previousTime}`)}
              ${buildEmailDetailRow("Klientka", data.clientName)}
              ${buildEmailDetailRow("Email", data.clientEmail)}
            </table>
          `)}
          <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
          ${buildEmailActionButton({
            href: data.adminUrl,
            label: "Otevřít rezervaci v administraci",
            variant: "secondary",
          })}
        `,
        { includeFooter: false, maxWidthPx: 600 },
      );

      return { subject: safeSubject, html, text };
    }
    case "voucher-sent-v1": {
      const data = voucherSentPayloadSchema.parse(payload);
      const voucher = await getVoucherDetail(data.voucherId);

      if (!voucher) {
        throw new Error("Voucher pro e-mail nebyl nalezen.");
      }

      const pdfBytes = await generateVoucherPdf(voucher);
      const verificationUrl = buildVoucherVerificationUrl(voucher.code);
      const voucherEmail = buildVoucherEmailTemplate({
        subject: safeSubject,
        voucher,
        salon: {
          name: brand.name,
          addressLine: salonProfile.addressLine,
          phone: brand.phone,
          email: brand.email,
        },
        verificationUrl,
        pdfFilename: buildVoucherPdfFilename(voucher.code),
        pdfBytes,
      });

      return voucherEmail;
    }
    default:
      throw new Error(`Unsupported email template: ${templateKey}`);
  }
}
