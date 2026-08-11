import { VoucherType } from "@prisma/client";
import { createElement } from "react";
import { render } from "react-email";

import { VoucherSentEmail } from "@/lib/email/react-email/VoucherSentEmail";

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

  return serviceName;
}

function formatValidUntil(value: Date | null) {
  return value ? dateFormatter.format(value) : "Bez omezení";
}

function resolveWebsiteDomain(verificationUrl: string) {
  try {
    const hostname = new URL(verificationUrl).hostname.trim().toLowerCase();
    if (!hostname) {
      return "ppstudio.cz";
    }

    return hostname.replace(/^www\./, "");
  } catch {
    return "ppstudio.cz";
  }
}

export async function buildVoucherEmailTemplate(input: VoucherEmailTemplateInput): Promise<VoucherEmailTemplateOutput> {
  const websiteDomain = resolveWebsiteDomain(input.verificationUrl);
  const voucherTypeLabel = formatVoucherTypeLabel(input.voucher.type);
  const voucherMainLabel = formatVoucherMainLabel(input.voucher);
  const voucherMainFieldLabel = input.voucher.type === VoucherType.VALUE ? "Hodnota" : "Služba";
  const validUntilLabel = formatValidUntil(input.voucher.validUntil);
  const contactRows = [
    input.salon.name.trim(),
    input.salon.addressLine.trim(),
    input.salon.phone.trim(),
    input.salon.email.trim(),
    websiteDomain,
  ].filter((value) => value.length > 0);

  const salonName = input.salon.name.trim() || "PP Studio";
  const introLine = `v příloze zasíláme dárkový poukaz ${salonName}.`;
  const redemptionLine = "Poukaz můžete uplatnit při online rezervaci nebo osobně v salonu.";
  const verificationLeadLine = "Platnost poukazu si můžete ověřit zde:";
  const closingLine = "Těšíme se na Vaši návštěvu.";

  const text = [
    "Dobrý den,",
    "",
    introLine,
    "",
    `Typ poukazu: ${voucherTypeLabel}`,
    `${voucherMainFieldLabel}: ${voucherMainLabel}`,
    `Kód voucheru: ${input.voucher.code}`,
    `Platnost do: ${validUntilLabel}`,
    "",
    redemptionLine,
    verificationLeadLine,
    input.verificationUrl,
    "",
    closingLine,
    "",
    ...contactRows,
  ].join("\n");

  const html = await render(createElement(VoucherSentEmail, {
    brandName: salonName,
    voucherTypeLabel,
    voucherMainFieldLabel,
    voucherMainLabel,
    voucherCode: input.voucher.code,
    validUntilLabel,
    verificationUrl: input.verificationUrl,
    contactRows,
  }));

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
