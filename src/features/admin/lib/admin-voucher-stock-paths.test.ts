import assert from "node:assert/strict";
import test from "node:test";

import { VoucherPrintBatchStatus } from "@/generated/prisma/browser";

import { canDownloadVoucherStockPdf, voucherStockPdfUnavailableMessage } from "./admin-voucher-stock-paths";

test("batch PDF je dostupné pouze ve stavu PENDING_PRINT", () => {
  assert.equal(canDownloadVoucherStockPdf(VoucherPrintBatchStatus.PENDING_PRINT), true);
  assert.equal(canDownloadVoucherStockPdf(VoucherPrintBatchStatus.RECEIVED), false);
  assert.equal(canDownloadVoucherStockPdf(VoucherPrintBatchStatus.CLOSED), false);
  assert.match(voucherStockPdfUnavailableMessage, /po převzetí série dostupné/);
});
