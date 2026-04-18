import nodemailer from "nodemailer";

import { env } from "@/config/env";

export type EmailDeliveryMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailDeliveryResult = {
  provider: "log" | "smtp";
  messageId?: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER && env.SMTP_PASSWORD
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        }
      : undefined,
  });

  return cachedTransporter;
}

export async function sendEmail(message: EmailDeliveryMessage): Promise<EmailDeliveryResult> {
  if (env.EMAIL_DELIVERY_MODE === "log") {
    const messageId = `log-${Date.now()}`;

    console.info("Email delivery in log mode", {
      to: message.to,
      subject: message.subject,
      messageId,
    });

    return {
      provider: "log",
      messageId,
    };
  }

  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
    to: message.to,
    replyTo: env.SMTP_REPLY_TO ?? env.SMTP_FROM_EMAIL,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  return {
    provider: "smtp",
    messageId: info.messageId,
  };
}
