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
  includeCalendarAttachment: z.boolean().optional(),
});

const bookingReminder24hPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
  cancellationUrl: z.url(),
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
        : "background:#f6efe8;color:#1f1714;border:1px solid rgba(33,23,20,0.08);";

  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 22px;border-radius:999px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;${styles}">${escapeHtml(label)}</a>`;
}

function buildManageReservationMailto({
  brandEmail,
  clientName,
  serviceName,
  bookingDate,
  bookingTime,
}: {
  brandEmail: string;
  clientName: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
}) {
  const subject = `Žádost o změnu rezervace: ${serviceName}`;
  const body = [
    "Dobrý den,",
    "",
    "prosím o změnu rezervace.",
    `Klientka: ${clientName}`,
    `Služba: ${serviceName}`,
    `Termín: ${bookingDate}, ${bookingTime}`,
    "",
    "Děkuji.",
  ].join("\n");

  return `mailto:${brandEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
      const manageReservationUrl = buildManageReservationMailto({
        brandEmail: brand.email,
        clientName: data.clientName,
        serviceName: data.serviceName,
        bookingDate,
        bookingTime,
      });

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
        `Požádat o změnu: ${manageReservationUrl}`,
        `Zrušení rezervace: ${data.cancellationUrl}`,
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
            <p style="margin:0 0 14px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9e7f65;">Další kroky</p>
            <div style="font-size:0;line-height:0;">
              <div style="display:inline-block;margin:0 10px 10px 0;">${buildEmailButton({
                href: manageReservationUrl,
                label: "Požádat o změnu",
                variant: "primary",
              })}</div>
              <div style="display:inline-block;margin:0 10px 10px 0;">${buildEmailButton({
                href: data.cancellationUrl,
                label: "Zrušit rezervaci",
                variant: "destructive",
              })}</div>
            </div>
            <p style="margin:6px 0 0;font-size:13px;line-height:1.7;color:#7a675c;">Požádat o změnu zatím otevře předvyplněný e-mail do studia s detaily termínu.</p>
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
        "Pokud budete potřebovat termín upravit, ozvěte se prosím studiu.",
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
          <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#5b4c44;">
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
        "připomínáme vaši zítřejší rezervaci v PP Studio.",
        "",
        `Služba: ${data.serviceName}`,
        `Datum: ${bookingDate}`,
        `Čas: ${bookingTime}`,
        `Místo: ${salonProfile.addressLine}`,
        "",
        `Zrušit rezervaci: ${data.cancellationUrl}`,
        `Kontaktovat studio: ${contactStudioUrl}`,
        "",
        `${brand.name}`,
        `${brand.email} | ${brand.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Připomínka rezervace na zítra",
        `Zítra vás čeká ${data.serviceName}. Posíláme rychlé připomenutí termínu.`,
        `
          <div style="border:1px solid rgba(33,23,20,0.08);border-radius:20px;padding:22px;background:#fbf7f3;">
            <p style="margin:0;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9e7f65;">Služba</p>
            <p style="margin:10px 0 0;font-size:20px;line-height:1.5;color:#1f1714;"><strong>${escapeHtml(data.serviceName)}</strong></p>
            <p style="margin:18px 0 0;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9e7f65;">Datum a čas</p>
            <p style="margin:10px 0 0;font-size:18px;line-height:1.6;color:#1f1714;"><strong>${escapeHtml(bookingDate)}</strong><br />${escapeHtml(bookingTime)}</p>
            <p style="margin:18px 0 0;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9e7f65;">Místo</p>
            <p style="margin:10px 0 0;font-size:15px;line-height:1.7;color:#5b4c44;">${escapeHtml(salonProfile.addressLine)}</p>
          </div>
          <div style="margin-top:20px;border:1px solid rgba(33,23,20,0.08);border-radius:20px;padding:20px;background:#ffffff;">
            <p style="margin:0 0 14px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9e7f65;">Potřebujete změnu?</p>
            <div style="font-size:0;line-height:0;">
              <div style="display:inline-block;margin:0 10px 10px 0;">${buildEmailButton({
                href: data.cancellationUrl,
                label: "Zrušit rezervaci",
                variant: "destructive",
              })}</div>
              <div style="display:inline-block;margin:0 10px 10px 0;">${buildEmailButton({
                href: contactStudioUrl,
                label: "Kontaktovat studio",
                variant: "primary",
              })}</div>
            </div>
            <p style="margin:8px 0 0;font-size:13px;line-height:1.7;color:#7a675c;">Pokud potřebujete s termínem pomoci, ozvěte se nám co nejdřív.</p>
          </div>
        `,
      );

      return { subject, html, text };
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
      const scheduledAtLabel = formatBookingDateLabel(
        new Date(data.scheduledStartsAt),
        new Date(data.scheduledEndsAt),
      );
      const phoneLine = data.clientPhone ? `Telefon: ${data.clientPhone}` : "Telefon: neuveden";
      const text = [
        `Nová rezervace služby ${data.serviceName}.`,
        `Klientka: ${data.clientName}`,
        `E-mail: ${data.clientEmail}`,
        phoneLine,
        `Termín: ${scheduledAtLabel}`,
        "",
        `Schválit rezervaci: ${data.approveUrl}`,
        `Zrušit rezervaci: ${data.rejectUrl}`,
        `Otevřít v administraci: ${data.adminUrl}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Nová rezervace",
        `Do systému přišla nová rezervace služby ${data.serviceName}.`,
        `
          <div style="border:1px solid rgba(33,23,20,0.08);border-radius:18px;padding:20px;background:#fbf7f3;">
            <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.16em;color:#9e7f65;">Klientka</p>
            <p style="margin:0;font-size:18px;line-height:1.6;color:#1f1714;"><strong>${escapeHtml(data.clientName)}</strong></p>
            <p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#5b4c44;">${escapeHtml(data.clientEmail)}</p>
            <p style="margin:4px 0 0;font-size:14px;line-height:1.7;color:#5b4c44;">${escapeHtml(phoneLine)}</p>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#5b4c44;">Termín: <strong>${escapeHtml(scheduledAtLabel)}</strong></p>
          </div>
          <div style="margin-top:20px;border:1px solid rgba(33,23,20,0.08);border-radius:20px;padding:20px;background:#ffffff;">
            <p style="margin:0 0 14px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#9e7f65;">Rychlé zpracování</p>
            <div style="font-size:0;line-height:0;">
              <div style="display:inline-block;margin:0 10px 10px 0;">${buildEmailButton({
                href: data.approveUrl,
                label: "Schválit rezervaci",
                variant: "primary",
              })}</div>
              <div style="display:inline-block;margin:0 10px 10px 0;">${buildEmailButton({
                href: data.rejectUrl,
                label: "Zrušit rezervaci",
                variant: "destructive",
              })}</div>
              <div style="display:inline-block;margin:0 10px 10px 0;">${buildEmailButton({
                href: data.adminUrl,
                label: "Otevřít v administraci",
                variant: "secondary",
              })}</div>
            </div>
            <p style="margin:10px 0 0;font-size:13px;line-height:1.7;color:#7a675c;">
              Akční odkazy vedou nejdřív na potvrzovací mezikrok, takže rezervaci neschválíte ani nezrušíte omylem jedním kliknutím.
            </p>
          </div>
        `,
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
