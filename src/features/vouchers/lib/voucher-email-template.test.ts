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

test("buildVoucherEmailTemplate creates VALUE voucher email with safe details", async () => {
  const template = await buildVoucherEmailTemplate(buildBaseInput(VoucherType.VALUE));

  assert.equal(template.subject, "Dárkový poukaz PP Studio");
  assert.match(template.text, /Typ poukazu: Hodnotový poukaz/);
  assert.match(template.text, /Hodnota: 1\s500/);
  assert.match(template.text, /Kód voucheru: PP-2026-ZFUJ8U/);
  assert.match(template.text, /Platnost do:/);
  assert.match(template.text, /vouchery\/overeni\?code=PP-2026-ZFUJ8U/);
  assert.match(template.html, /vouchery\/overeni\?code=PP-2026-ZFUJ8U/);
  assert.match(template.text, /^Dobrý den,\n\nv příloze zasíláme dárkový poukaz PP Studio\./m);
  assert.match(template.text, /ppstudio\.cz/);
  assert.doesNotMatch(template.text, /internalNote/i);
});

test("buildVoucherEmailTemplate creates SERVICE voucher email with service snapshot", async () => {
  const template = await buildVoucherEmailTemplate(buildBaseInput(VoucherType.SERVICE));

  assert.match(template.text, /Typ poukazu: Poukaz na službu/);
  assert.match(template.text, /Služba: Lash lifting/);
  assert.match(template.text, /Kód voucheru: PP-2026-ZFUJ8U/);
  assert.match(template.text, /vouchery\/overeni\?code=PP-2026-ZFUJ8U/);
  assert.match(template.html, /Lash lifting/);
  assert.match(template.html, /vouchery\/overeni\?code=PP-2026-ZFUJ8U/);
  assert.doesNotMatch(template.text, /postupně čerpat/i);
});

test("buildVoucherEmailTemplate attaches PDF with expected metadata", async () => {
  const template = await buildVoucherEmailTemplate(buildBaseInput(VoucherType.VALUE));

  assert.equal(template.attachments.length, 1);
  assert.equal(template.attachments[0]?.filename, "voucher-PP-2026-ZFUJ8U.pdf");
  assert.equal(template.attachments[0]?.contentType, "application/pdf");
  assert.equal(template.attachments[0]?.content.toString("utf8"), "%PDF-1.7");
});

test("buildVoucherEmailTemplate uses provided salon contact and keeps PDF attachment", async () => {
  const template = await buildVoucherEmailTemplate({
    ...buildBaseInput(VoucherType.VALUE),
    salon: {
      name: "Salon U Lípy",
      addressLine: "Náměstí 1, 760 01 Zlín",
      phone: "+420 777 111 222",
      email: "recepce@example.cz",
    },
  });

  assert.match(template.text, /dárkový poukaz Salon U Lípy/);
  assert.match(template.text, /Náměstí 1, 760 01 Zlín/);
  assert.match(template.html, /Salon U Lípy/);
  assert.match(template.html, /recepce@example\.cz/);
  assert.equal(template.attachments[0]?.contentType, "application/pdf");
});

test("buildVoucherEmailTemplate escapes dynamic voucher content in React Email HTML", async () => {
  const template = await buildVoucherEmailTemplate({
    ...buildBaseInput(VoucherType.SERVICE),
    voucher: {
      ...buildBaseInput(VoucherType.SERVICE).voucher,
      serviceNameSnapshot: '<script>alert("xss")</script>',
    },
    salon: {
      name: '<img src=x onerror="alert(1)"> PP Studio',
      addressLine: '<script>alert("address")</script> Sadová 2',
      phone: '+420 700 000 000"><img src=x onerror="alert(2)',
      email: 'info@example.test"><img src=x onerror="alert(3)',
    },
    verificationUrl:
      'https://example.test/vouchery/overeni?code=fake-token&next=" onmouseover="alert(1)',
  });

  assert.match(template.text, /<script>alert\("xss"\)<\/script>/);
  assert.match(template.html, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(template.html, /<script>alert\("xss"\)<\/script>/);
  assert.match(template.html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; PP Studio/);
  assert.match(template.html, /&lt;script&gt;alert\(&quot;address&quot;\)&lt;\/script&gt; Sadová 2/);
  assert.doesNotMatch(template.html, /<img src=x onerror=/);
  assert.match(template.html, /code=fake-token&amp;next=&quot; onmouseover=&quot;alert\(1\)/);
  assert.doesNotMatch(template.html, /href="[^"]*"\s+onmouseover=/);
});
