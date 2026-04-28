import assert from "node:assert/strict";
import test from "node:test";

import { VoucherType } from "@prisma/client";

import { buildVoucherEmailTemplate } from "@/features/vouchers/lib/voucher-email-template";

function buildBaseInput(type: VoucherType) {
  return {
    subject: "Dárkový poukaz PP Studio",
    voucher: {
      type,
      code: "PP-2026-ZFUJ8U",
      validUntil: new Date("2027-04-28T10:00:00.000Z"),
      originalValueCzk: type === VoucherType.VALUE ? 1500 : null,
      remainingValueCzk: type === VoucherType.VALUE ? 1500 : null,
      serviceNameSnapshot: type === VoucherType.SERVICE ? "Lash lifting" : null,
      servicePriceSnapshotCzk: type === VoucherType.SERVICE ? 1200 : null,
    },
    salon: {
      name: "PP Studio",
      addressLine: "Sadová 2, 760 01 Zlín",
      phone: "+420 732 856 036",
      email: "info@ppstudio.cz",
    },
    verificationUrl: "https://ppstudio.cz/vouchery/overeni?code=PP-2026-ZFUJ8U",
    pdfFilename: "voucher-PP-2026-ZFUJ8U.pdf",
    pdfBytes: Buffer.from("%PDF-1.7"),
  } as const;
}

test("buildVoucherEmailTemplate creates VALUE voucher email with safe details", () => {
  const template = buildVoucherEmailTemplate(buildBaseInput(VoucherType.VALUE));

  assert.equal(template.subject, "Dárkový poukaz PP Studio");
  assert.match(template.text, /Typ poukazu: Hodnotový poukaz/);
  assert.match(template.text, /Hodnota: 1\s500/);
  assert.match(template.text, /Kód voucheru: PP-2026-ZFUJ8U/);
  assert.match(template.text, /Platnost do:/);
  assert.match(template.text, /vouchery\/overeni\?code=PP-2026-ZFUJ8U/);
  assert.match(template.text, /^Dobrý den,\n\nv příloze zasíláme dárkový poukaz PP Studio\./m);
  assert.match(template.text, /ppstudio\.cz/);
  assert.doesNotMatch(template.text, /internalNote/i);
});

test("buildVoucherEmailTemplate creates SERVICE voucher email with service snapshot", () => {
  const template = buildVoucherEmailTemplate(buildBaseInput(VoucherType.SERVICE));

  assert.match(template.text, /Typ poukazu: Poukaz na službu/);
  assert.match(template.text, /Služba: Lash lifting/);
  assert.match(template.text, /Kód voucheru: PP-2026-ZFUJ8U/);
  assert.match(template.text, /vouchery\/overeni\?code=PP-2026-ZFUJ8U/);
  assert.doesNotMatch(template.text, /postupně čerpat/i);
});

test("buildVoucherEmailTemplate attaches PDF with expected metadata", () => {
  const template = buildVoucherEmailTemplate(buildBaseInput(VoucherType.VALUE));

  assert.equal(template.attachments.length, 1);
  assert.equal(template.attachments[0]?.filename, "voucher-PP-2026-ZFUJ8U.pdf");
  assert.equal(template.attachments[0]?.contentType, "application/pdf");
  assert.equal(template.attachments[0]?.content.toString("utf8"), "%PDF-1.7");
});
