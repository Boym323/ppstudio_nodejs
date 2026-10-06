import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";

import { preflightVoucherTemplateMaster } from "@/features/vouchers/lib/voucher-template-preflight";
import { voucherTemplateUploadErrorMessage } from "./voucher-template-upload-error";

test("chyby skutečného preflightu vysvětlují rozměry, tiskový profil a export PDF/X-4", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([100, 100]);
  const result = await preflightVoucherTemplateMaster(Buffer.from(await pdf.save()));
  const messages = result.errors.map(voucherTemplateUploadErrorMessage);

  assert.ok(messages.some((message) => message.includes("210 × 99 mm se spadávkou 3 mm")));
  assert.ok(messages.some((message) => message.includes("tiskový profil")));
  assert.ok(messages.some((message) => message.includes("V Affinity zvolte export PDF/X-4")));
});

test("vícestránková grafika dostane srozumitelnou chybu", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  pdf.addPage();
  const result = await preflightVoucherTemplateMaster(Buffer.from(await pdf.save()));
  assert.ok(result.errors.map(voucherTemplateUploadErrorMessage).includes("PDF musí obsahovat právě jednu stránku s grafikou voucheru."));
});

test("ostatní chyby se zachovají bez ztráty přesnosti", () => {
  for (const message of ["PDF má nepodporovanou rotaci 180°. Použijte rotaci 0°.", "PDF je zašifrované; tiskové PDF nesmí být šifrované.", "Šablona se během nahrávání změnila; akci opakujte.", "Nová neznámá chyba."]) {
    assert.equal(voucherTemplateUploadErrorMessage(message), message);
  }
});
