import { VoucherType } from "@/generated/prisma/browser";

import { type VoucherMasterAssetKey } from "./voucher-master-assets";

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
  printPage: {
    widthMm: number;
    heightMm: number;
  };
  trim: {
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
  };
  valueArea: VoucherTemplateTextArea;
  serviceArea: VoucherTemplateTextArea;
  validityArea: VoucherTemplateTextArea;
  codeArea: VoucherTemplateTextArea;
  qrArea: {
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
  };
};

export type VoucherTemplateDefinition = {
  key: string;
  label: string;
  masterAssetKey: VoucherMasterAssetKey;
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

export class VoucherTemplateError extends Error {
  readonly code: "unknown_template" | "invalid_master_page_size";

  constructor(
    readonly templateKey: string | null | undefined,
    options: {
      code?: "unknown_template" | "invalid_master_page_size";
      message?: string;
    } = {},
  ) {
    super(options.message ?? `Voucher template "${templateKey ?? ""}" is not registered.`);
    this.code = options.code ?? "unknown_template";
    this.name = "VoucherTemplateError";
  }
}

const classicV1: VoucherTemplateDefinition = {
  key: "classic-v1",
  label: "Klasický",
  masterAssetKey: "classic-v1",
  previewPath: "public/brand/vouchers/classic-v1-preview.png",
  activeForNewVouchers: true,
  allowedTypes: [VoucherType.VALUE, VoucherType.SERVICE],
  layout: {
    printPage: { widthMm: 216, heightMm: 105 },
    trim: { xMm: 3, yMm: 3, widthMm: 210, heightMm: 99 },
    valueArea: {
      xMm: 18,
      yMm: 39,
      widthMm: 130,
      heightMm: 8,
      baselineMm: 41.2,
      maxLines: 1,
      typography: {
        preferredFontSizePt: 16.5,
        minFontSizePt: 16.5,
        lineHeightMm: 5.1,
        fontWeight: "bold",
        alignment: "center",
      },
    },
    serviceArea: {
      xMm: 18,
      yMm: 39,
      widthMm: 130,
      heightMm: 11,
      baselineMm: 41.2,
      maxLines: 2,
      typography: {
        preferredFontSizePt: 14.5,
        minFontSizePt: 8.5,
        lineHeightMm: 5.1,
        fontWeight: "bold",
        alignment: "center",
      },
    },
    validityArea: {
      xMm: 18,
      yMm: 16,
      widthMm: 52.5,
      heightMm: 8,
      baselineMm: 18.35,
      maxLines: 1,
      typography: {
        preferredFontSizePt: 7.5,
        minFontSizePt: 5.8,
        lineHeightMm: 0,
        fontWeight: "regular",
        alignment: "center",
      },
    },
    codeArea: {
      xMm: 81,
      yMm: 16,
      widthMm: 67,
      heightMm: 8,
      baselineMm: 18.35,
      maxLines: 1,
      typography: {
        preferredFontSizePt: 7.4,
        minFontSizePt: 5.8,
        lineHeightMm: 0,
        fontWeight: "bold",
        alignment: "center",
      },
    },
    qrArea: { xMm: 173.7, yMm: 20, widthMm: 28, heightMm: 28 },
  },
};

export function createVoucherTemplateRegistry(templates: readonly VoucherTemplateDefinition[]): VoucherTemplateRegistry {
  const registeredTemplates = [...templates];

  return {
    templates: registeredTemplates,
    get: (key) => registeredTemplates.find((template) => template.key === key),
    require: (key) => {
      const template = registeredTemplates.find((item) => item.key === key);

      if (!template) {
        throw new VoucherTemplateError(key);
      }

      return template;
    },
    getActiveForNewVouchers: () => registeredTemplates.filter((template) => template.activeForNewVouchers),
    isAllowedForType: (template, type) => template.allowedTypes.includes(type),
  };
}

export const voucherTemplateRegistry = createVoucherTemplateRegistry([classicV1]);

export function getVoucherTemplate(
  key: string | null | undefined,
  registry: VoucherTemplateRegistry = voucherTemplateRegistry,
) {
  return registry.get(key);
}

export function requireVoucherTemplate(
  key: string | null | undefined,
  registry: VoucherTemplateRegistry = voucherTemplateRegistry,
) {
  return registry.require(key);
}

export function isVoucherTemplateKey(
  key: string | null | undefined,
  registry: VoucherTemplateRegistry = voucherTemplateRegistry,
): key is string {
  return Boolean(registry.get(key));
}

export function getActiveVoucherTemplatesForNewVouchers(registry: VoucherTemplateRegistry = voucherTemplateRegistry) {
  return registry.getActiveForNewVouchers();
}

export function isVoucherTemplateAllowedForType(
  template: VoucherTemplateDefinition,
  type: VoucherType,
  registry: VoucherTemplateRegistry = voucherTemplateRegistry,
) {
  return registry.isAllowedForType(template, type);
}
