import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentPath = new URL("./admin-voucher-stock-pages.tsx", import.meta.url);
const projectRoot = new URL("../../../../", import.meta.url);

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

test("voucherové tabs rozlišují OWNER a SALON a podporují Template Manager", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /active: "issued" \| "stock" \| "templates"/);
  assert.match(source, /href="\/admin\/vouchery\/sablony" className=\{tabClassName\(active === "templates"\)\}/);
  assert.match(source, /area === "owner" \? <Link href="\/admin\/vouchery\/sablony"/);
  assert.match(source, /area === "owner" \? "\/admin\/vouchery" : "\/admin\/provoz\/vouchery"/);
  assert.match(source, /active === "issued"/);
  assert.match(source, /active === "stock"/);
});

test("Template Manager stránky používají sdílené tabs a OWNER ochranu", async () => {
  const pages = await Promise.all([
    readFile(new URL("src/app/(admin)/admin/vouchery/sablony/page.tsx", projectRoot), "utf8"),
    readFile(new URL("src/app/(admin)/admin/vouchery/sablony/nova/page.tsx", projectRoot), "utf8"),
    readFile(new URL("src/app/(admin)/admin/vouchery/sablony/[templateId]/page.tsx", projectRoot), "utf8"),
  ]);

  for (const source of pages) {
    assert.match(source, /requireRole\(\[AdminRole\.OWNER\]\)/);
    assert.match(source, /<AdminVoucherTabs area="owner" active="templates" \/>/);
  }
});
