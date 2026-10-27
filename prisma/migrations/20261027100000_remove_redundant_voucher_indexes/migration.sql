-- Remove non-unique indexes covered by the corresponding unique indexes.
DROP INDEX "Voucher_code_idx";

DROP INDEX "VoucherStockItem_code_idx";

DROP INDEX "VoucherStockItem_voucherId_idx";
