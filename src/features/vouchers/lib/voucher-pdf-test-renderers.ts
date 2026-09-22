import { getVoucherMasterAssetReader, requireVoucherTemplate, voucherTemplateRegistry } from "./voucher-template-test-registry";
import { VoucherTemplateError } from "./voucher-template-error";
import {
  generateResolvedVoucherBatchPrintPdf,
  generateResolvedVoucherDigitalPdf,
  generateResolvedVoucherPrintPdf,
  mm,
} from "./voucher-pdf-core";
import type { ResolvedVoucherTemplate } from "./voucher-template-repository";

export * from "./voucher-pdf-core";

type TestVoucher = Parameters<typeof generateResolvedVoucherPrintPdf>[0];

function resolveTemplate(key: string | null | undefined, registry = voucherTemplateRegistry) {
  const definition = requireVoucherTemplate(key, registry);
  const reader = getVoucherMasterAssetReader(definition.masterAssetKey);
  if (!reader) throw new VoucherTemplateError(definition.key, { message: `Voucher template "${definition.key}" has no test master asset.` });
  return reader().then((masterBytes): ResolvedVoucherTemplate => ({ id: definition.key, key: definition.key, status: "PUBLISHED", allowedTypes: [...definition.allowedTypes], label: definition.label, layout: definition.layout as ResolvedVoucherTemplate["layout"], masterSha256: "test", masterBytes }));
}

export async function generateVoucherPrintPdf(voucher: TestVoucher, options: { registry?: typeof voucherTemplateRegistry } = {}) {
  return generateResolvedVoucherPrintPdf(voucher, await resolveTemplate(voucher.templateKey, options.registry));
}

export async function generateVoucherDigitalPdf(voucher: TestVoucher, options: { registry?: typeof voucherTemplateRegistry } = {}) {
  return generateResolvedVoucherDigitalPdf(voucher, await resolveTemplate(voucher.templateKey, options.registry));
}

export async function generateVoucherStockPrintPage(stockItem: { templateKey: string; code: string }) {
  const template = await resolveTemplate(stockItem.templateKey);
  return generateResolvedVoucherBatchPrintPdf({ batchNumber: "test", items: [{ code: stockItem.code }] }, template);
}

export async function generateVoucherBatchPrintPdf(batch: { batchNumber: string; templateKey: string; items: readonly { code: string }[] }) {
  return generateResolvedVoucherBatchPrintPdf(batch, await resolveTemplate(batch.templateKey));
}

export function getVoucherPrintPageBoxes(templateKey = "classic-v1") {
  const layout = requireVoucherTemplate(templateKey).layout;
  return {
    media: { x: 0, y: 0, width: mm(layout.printPage.widthMm), height: mm(layout.printPage.heightMm) },
    bleed: { x: 0, y: 0, width: mm(layout.printPage.widthMm), height: mm(layout.printPage.heightMm) },
    trim: { x: mm(layout.trim.xMm), y: mm(layout.trim.yMm), width: mm(layout.trim.widthMm), height: mm(layout.trim.heightMm) },
  };
}
