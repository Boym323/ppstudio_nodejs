import { VoucherType } from "@/generated/prisma/client";
import { PDFDocument } from "pdf-lib";

import {
  generateResolvedVoucherBatchPrintPdf,
  generateResolvedVoucherDigitalPdf,
  generateResolvedVoucherPrintPdf,
} from "./voucher-pdf-core";
import { preflightFinalVoucherPrint, preflightVoucherTemplateMaster } from "./voucher-template-preflight";
import { type ResolvedVoucherTemplate } from "./voucher-template-repository";

export async function preflightVoucherTemplateForPublish(template: ResolvedVoucherTemplate) {
  const master = await preflightVoucherTemplateMaster(template.masterBytes);
  if (master.errors.length) return { ok: false, errors: master.errors };
  const scenarios: Array<{ type: VoucherType; serviceName?: string }> = [];
  if (template.allowedTypes.includes(VoucherType.VALUE)) scenarios.push({ type: VoucherType.VALUE });
  if (template.allowedTypes.includes(VoucherType.SERVICE)) scenarios.push({ type: VoucherType.SERVICE, serviceName: "Korejský Lash lifting" }, { type: VoucherType.SERVICE, serviceName: "Velmi dlouhý název služby s českou diakritikou pro ověření zalomení a minimální velikosti písma" });
  const errors: string[] = [];
  for (const scenario of scenarios) {
    const voucher = { templateId: template.id, templateKey: template.key, code: "TEST-2026-ABCDEF", type: scenario.type, originalValueCzk: scenario.type === VoucherType.VALUE ? 1500 : 1500, remainingValueCzk: scenario.type === VoucherType.VALUE ? 1500 : null, serviceNameSnapshot: scenario.serviceName ?? null, servicePriceSnapshotCzk: scenario.type === VoucherType.SERVICE ? 1500 : null, validUntil: new Date("2027-12-31T22:59:59.999Z") } as Parameters<typeof generateResolvedVoucherPrintPdf>[0];
    const print = await preflightFinalVoucherPrint(await generateResolvedVoucherPrintPdf(voucher, template));
    const digitalPdf = await PDFDocument.load(await generateResolvedVoucherDigitalPdf(voucher, template));
    const digitalPage = digitalPdf.getPage(0);
    if (print.errors.length || !print.geometryValid) errors.push(...print.errors, "Finální PRINT nemá očekávanou geometrii.");
    const digitalSize = digitalPage.getSize();
    if (digitalPdf.getPageCount() !== 1 || Math.abs(digitalSize.width - 210 * 72 / 25.4) > 1 || Math.abs(digitalSize.height - 99 * 72 / 25.4) > 1) errors.push("Finální DIGITAL nemá očekávanou geometrii.");
  }
  const stock = await preflightFinalVoucherPrint(await generateResolvedVoucherBatchPrintPdf({ batchNumber: "TEST-001", items: [{ code: "TEST-2026-ABCDEF" }] }, template));
  if (stock.errors.length || !stock.geometryValid) errors.push(...stock.errors, "Finální STOCK nemá očekávanou geometrii.");
  return { ok: errors.length === 0, errors };
}
