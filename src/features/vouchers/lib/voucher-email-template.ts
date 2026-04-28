import { VoucherType } from "@prisma/client";

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Prague",
});

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

type VoucherEmailTemplateInput = {
  subject: string;
  customMessage?: string | null;
  voucher: {
    type: VoucherType;
    code: string;
    validUntil: Date | null;
    originalValueCzk: number | null;
    remainingValueCzk: number | null;
    serviceNameSnapshot: string | null;
    servicePriceSnapshotCzk: number | null;
  };
  salon: {
    name: string;
    addressLine: string;
    phone: string;
    email: string;
  };
  verificationUrl: string;
  pdfFilename: string;
  pdfBytes: Uint8Array;
};

type VoucherEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type VoucherEmailTemplateOutput = {
  subject: string;
  html: string;
  text: string;
  attachments: VoucherEmailAttachment[];
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatVoucherTypeLabel(type: VoucherType) {
  return type === VoucherType.VALUE ? "Hodnotový poukaz" : "Poukaz na službu";
}

function formatVoucherMainLabel(input: VoucherEmailTemplateInput["voucher"]) {
  if (input.type === VoucherType.VALUE) {
    if (typeof input.originalValueCzk === "number") {
      return czkFormatter.format(input.originalValueCzk);
    }

    return "Hodnota není uvedena";
  }

  const serviceName = input.serviceNameSnapshot?.trim();
  if (!serviceName) {
    return "Služba není uvedena";
  }

  if (typeof input.servicePriceSnapshotCzk === "number") {
    return `${serviceName} (${czkFormatter.format(input.servicePriceSnapshotCzk)})`;
  }

  return serviceName;
}

function formatValidUntil(value: Date | null) {
  return value ? dateFormatter.format(value) : "Bez omezení";
}

function buildDetailRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eaded4;">
        <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9e7f65;">${escapeHtml(label)}</p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#1f1714;"><strong>${escapeHtml(value)}</strong></p>
      </td>
    </tr>
  `;
}

export function buildVoucherEmailTemplate(input: VoucherEmailTemplateInput): VoucherEmailTemplateOutput {
  const customMessage = input.customMessage?.trim() || "Dobrý den, v příloze zasíláme dárkový poukaz PP Studio.";
  const voucherTypeLabel = formatVoucherTypeLabel(input.voucher.type);
  const voucherMainLabel = formatVoucherMainLabel(input.voucher);
  const voucherMainFieldLabel = input.voucher.type === VoucherType.VALUE ? "Hodnota" : "Služba";
  const validUntilLabel = formatValidUntil(input.voucher.validUntil);
  const contactRows = [
    input.salon.name.trim(),
    input.salon.addressLine.trim(),
    input.salon.phone.trim(),
    input.salon.email.trim(),
  ].filter((value) => value.length > 0);

  const text = [
    "Dobrý den,",
    "",
    customMessage,
    "",
    `Typ poukazu: ${voucherTypeLabel}`,
    `${voucherMainFieldLabel}: ${voucherMainLabel}`,
    `Kód voucheru: ${input.voucher.code}`,
    `Platnost do: ${validUntilLabel}`,
    "",
    "Poukaz můžete uplatnit při online rezervaci nebo osobně v salonu.",
    "Platnost poukazu si můžete ověřit zde:",
    input.verificationUrl,
    "",
    "Těšíme se na Vaši návštěvu.",
    "",
    ...contactRows,
  ].join("\n");

  const html = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background:#f7f1eb;">
      <tr>
        <td align="center" style="padding:28px 14px;font-family:Arial,Helvetica,sans-serif;color:#2e241f;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #eaded4;border-radius:18px;">
            <tr>
              <td style="padding:28px 24px;">
                <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#5b4c44;">Dobrý den,</p>
                <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#5b4c44;">${escapeHtml(customMessage)}</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;border:1px solid #eaded4;border-radius:14px;background:#fbf7f3;">
                  <tr>
                    <td style="padding:18px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        ${buildDetailRow("Typ poukazu", voucherTypeLabel)}
                        ${buildDetailRow(voucherMainFieldLabel, voucherMainLabel)}
                        ${buildDetailRow("Kód voucheru", input.voucher.code)}
                        ${buildDetailRow("Platnost do", validUntilLabel)}
                      </table>
                    </td>
                  </tr>
                </table>

                <p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#5b4c44;">Poukaz můžete uplatnit při online rezervaci nebo osobně v salonu.</p>
                <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#5b4c44;">Platnost poukazu si můžete ověřit zde:<br /><a href="${escapeHtml(input.verificationUrl)}" style="color:#1f1714;text-decoration:underline;">${escapeHtml(input.verificationUrl)}</a></p>
                <p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#5b4c44;">Těšíme se na Vaši návštěvu.</p>
                <p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#5b4c44;">${contactRows.map((row) => escapeHtml(row)).join("<br />")}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `.trim();

  return {
    subject: input.subject,
    html,
    text,
    attachments: [
      {
        filename: input.pdfFilename,
        content: Buffer.from(input.pdfBytes),
        contentType: "application/pdf",
      },
    ],
  };
}
