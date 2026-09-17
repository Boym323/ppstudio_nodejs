import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("neplatná kombinace template/type vrací jednoznačnou field error", async () => {
  const source = await readFile(new URL("./voucher-actions.ts", import.meta.url), "utf8");

  assert.match(source, /templateKey:\s*"Vyberte vzhled dostupný pro tento typ voucheru\."/);
  assert.doesNotMatch(source, /templateKey:\s*activeTemplates\[0\]\?\.label/);
});
