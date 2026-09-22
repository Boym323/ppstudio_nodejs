import { VoucherType } from "@/generated/prisma/browser";

export { VoucherTemplateError } from "./voucher-template-error";

export type VoucherTemplateTextArea = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  baselineMm: number;
  maxLines: number;
  typography: {
    preferredFontSizePt: number;
    minFontSizePt: number;
    lineHeightMm: number;
    fontWeight: "regular" | "bold";
    alignment: "left" | "center";
  };
};

export type VoucherTemplateLayout = {
  printPage: { widthMm: number; heightMm: number };
  trim: { xMm: number; yMm: number; widthMm: number; heightMm: number };
  valueArea: VoucherTemplateTextArea;
  serviceArea: VoucherTemplateTextArea;
  validityArea: VoucherTemplateTextArea;
  codeArea: VoucherTemplateTextArea;
  qrArea: { xMm: number; yMm: number; widthMm: number; heightMm: number };
};

export type VoucherTemplateDefinition = {
  key: string;
  label: string;
  masterAssetKey: string;
  previewPath: string;
  activeForNewVouchers: boolean;
  allowedTypes: readonly VoucherType[];
  layout: VoucherTemplateLayout;
};

export type VoucherTemplateRegistry = Readonly<{
  templates: readonly VoucherTemplateDefinition[];
  get: (key: string | null | undefined) => VoucherTemplateDefinition | undefined;
  require: (key: string | null | undefined) => VoucherTemplateDefinition;
  getActiveForNewVouchers: () => readonly VoucherTemplateDefinition[];
  isAllowedForType: (template: VoucherTemplateDefinition, type: VoucherType) => boolean;
}>;

export function createVoucherTemplateRegistry(templates: readonly VoucherTemplateDefinition[]): VoucherTemplateRegistry {
  const registeredTemplates = [...templates];
  return {
    templates: registeredTemplates,
    get: (key) => registeredTemplates.find((template) => template.key === key),
    require: (key) => {
      const template = registeredTemplates.find((item) => item.key === key);
      if (!template) throw new Error(`Voucher template "${key ?? ""}" is not registered.`);
      return template;
    },
    getActiveForNewVouchers: () => registeredTemplates.filter((template) => template.activeForNewVouchers),
    isAllowedForType: (template, type) => template.allowedTypes.includes(type),
  };
}

export function getVoucherTemplate(key: string | null | undefined, registry: VoucherTemplateRegistry) {
  return registry.get(key);
}

export function requireVoucherTemplate(key: string | null | undefined, registry: VoucherTemplateRegistry) {
  return registry.require(key);
}

export function isVoucherTemplateKey(key: string | null | undefined, registry: VoucherTemplateRegistry): key is string {
  return Boolean(registry.get(key));
}

export function getActiveVoucherTemplatesForNewVouchers(registry: VoucherTemplateRegistry) {
  return registry.getActiveForNewVouchers();
}

export function isVoucherTemplateAllowedForType(template: VoucherTemplateDefinition, type: VoucherType, registry: VoucherTemplateRegistry) {
  return registry.isAllowedForType(template, type);
}
