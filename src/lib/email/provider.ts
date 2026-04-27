import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import { env } from "@/config/env";
import { getEmailBrandingSettings, getSafeEnvelopeFromEmail } from "@/lib/site-settings";

export type EmailDeliveryMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
};

export type EmailDeliveryResult = {
  provider: "log" | "smtp";
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

export async function sendEmail(message: EmailDeliveryMessage): Promise<EmailDeliveryResult> {
  if (env.EMAIL_DELIVERY_MODE === "log") {
    const messageId = `log-${Date.now()}`;

    console.info("Email delivery in log mode", {
      to: message.to,
      subject: message.subject,
      messageId,
      attachments: message.attachments?.map((attachment) => attachment.filename) ?? [],
    });

    return {
      provider: "log",
      messageId,
    };
  }

  const transporter = getTransporter();
  const emailBranding = await getEmailBrandingSettings();
  const requestedSenderEmail = emailBranding.senderEmail || env.SMTP_FROM_EMAIL || "info@ppstudio.cz";
  const fromEmail = getSafeEnvelopeFromEmail(requestedSenderEmail);

  if (fromEmail !== requestedSenderEmail) {
    console.warn("Sender email overridden by SMTP safety policy", {
      requestedSenderEmail,
      fromEmail,
    });
  }

  let info;
  try {
    info = await transporter.sendMail({
      from: `"${emailBranding.senderName}" <${fromEmail}>`,
      to: message.to,
      replyTo: env.SMTP_REPLY_TO ?? requestedSenderEmail ?? env.SMTP_FROM_EMAIL,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments,
    });
  } catch (error) {
    throw getSmtpTransportHint(error) ?? error;
  }

  return {
    provider: "smtp",
    messageId: info.messageId,
  };
}
