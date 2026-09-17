import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentPath = new URL("./admin-voucher-stock-pages.tsx", import.meta.url);

test("detail série nabízí batch PDF jen pro PENDING_PRINT", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /data\.area === "owner" && canDownloadVoucherStockPdf\(data\.status\)/);
  assert.match(source, /voucherStockPdfUnavailableMessage/);
});

test("activation success používá pro službu částku ze service snapshotu", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /const amountDue = isValueVoucher \? state\.originalValueCzk : state\.servicePriceSnapshotCzk/);
  assert.match(source, /servicePriceSnapshotCzk\?: number \| null/);
  assert.match(source, />K ÚHRADĚ<\/dt>/);
});
