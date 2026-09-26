/** Vouchers issued before this rollout may need the compatibility fitter. */
export const STRICT_VOUCHER_RENDER_POLICY = "STRICT_V1" as const;
export type VoucherRenderPolicy = typeof STRICT_VOUCHER_RENDER_POLICY;

/** NULL is reserved for rows that predate persisted render policies. */
export function getPersistedVoucherRenderMode(voucher: { renderPolicy: string | null }): "STRICT" | "HISTORICAL" {
  if (voucher.renderPolicy === STRICT_VOUCHER_RENDER_POLICY) return "STRICT";
  if (voucher.renderPolicy === null) return "HISTORICAL";
  throw new Error(`Neznámá render policy voucheru: ${voucher.renderPolicy}`);
}
