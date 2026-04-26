import { z } from "zod";

import { env } from "@/config/env";
import { buildBookingCalendarIcsFromPayload } from "@/features/calendar/lib/booking-calendar-event";
import {
  formatBookingCalendarDate,
  formatBookingDateLabel,
  formatBookingTimeRange,
} from "@/features/booking/lib/booking-format";
import { getEmailBrandingSettings, getPublicSalonProfile } from "@/lib/site-settings";

const bookingConfirmationPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
  manageReservationUrl: z.url(),
  cancellationUrl: z.url(),
});

const bookingCancelledPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
});

const bookingApprovedPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
  manageReservationUrl: z.url(),
  includeCalendarAttachment: z.boolean().optional(),
});

const bookingReminder24hPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
  manageReservationUrl: z.url(),
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
  manageReservationUrl: z.url(),
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

export type RenderedEmailTemplate = {
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 22px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;text-align:center;text-decoration:none;white-space:normal;${styles}">${escapeHtml(label)}</a>`;
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
  const textColor = variant === "primary" ? "#ffffff" : variant === "destructive" ? "#9f2f24" : "#1f1714";
  const styles =
    variant === "primary"
      ? "background:#1f1714;color:#ffffff;border:1px solid #1f1714;"
      : variant === "destructive"
        ? "background:#fff7f5;color:#9f2f24;border:1px solid #f0d4cf;"
        : "background:#f6efe8;color:#1f1714;border:1px solid #eaded4;";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0;">
      <tr>
        <td style="border-radius:8px;${styles}">
          <a href="${escapeHtml(href)}" style="display:block;padding:13px 18px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;font-weight:700;text-align:center;text-decoration:none;color:${textColor};white-space:normal;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `.trim();
}

function buildEmailShell(
  brand: { name: string; email: string; phone: string; footerText?: string | null },
  title: string,
  intro: string,
  body: string,
  options?: {
    includeFooter?: boolean;
  },
) {
  return `
    <div style="background:#f7f1eb;padding:32px 16px;font-family:Arial,sans-serif;color:#2e241f;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;box-shadow:0 20px 60px rgba(42,29,21,0.08);">
        <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#9e7f65;">${escapeHtml(brand.name)}</p>
        ${title ? `<h1 style="margin:0 0 16px;font-size:30px;line-height:1.15;font-family:Georgia,serif;color:#1f1714;">${escapeHtml(title)}</h1>` : ""}
        ${intro ? `<p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#5b4c44;">${escapeHtml(intro)}</p>` : ""}
        ${body}
        ${options?.includeFooter === false ? "" : `
          <p style="margin:32px 0 0;font-size:14px;line-height:1.7;color:#5b4c44;">
            Pokud budete potřebovat pomoci, napište nám na
            <a href="mailto:${escapeHtml(brand.email)}" style="color:#1f1714;">${escapeHtml(brand.email)}</a>
            nebo zavolejte na
            <a href="tel:${escapeHtml(brand.phone)}" style="color:#1f1714;">${escapeHtml(brand.phone)}</a>.
          </p>
          ${brand.footerText ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#5b4c44;">${escapeHtml(brand.footerText)}</p>` : ""}
        `}
      </div>
    </div>
  `.trim();
}

export async function renderEmailTemplate(
  templateKey: string,
  subject: string,
  payload: unknown,
): Promise<RenderedEmailTemplate> {
  const [salonProfile, emailBranding] = await Promise.all([
    getPublicSalonProfile().catch(() => ({
      name: env.NEXT_PUBLIC_APP_NAME,
      phone: "+420 777 000 000",
      email: "hello@ppstudio.cz",
      instagramUrl: null,
      addressLine: "Masarykova 12, 602 00 Brno",
      bookingLabel: "Dle vypsaných termínů a individuální domluvy",
    })),
    getEmailBrandingSettings().catch(() => ({
      salonName: env.NEXT_PUBLIC_APP_NAME,
      phone: "+420 777 000 000",
      contactEmail: "hello@ppstudio.cz",
      senderName: env.SMTP_FROM_NAME,
      senderEmail: env.SMTP_FROM_EMAIL ?? "hello@ppstudio.cz",
      footerText: null,
      notificationAdminEmail: env.ADMIN_OWNER_EMAIL,
    })),
  ]);
  const brand = {
    name: salonProfile.name,
    email: salonProfile.email,
    phone: salonProfile.phone,
    footerText: emailBranding.footerText,
  };

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
        `Vaši rezervaci služby ${data.serviceName} jsme přijali ke schválení.`,
        "",
        `Služba: ${data.serviceName}`,
        `Termín: ${bookingDate}`,
        `Čas: ${bookingTime}`,
        "Co bude následovat:",
        "Potvrzení přijde dalším e-mailem a kdyby bylo potřeba něco upřesnit, ozveme se.",
        "",
        "Potřebujete pomoc?",
        `${brand.email}`,
        `${brand.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "",
        "",
        `
          <div style="border:1px solid rgba(33,23,20,0.08);border-radius:24px;padding:24px;background:linear-gradient(135deg,#231814,#46342a);color:#ffffff;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:top;padding-right:16px;">
                  <p style="margin:0;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(232,213,192,0.78);">PP Studio</p>
                  <h2 style="margin:18px 0 0;font-size:32px;line-height:1.12;font-family:Georgia,serif;color:#ffffff;">Rezervace přijata</h2>
                  <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.74);">Vaši rezervaci jsme přijali ke schválení.</p>
                </td>
                <td style="width:150px;vertical-align:top;">
                  <div style="border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:12px 14px;background:rgba(255,255,255,0.08);">
                    <p style="margin:0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.54);">Stav rezervace</p>
                    <p style="margin:8px 0 0;font-size:14px;font-weight:600;color:#ffffff;">Čeká na potvrzení</p>
                  </div>
                </td>
              </tr>
            </table>
          </div>
          <div style="margin-top:20px;border:1px solid rgba(33,23,20,0.08);border-radius:22px;padding:24px;background:#fbf7f3;">
            <p style="margin:0;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9e7f65;">Služba</p>
            <p style="margin:12px 0 0;font-size:19px;line-height:1.6;color:#1f1714;"><strong>${escapeHtml(data.serviceName)}</strong></p>
            <p style="margin:18px 0 0;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9e7f65;">Termín</p>
            <p style="margin:12px 0 0;font-size:31px;line-height:1.16;font-family:Georgia,serif;color:#1f1714;"><strong>${escapeHtml(bookingDate)}</strong></p>
            <p style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:700;color:#1f1714;">${escapeHtml(bookingTime)}</p>
          </div>
          <div style="margin-top:20px;border:1px solid rgba(33,23,20,0.08);border-radius:20px;padding:20px;background:#ffffff;">
            <p style="margin:0;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9e7f65;">Co bude následovat</p>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#5b4c44;">Potvrzení přijde dalším e-mailem a kdyby bylo potřeba něco upřesnit, ozveme se.</p>
          </div>
          <div style="margin-top:20px;border:1px solid rgba(33,23,20,0.08);border-radius:20px;padding:20px;background:#ffffff;">
            <p style="margin:0;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9e7f65;">Potřebujete pomoc?</p>
            <p style="margin:12px 0 0;font-size:16px;line-height:1.8;color:#1f1714;">
              <a href="mailto:${escapeHtml(brand.email)}" style="color:#1f1714;text-decoration:none;">${escapeHtml(brand.email)}</a><br />
              <a href="tel:${escapeHtml(brand.phone)}" style="color:#1f1714;text-decoration:none;">${escapeHtml(brand.phone)}</a>
            </p>
          </div>
        `,
        { includeFooter: false },
      );

      return { subject, html, text };
    }
    case "booking-cancelled-v1": {
      const data = bookingCancelledPayloadSchema.parse(payload);
      const scheduledAtLabel = formatBookingDateLabel(
        new Date(data.scheduledStartsAt),
        new Date(data.scheduledEndsAt),
      );

      const text = [
        `Dobrý den, ${data.clientName},`,
        "",
        `vaše rezervace služby ${data.serviceName} byla zrušená.`,
        `Původní termín: ${scheduledAtLabel}`,
        "",
        `Pro nový termín navštivte ${env.NEXT_PUBLIC_APP_URL}/rezervace`,
        "",
        `${brand.name}`,
        `${brand.email} | ${brand.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Rezervace byla zrušena",
        `Storno rezervace služby ${data.serviceName} bylo úspěšně dokončeno.`,
        `
          <div style="border:1px solid rgba(33,23,20,0.08);border-radius:18px;padding:20px;background:#fbf7f3;">
            <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.16em;color:#9e7f65;">Původní termín</p>
            <p style="margin:0;font-size:18px;line-height:1.6;color:#1f1714;"><strong>${escapeHtml(scheduledAtLabel)}</strong></p>
          </div>
          <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#5b4c44;">
            Nový termín si můžete kdykoli vybrat znovu na
            <a href="${escapeHtml(`${env.NEXT_PUBLIC_APP_URL}/rezervace`)}" style="color:#1f1714;"> ${escapeHtml(env.NEXT_PUBLIC_APP_URL)}/rezervace</a>.
          </p>
        `,
      );

      return { subject, html, text };
    }
    case "booking-approved-v1": {
      const data = bookingApprovedPayloadSchema.parse(payload);
      const scheduledStartsAt = new Date(data.scheduledStartsAt);
      const scheduledEndsAt = new Date(data.scheduledEndsAt);
      const scheduledAtLabel = formatBookingDateLabel(scheduledStartsAt, scheduledEndsAt);
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
        `vaše rezervace služby ${data.serviceName} byla potvrzena.`,
        `Termín: ${scheduledAtLabel}`,
        "",
        ...(includeCalendarAttachment
          ? [
              "Termín najdete také v přiložené kalendářové události.",
              "",
            ]
          : []),
        `Změnit termín: ${data.manageReservationUrl}`,
        "Pokud budete potřebovat s termínem pomoci, ozvěte se prosím studiu.",
        "",
        `${brand.name}`,
        `${brand.email} | ${brand.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Rezervace byla potvrzena",
        `Vaše rezervace služby ${data.serviceName} je potvrzená.`,
        `
          <div style="border:1px solid rgba(33,23,20,0.08);border-radius:18px;padding:20px;background:#fbf7f3;">
            <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.16em;color:#9e7f65;">Termín</p>
            <p style="margin:0;font-size:18px;line-height:1.6;color:#1f1714;"><strong>${escapeHtml(scheduledAtLabel)}</strong></p>
          </div>
          ${includeCalendarAttachment ? `
          <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#5b4c44;">
            Termín najdete také v přiložené kalendářové události.
          </p>
          ` : ""}
          <div style="margin-top:24px;">${buildEmailButton({
            href: data.manageReservationUrl,
            label: "Změnit termín",
            variant: "primary",
          })}</div>
          <p style="margin:18px 0 0;font-size:15px;line-height:1.7;color:#5b4c44;">
            Pokud budete potřebovat s termínem pomoci, napište nám nebo zavolejte. Rádi s vámi domluvíme další postup.
          </p>
        `,
      );

      return {
        subject,
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
      const contactStudioUrl = `mailto:${brand.email}?subject=${encodeURIComponent(`Dotaz k rezervaci: ${data.serviceName}`)}`;

      const text = [
        `Dobrý den, ${data.clientName},`,
        "",
        "zítra máte rezervaci v PP Studiu.",
        "Jen krátká připomínka vašeho zítřejšího termínu.",
        "",
        `Služba: ${data.serviceName}`,
        `Datum a čas: ${bookingDate}, ${bookingTime}`,
        `Kde nás najdete: ${salonProfile.addressLine}`,
        "",
        "Nemůžete dorazit?",
        `Změnit termín: ${data.manageReservationUrl}`,
        `Ozvat se studiu: ${contactStudioUrl}`,
        `Zrušit rezervaci: ${data.cancellationUrl}`,
        "Pokud by se cokoliv změnilo, dejte nám prosím vědět co nejdříve.",
        "",
        `${brand.name}`,
        `${brand.email} | ${brand.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Zítra máte rezervaci v PP Studiu",
        "Jen krátká připomínka vašeho zítřejšího termínu.",
        `
          <div style="padding:0 0 4px;">
            <p style="margin:0;font-size:22px;line-height:1.4;color:#1f1714;"><strong>${escapeHtml(data.serviceName)}</strong></p>
            <p style="margin:10px 0 0;font-size:17px;line-height:1.6;color:#1f1714;"><strong>${escapeHtml(bookingDate)}</strong><br />${escapeHtml(bookingTime)}</p>
            <p style="margin:14px 0 0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#9e7f65;">Kde nás najdete</p>
            <p style="margin:8px 0 0;font-size:15px;line-height:1.7;color:#5b4c44;">${escapeHtml(salonProfile.addressLine)}</p>
          </div>
          <div style="margin-top:24px;padding:20px 0 0;border-top:1px solid rgba(33,23,20,0.08);">
            <p style="margin:0 0 14px;font-size:18px;line-height:1.5;color:#1f1714;"><strong>Nemůžete dorazit?</strong></p>
            <div style="margin:0 0 12px;">${buildEmailButton({
              href: data.manageReservationUrl,
              label: "Změnit termín",
              variant: "primary",
            })}</div>
            <div style="margin:0 0 12px;">${buildEmailButton({
              href: contactStudioUrl,
              label: "Ozvat se studiu",
              variant: "secondary",
            })}</div>
            <div style="margin:0 0 12px;">${buildEmailButton({
              href: data.cancellationUrl,
              label: "Zrušit rezervaci",
              variant: "secondary",
            })}</div>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#7a675c;">Pokud by se cokoliv změnilo, dejte nám prosím vědět co nejdříve.</p>
          </div>
        `,
      );

      return { subject, html, text };
    }
    case "booking-rescheduled-v1": {
      const data = bookingRescheduledPayloadSchema.parse(payload);
      const previousStartsAt = new Date(data.previousStartsAt);
      const previousEndsAt = new Date(data.previousEndsAt);
      const scheduledStartsAt = new Date(data.scheduledStartsAt);
      const scheduledEndsAt = new Date(data.scheduledEndsAt);
      const previousLabel = formatBookingDateLabel(previousStartsAt, previousEndsAt);
      const updatedLabel = formatBookingDateLabel(scheduledStartsAt, scheduledEndsAt);
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
        `termín rezervace služby ${data.serviceName} byl změněn.`,
        `Původní termín: ${previousLabel}`,
        `Nový termín: ${updatedLabel}`,
        `Místo: ${salonProfile.addressLine}`,
        "",
        ...(includeCalendarAttachment
          ? [
              "Aktualizovaný termín najdete také v přiložené kalendářové události.",
              "",
            ]
          : []),
        `Další změna termínu: ${data.manageReservationUrl}`,
        `Zrušit rezervaci: ${data.cancellationUrl}`,
        "",
        `${brand.name}`,
        `${brand.email} | ${brand.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Termín rezervace byl změněn",
        `Rezervaci služby ${data.serviceName} jsme přesunuli na nový čas.`,
        `
          <div style="border:1px solid rgba(33,23,20,0.08);border-radius:18px;padding:20px;background:#fbf7f3;">
            <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.16em;color:#9e7f65;">Nový termín</p>
            <p style="margin:0;font-size:18px;line-height:1.6;color:#1f1714;"><strong>${escapeHtml(updatedLabel)}</strong></p>
            <p style="margin:14px 0 0;font-size:13px;text-transform:uppercase;letter-spacing:0.16em;color:#9e7f65;">Původně</p>
            <p style="margin:8px 0 0;font-size:15px;line-height:1.7;color:#5b4c44;">${escapeHtml(previousLabel)}</p>
            <p style="margin:14px 0 0;font-size:13px;text-transform:uppercase;letter-spacing:0.16em;color:#9e7f65;">Místo</p>
            <p style="margin:8px 0 0;font-size:15px;line-height:1.7;color:#5b4c44;">${escapeHtml(salonProfile.addressLine)}</p>
          </div>
          ${includeCalendarAttachment ? `
          <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#5b4c44;">
            Aktualizovaný termín najdete také v přiložené kalendářové události.
          </p>
          ` : ""}
          <div style="margin-top:24px;">${buildEmailButton({
            href: data.manageReservationUrl,
            label: "Změnit termín",
            variant: "primary",
          })}</div>
          <div style="margin-top:24px;">${buildEmailButton({
            href: data.cancellationUrl,
            label: "Zrušit rezervaci",
            variant: "secondary",
          })}</div>
        `,
      );

      return {
        subject,
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
      const scheduledAtLabel = formatBookingDateLabel(
        new Date(data.scheduledStartsAt),
        new Date(data.scheduledEndsAt),
      );

      const text = [
        `Dobrý den, ${data.clientName},`,
        "",
        `rezervaci služby ${data.serviceName} se tentokrát nepodařilo potvrdit.`,
        `Původní požadovaný termín: ${scheduledAtLabel}`,
        "",
        `Pro nový termín navštivte ${env.NEXT_PUBLIC_APP_URL}/rezervace nebo se ozvěte přímo studiu.`,
        "",
        `${brand.name}`,
        `${brand.email} | ${brand.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Rezervaci se tentokrát nepodařilo potvrdit",
        `Požadovaný termín služby ${data.serviceName} jsme uzavřeli bez potvrzení.`,
        `
          <div style="border:1px solid rgba(33,23,20,0.08);border-radius:18px;padding:20px;background:#fbf7f3;">
            <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.16em;color:#9e7f65;">Původní termín</p>
            <p style="margin:0;font-size:18px;line-height:1.6;color:#1f1714;"><strong>${escapeHtml(scheduledAtLabel)}</strong></p>
          </div>
          <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#5b4c44;">
            Nový termín si můžete kdykoli vybrat znovu na
            <a href="${escapeHtml(`${env.NEXT_PUBLIC_APP_URL}/rezervace`)}" style="color:#1f1714;"> ${escapeHtml(env.NEXT_PUBLIC_APP_URL)}/rezervace</a>.
          </p>
        `,
      );

      return { subject, html, text };
    }
    case "admin-booking-notification-v1": {
      const data = adminBookingNotificationPayloadSchema.parse(payload);
      const scheduledStartsAt = new Date(data.scheduledStartsAt);
      const scheduledEndsAt = new Date(data.scheduledEndsAt);
      const bookingDate = formatBookingCalendarDate(scheduledStartsAt);
      const bookingTime = formatBookingTimeRange(scheduledStartsAt, scheduledEndsAt);
      const phoneLine = data.clientPhone ? `Telefon: ${data.clientPhone}` : null;
      const text = [
        "Nová rezervace",
        "",
        `Služba: ${data.serviceName}`,
        `Termín: ${bookingDate}, ${bookingTime}`,
        `Klientka: ${data.clientName}`,
        `Email: ${data.clientEmail}`,
        ...(phoneLine ? [phoneLine] : []),
        "",
        `Potvrdit rezervaci: ${data.approveUrl}`,
        `Přesunout termín: ${data.adminUrl}`,
        `Zrušit rezervaci: ${data.rejectUrl}`,
        `Administrace: ${data.adminUrl}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Nová rezervace",
        "Do systému přišla nová rezervace.",
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
            <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#7a675c;">
              Vyberte další krok nebo otevřete rezervaci v administraci.
            </p>
          </div>
        `,
        { includeFooter: false },
      );

      return { subject, html, text };
    }
    case "admin-booking-cancelled-v1": {
      const data = adminBookingCancelledPayloadSchema.parse(payload);
      const scheduledAtLabel = formatBookingDateLabel(
        new Date(data.scheduledStartsAt),
        new Date(data.scheduledEndsAt),
      );
      const text = [
        `Rezervace služby ${data.serviceName} byla zrušena.`,
        `Klientka: ${data.clientName}`,
        `E-mail: ${data.clientEmail}`,
        `Původní termín: ${scheduledAtLabel}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Rezervace zrušena",
        `Klientka ${data.clientName} zrušila rezervaci služby ${data.serviceName}.`,
        `
          <div style="border:1px solid rgba(33,23,20,0.08);border-radius:18px;padding:20px;background:#fbf7f3;">
            <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.16em;color:#9e7f65;">Původní termín</p>
            <p style="margin:0;font-size:18px;line-height:1.6;color:#1f1714;"><strong>${escapeHtml(scheduledAtLabel)}</strong></p>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#5b4c44;">Klientka: <strong>${escapeHtml(data.clientName)}</strong></p>
            <p style="margin:4px 0 0;font-size:14px;line-height:1.7;color:#5b4c44;">${escapeHtml(data.clientEmail)}</p>
          </div>
        `,
      );

      return { subject, html, text };
    }
    default:
      throw new Error(`Unsupported email template: ${templateKey}`);
  }
}
