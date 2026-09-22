import path from "node:path";

export type VoucherFontFamily = {
  key: string;
  label: string;
  regularPath: string;
  boldPath: string;
  fallbackPath?: string;
};

const fontRoot = path.join(process.cwd(), "node_modules", "@fontsource", "noto-sans", "files");

/** Trusted server-side font catalogue. Fonts are deliberately not admin-uploadable. */
export const voucherFontRegistry: Readonly<Record<string, VoucherFontFamily>> = {
  "noto-sans": {
    key: "noto-sans",
    label: "Noto Sans",
    regularPath: path.join(fontRoot, "noto-sans-latin-400-normal.woff"),
    boldPath: path.join(fontRoot, "noto-sans-latin-700-normal.woff"),
    fallbackPath: path.join(fontRoot, "noto-sans-latin-ext-400-normal.woff"),
  },
};

export function requireVoucherFontFamily(key: string) {
  const font = voucherFontRegistry[key];
  if (!font) throw new VoucherFontRegistryError();
  return font;
}

export class VoucherFontRegistryError extends Error {
  constructor() {
    super("Vybrané písmo voucheru není podporované.");
    this.name = "VoucherFontRegistryError";
  }
}
