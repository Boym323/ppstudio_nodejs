import { readFile } from "node:fs/promises";
import path from "node:path";

export type VoucherMasterAssetKey = "classic-v1";

type VoucherMasterAssetReader = () => Promise<Buffer>;

const voucherMasterAssetReaders: Readonly<Record<VoucherMasterAssetKey, VoucherMasterAssetReader>> = {
  "classic-v1": () => readFile(path.join(process.cwd(), "public", "brand", "vouchers", "classic-v1.pdf")),
};

export function getVoucherMasterAssetReader(assetKey: string) {
  return (voucherMasterAssetReaders as Readonly<Record<string, VoucherMasterAssetReader | undefined>>)[assetKey];
}
