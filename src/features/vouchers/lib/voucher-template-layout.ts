import { z } from "zod";

import { voucherFontRegistry } from "./voucher-font-registry";

export const VOUCHER_PRINT_GEOMETRY = { widthMm: 216, heightMm: 105, trimXmm: 3, trimYmm: 3, trimWidthMm: 210, trimHeightMm: 99 } as const;
const mm = z.number().finite().min(0).max(216);
const cmyk = z.object({ c: z.number().min(0).max(1), m: z.number().min(0).max(1), y: z.number().min(0).max(1), k: z.number().min(0).max(1) });
type VoucherAreaBounds = { xMm: number; yMm: number; widthMm: number; heightMm: number };
function isInsideTrim(area: VoucherAreaBounds) {
  const right = VOUCHER_PRINT_GEOMETRY.trimXmm + VOUCHER_PRINT_GEOMETRY.trimWidthMm;
  const top = VOUCHER_PRINT_GEOMETRY.trimYmm + VOUCHER_PRINT_GEOMETRY.trimHeightMm;
  return area.xMm >= VOUCHER_PRINT_GEOMETRY.trimXmm
    && area.yMm >= VOUCHER_PRINT_GEOMETRY.trimYmm
    && area.xMm + area.widthMm <= right
    && area.yMm + area.heightMm <= top;
}
const typography = z.object({
  fontFamilyKey: z.string().refine((key) => key in voucherFontRegistry, "Nepodporované písmo."),
  preferredFontSizePt: z.number().positive().max(144), minFontSizePt: z.number().positive().max(144),
  lineHeightMm: z.number().min(0).max(50), fontWeight: z.enum(["regular", "bold"]), alignment: z.enum(["left", "center"]), color: cmyk,
}).refine((v) => v.minFontSizePt <= v.preferredFontSizePt, "Minimální velikost písma nesmí být vyšší než preferovaná.");
const storedTextArea = z.object({ xMm: mm, yMm: mm, widthMm: z.number().positive().max(216), heightMm: z.number().positive().max(105), baselineMm: mm, maxLines: z.number().int().min(1).max(20), typography })
  .superRefine((area, ctx) => {
    if (area.xMm + area.widthMm > 216 || area.yMm + area.heightMm > 105 || area.baselineMm < area.yMm || area.baselineMm > area.yMm + area.heightMm) {
      ctx.addIssue({ code: "custom", message: "Textová oblast musí ležet na stránce a baseline uvnitř oblasti." });
    }
  });
const storedQrArea = z.object({ xMm: mm, yMm: mm, widthMm: z.number().positive().max(105), heightMm: z.number().positive().max(105) })
  .refine((a) => Math.abs(a.widthMm - a.heightMm) < 0.001 && a.xMm + a.widthMm <= 216 && a.yMm + a.heightMm <= 105, "QR musí být čtvercový a uvnitř stránky.");

export const voucherTemplateStoredLayoutSchema = z.object({
  printPage: z.object({ widthMm: z.literal(216), heightMm: z.literal(105) }),
  trim: z.object({ xMm: z.literal(3), yMm: z.literal(3), widthMm: z.literal(210), heightMm: z.literal(99) }),
  valueArea: storedTextArea, serviceArea: storedTextArea, validityArea: storedTextArea, codeArea: storedTextArea, qrArea: storedQrArea,
});

export const voucherTemplateLayoutSchema = voucherTemplateStoredLayoutSchema.superRefine((layout, ctx) => {
  for (const key of ["valueArea", "serviceArea", "validityArea", "codeArea"] as const) {
    if (!isInsideTrim(layout[key])) {
      ctx.addIssue({ code: "custom", path: [key], message: "Dynamický text musí zůstat uvnitř ořezové oblasti 210 × 99 mm." });
    }
  }

  if (!isInsideTrim(layout.qrArea)) {
    ctx.addIssue({ code: "custom", path: ["qrArea"], message: "QR musí zůstat uvnitř ořezové oblasti 210 × 99 mm." });
  }
});

export type VoucherTemplateLayoutV1 = z.infer<typeof voucherTemplateStoredLayoutSchema>;
export type VoucherTemplateTextAreaKey = "valueArea" | "serviceArea" | "validityArea" | "codeArea";
export type VoucherTemplateTypographyPatch = Partial<VoucherTemplateLayoutV1[VoucherTemplateTextAreaKey]["typography"]>;

export function isVoucherTemplateTextAreaKey(key: keyof VoucherTemplateLayoutV1): key is VoucherTemplateTextAreaKey {
  return key !== "printPage" && key !== "trim" && key !== "qrArea";
}

export function updateTypography(
  layout: VoucherTemplateLayoutV1,
  selected: VoucherTemplateTextAreaKey,
  patch: VoucherTemplateTypographyPatch,
): VoucherTemplateLayoutV1 {
  return {
    ...layout,
    [selected]: {
      ...layout[selected],
      typography: {
        ...layout[selected].typography,
        ...patch,
      },
    },
  };
}

export function pdfBottomToBrowserTop(yMm: number, heightMm: number) { return VOUCHER_PRINT_GEOMETRY.heightMm - yMm - heightMm; }
export function browserTopToPdfBottom(topMm: number, heightMm: number) { return VOUCHER_PRINT_GEOMETRY.heightMm - topMm - heightMm; }
