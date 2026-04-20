import { z } from "zod";

import { env } from "@/config/env";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";
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

const adminBookingNotificationPayloadSchema = z.object({
  bookingId: z.string().min(1),
  serviceName: z.string().min(1),
  clientName: z.string().min(1),
  clientEmail: z.string().email(),
  clientPhone: z.string().optional().nullable(),
  scheduledStartsAt: z.string().datetime(),
  scheduledEndsAt: z.string().datetime(),
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
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailShell(
  brand: { name: string; email: string; phone: string; footerText?: string | null },
  title: string,
  intro: string,
  body: string,
) {
  return `
    <div style="background:#f7f1eb;padding:32px 16px;font-family:Arial,sans-serif;color:#2e241f;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;box-shadow:0 20px 60px rgba(42,29,21,0.08);">
        <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#9e7f65;">${escapeHtml(brand.name)}</p>
        <h1 style="margin:0 0 16px;font-size:30px;line-height:1.15;font-family:Georgia,serif;color:#1f1714;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#5b4c44;">${escapeHtml(intro)}</p>
        ${body}
        <p style="margin:32px 0 0;font-size:14px;line-height:1.7;color:#5b4c44;">
          Pokud budete potřebovat pomoci, napište nám na
          <a href="mailto:${escapeHtml(brand.email)}" style="color:#1f1714;">${escapeHtml(brand.email)}</a>
          nebo zavolejte na
          <a href="tel:${escapeHtml(brand.phone)}" style="color:#1f1714;">${escapeHtml(brand.phone)}</a>.
        </p>
        ${brand.footerText ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#5b4c44;">${escapeHtml(brand.footerText)}</p>` : ""}
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
      const scheduledAtLabel = formatBookingDateLabel(
        new Date(data.scheduledStartsAt),
        new Date(data.scheduledEndsAt),
      );

      const text = [
        `Dobrý den, ${data.clientName},`,
        "",
        `vaši rezervaci služby ${data.serviceName} jsme přijali ke schválení.`,
        `Termín: ${scheduledAtLabel}`,
        `Referenční kód: ${data.bookingId.slice(-8).toUpperCase()}`,
        "",
        `Pokud potřebujete rezervaci stáhnout, použijte storno odkaz: ${data.cancellationUrl}`,
        "",
        `${brand.name}`,
        `${brand.email} | ${brand.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        brand,
        "Rezervace přijata",
        `Vaši rezervaci služby ${data.serviceName} jsme přijali ke schválení.`,
        `
          <div style="border:1px solid rgba(33,23,20,0.08);border-radius:18px;padding:20px;background:#fbf7f3;">
            <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.16em;color:#9e7f65;">Termín</p>
            <p style="margin:0;font-size:18px;line-height:1.6;color:#1f1714;"><strong>${escapeHtml(scheduledAtLabel)}</strong></p>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#5b4c44;">Referenční kód: <strong>${escapeHtml(data.bookingId.slice(-8).toUpperCase())}</strong></p>
          </div>
          <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#5b4c44;">
            Pokud potřebujete rezervaci stáhnout, použijte bezpečný storno odkaz:
          </p>
          <p style="margin:16px 0 0;">
            <a href="${escapeHtml(data.cancellationUrl)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#1f1714;color:#ffffff;text-decoration:none;font-weight:600;">
              Zrušit rezervaci
            </a>
          </p>
        `,
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
        `Referenční kód: ${data.bookingId.slice(-8).toUpperCase()}`,
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
            <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#5b4c44;">Referenční kód: <strong>${escapeHtml(data.bookingId.slice(-8).toUpperCase())}</strong></p>
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
        `Reference: ${data.bookingId.slice(-8).toUpperCase()}`,
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
        `Reference: ${data.bookingId.slice(-8).toUpperCase()}`,
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
