import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("neplatná kombinace template/type vrací jednoznačnou field error", async () => {
  const source = await readFile(new URL("./voucher-actions.ts", import.meta.url), "utf8");

  assert.match(source, /templateKey:\s*"Vyberte vzhled dostupný pro tento typ voucheru\."/);
  assert.doesNotMatch(source, /templateKey:\s*activeTemplates\[0\]\?\.label/);
});

test("bezpečná operational chyba při vytvoření voucheru neobsahuje Prisma detail", async () => {
  const source = await readFile(new URL("./voucher-actions.ts", import.meta.url), "utf8");

  assert.match(source, /case voucherManagementErrorCodes\.operationFailed:/);
  assert.match(source, /Voucher se teď nepodařilo vytvořit\. Zkuste to prosím znovu\./);
  assert.doesNotMatch(source, /operationFailed:[\s\S]{0,200}P2028/);
});
