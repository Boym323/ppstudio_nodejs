import { readFile } from "node:fs/promises";
import path from "node:path";

import { VoucherType } from "@/generated/prisma/browser";
import { defaultVoucherTemplateLayout } from "./voucher-template-defaults";
import { createVoucherTemplateRegistry, type VoucherTemplateDefinition, type VoucherTemplateRegistry } from "./voucher-template-registry";
export { createVoucherTemplateRegistry } from "./voucher-template-registry";
export { VoucherTemplateError } from "./voucher-template-error";
import { getActiveVoucherTemplatesForNewVouchers as getActiveFromRegistry, getVoucherTemplate as getFromRegistry, isVoucherTemplateAllowedForType as isAllowedFromRegistry } from "./voucher-template-registry";

export const classicVoucherTemplateFixture: VoucherTemplateDefinition = {
  key: "classic-v1",
  label: "Klasický",
  masterAssetKey: "classic-v1",
  previewPath: "src/features/vouchers/bootstrap-assets/classic-v1.pdf",
  activeForNewVouchers: true,
  allowedTypes: [VoucherType.VALUE, VoucherType.SERVICE],
  layout: defaultVoucherTemplateLayout,
};

export const voucherTemplateRegistry: VoucherTemplateRegistry = createVoucherTemplateRegistry([classicVoucherTemplateFixture]);

export function requireVoucherTemplate(key: string | null | undefined, registry = voucherTemplateRegistry) {
  return registry.require(key);
}

export function getVoucherTemplate(key: string | null | undefined, registry = voucherTemplateRegistry) {
  return getFromRegistry(key, registry);
}

export function getActiveVoucherTemplatesForNewVouchers(registry = voucherTemplateRegistry) {
  return getActiveFromRegistry(registry);
}

export function isVoucherTemplateAllowedForType(template: VoucherTemplateDefinition, type: VoucherType, registry = voucherTemplateRegistry) {
  return isAllowedFromRegistry(template, type, registry);
}

export function createTestVoucherTemplateRegistry(templates: readonly VoucherTemplateDefinition[]) {
  return createVoucherTemplateRegistry(templates);
}

export function getVoucherMasterAssetReader(assetKey: string) {
  if (assetKey !== "classic-v1") return undefined;
  return () => readFile(path.join(process.cwd(), "src", "features", "vouchers", "bootstrap-assets", "classic-v1.pdf"));
}
