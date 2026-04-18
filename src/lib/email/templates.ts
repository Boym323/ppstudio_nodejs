import { z } from "zod";

import { siteConfig } from "@/config/site";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";

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

function buildEmailShell(title: string, intro: string, body: string) {
  return `
    <div style="background:#f7f1eb;padding:32px 16px;font-family:Arial,sans-serif;color:#2e241f;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;box-shadow:0 20px 60px rgba(42,29,21,0.08);">
        <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#9e7f65;">${escapeHtml(siteConfig.name)}</p>
        <h1 style="margin:0 0 16px;font-size:30px;line-height:1.15;font-family:Georgia,serif;color:#1f1714;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#5b4c44;">${escapeHtml(intro)}</p>
        ${body}
        <p style="margin:32px 0 0;font-size:14px;line-height:1.7;color:#5b4c44;">
          Pokud budete potřebovat pomoci, napište nám na
          <a href="mailto:${escapeHtml(siteConfig.contact.email)}" style="color:#1f1714;">${escapeHtml(siteConfig.contact.email)}</a>
          nebo zavolejte na
          <a href="tel:${escapeHtml(siteConfig.contact.phone)}" style="color:#1f1714;">${escapeHtml(siteConfig.contact.phone)}</a>.
        </p>
      </div>
    </div>
  `.trim();
}

export function renderEmailTemplate(
  templateKey: string,
  subject: string,
  payload: unknown,
): RenderedEmailTemplate {
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
        `vaše rezervace služby ${data.serviceName} je potvrzená.`,
        `Termín: ${scheduledAtLabel}`,
        `Referenční kód: ${data.bookingId.slice(-8).toUpperCase()}`,
        "",
        `Storno rezervace: ${data.cancellationUrl}`,
        "",
        `${siteConfig.name}`,
        `${siteConfig.contact.email} | ${siteConfig.contact.phone}`,
      ].join("\n");

      const html = buildEmailShell(
        "Potvrzení rezervace",
        `Vaše rezervace služby ${data.serviceName} je potvrzená.`,
        `
          <div style="border:1px solid rgba(33,23,20,0.08);border-radius:18px;padding:20px;background:#fbf7f3;">
            <p style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.16em;color:#9e7f65;">Termín</p>
            <p style="margin:0;font-size:18px;line-height:1.6;color:#1f1714;"><strong>${escapeHtml(scheduledAtLabel)}</strong></p>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#5b4c44;">Referenční kód: <strong>${escapeHtml(data.bookingId.slice(-8).toUpperCase())}</strong></p>
          </div>
          <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#5b4c44;">
            Pokud potřebujete termín zrušit, použijte bezpečný storno odkaz:
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
        `Pro nový termín navštivte ${siteConfig.url}/rezervace`,
        "",
        `${siteConfig.name}`,
        `${siteConfig.contact.email} | ${siteConfig.contact.phone}`,
      ].join("\n");

      const html = buildEmailShell(
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
            <a href="${escapeHtml(`${siteConfig.url}/rezervace`)}" style="color:#1f1714;"> ${escapeHtml(siteConfig.url)}/rezervace</a>.
          </p>
        `,
      );

      return { subject, html, text };
    }
    default:
      throw new Error(`Unsupported email template: ${templateKey}`);
  }
}
