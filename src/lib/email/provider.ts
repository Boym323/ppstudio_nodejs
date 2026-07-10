import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import { env } from "@/config/env";
import {
  anonymizeEmailSubject,
  maskEmailAddress,
  sanitizeEmailHeaderValue,
} from "@/lib/email/header";
import { getEmailBrandingSettings, getSafeEnvelopeFromEmail } from "@/lib/site-settings";

export type EmailDeliveryMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType: string;
  }>;
  /** Stabilní identita jednoho outbox jobu pro bezpečné opakování odeslání. */
  idempotencyKey?: string;
};

export type EmailDeliveryResult = {
  provider: "log" | "smtp" | "resend";
  messageId?: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

export function resolveSmtpSecureMode(port: number | undefined, mode: "auto" | "true" | "false") {
  if (mode === "true") {
    return true;
  }

  if (mode === "false") {
    return false;
  }

  return port === 465 || port === 2465;
}

function getSmtpTransportOptions() {
  const secure = resolveSmtpSecureMode(env.SMTP_PORT, env.SMTP_SECURE);

  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure,
    requireTLS: !secure && (env.SMTP_PORT === 587 || env.SMTP_PORT === 2587),
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASSWORD,
          }
        : undefined,
  } satisfies SMTPTransport.Options;
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport(getSmtpTransportOptions());

  return cachedTransporter;
}

function getSmtpTransportHint(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  const maybeCode = (error as Error & { code?: string }).code;
  if (maybeCode !== "ESOCKET" && maybeCode !== "ECONNRESET") {
    return null;
  }

  if (!/wrong version number/i.test(error.message) && !/ssl routines/i.test(error.message)) {
    return null;
  }

  const secureMode = resolveSmtpSecureMode(env.SMTP_PORT, env.SMTP_SECURE);
  const secureLabel = secureMode ? "implicit TLS" : "STARTTLS";

  return new Error(
    `SMTP handshake failed for ${env.SMTP_HOST}:${env.SMTP_PORT}. The server responded with a TLS protocol mismatch, so check that the port and SMTP_SECURE setting agree (${secureLabel} is expected here).`,
    { cause: error },
  );
}

async function sendViaResend(message: EmailDeliveryMessage): Promise<EmailDeliveryResult> {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY chybí. Nelze odeslat e-mail přes Resend API.");
  }

  const emailBranding = await getEmailBrandingSettings();
  const requestedSenderEmail = emailBranding.senderEmail || env.SMTP_FROM_EMAIL || "info@ppstudio.cz";
  const fromEmail = getSafeEnvelopeFromEmail(requestedSenderEmail);
  const fromName = sanitizeEmailHeaderValue(emailBranding.senderName, "E-mail sender name");
  const from = `${fromName} <${fromEmail}>`;
  const to = message.to.trim();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: sanitizeEmailHeaderValue(message.subject, "E-mail subject"),
      text: message.text,
      html: message.html,
      reply_to: env.SMTP_REPLY_TO ?? requestedSenderEmail ?? env.SMTP_FROM_EMAIL ?? undefined,
      attachments:
        message.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content:
            (typeof attachment.content === "string"
              ? Buffer.from(attachment.content)
              : attachment.content).toString("base64"),
          content_type: attachment.contentType,
        })) ?? undefined,
    }),
  });

  const body = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;

  if (!response.ok || !body?.id) {
    throw new Error(
      `Resend API odeslání selhalo (${response.status}): ${body?.message ?? "Neznámá chyba."}`,
    );
  }

  return {
    provider: "resend",
    messageId: body.id,
  };
}

export async function sendEmail(message: EmailDeliveryMessage): Promise<EmailDeliveryResult> {
  const subject = sanitizeEmailHeaderValue(message.subject, "E-mail subject");

  if (env.EMAIL_DELIVERY_MODE === "log") {
    const messageId = `log-${Date.now()}`;
    const subjectLog = anonymizeEmailSubject(subject);

    console.info("Email delivery in log mode", {
      to: maskEmailAddress(message.to),
      subject: subjectLog,
      messageId,
      attachments: message.attachments?.map((attachment) => attachment.filename) ?? [],
    });

    return {
      provider: "log",
      messageId,
    };
  }

  if (env.EMAIL_TRANSPORT === "resend") {
    return sendViaResend({
      ...message,
      subject,
    });
  }

  const transporter = getTransporter();
  const emailBranding = await getEmailBrandingSettings();
  const requestedSenderEmail = emailBranding.senderEmail || env.SMTP_FROM_EMAIL || "info@ppstudio.cz";
  const fromEmail = getSafeEnvelopeFromEmail(requestedSenderEmail);
  const fromName = sanitizeEmailHeaderValue(emailBranding.senderName, "E-mail sender name");

  if (fromEmail !== requestedSenderEmail) {
    console.warn("Sender email overridden by SMTP safety policy", {
      requestedSenderEmail,
      fromEmail,
    });
  }

  let info;
  try {
    info = await transporter.sendMail({
      from: {
        name: fromName,
        address: fromEmail,
      },
      to: message.to,
      replyTo: env.SMTP_REPLY_TO ?? requestedSenderEmail ?? env.SMTP_FROM_EMAIL,
      subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments,
      messageId: message.idempotencyKey
        ? `<${message.idempotencyKey.replace(/[^a-zA-Z0-9._-]/g, "-")}@ppstudio.local>`
        : undefined,
      headers: message.idempotencyKey
        ? { "Resend-Idempotency-Key": message.idempotencyKey }
        : undefined,
    });
  } catch (error) {
    throw getSmtpTransportHint(error) ?? error;
  }

  return {
    provider: "smtp",
    messageId: info.messageId,
  };
}
