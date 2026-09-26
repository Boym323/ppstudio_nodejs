import assert from "node:assert/strict";
import test from "node:test";

import { getPersistedVoucherRenderMode, STRICT_VOUCHER_RENDER_POLICY } from "./voucher-render-policy";
import { createVoucherSchema } from "@/features/vouchers/schemas/voucher-schemas";
import { VoucherType } from "@/generated/prisma/browser";

test("explicitní strict policy zůstává STRICT bez ohledu na issuedAt nebo šablonu", () => {
  assert.equal(getPersistedVoucherRenderMode({ renderPolicy: STRICT_VOUCHER_RENDER_POLICY }), "STRICT");
  assert.equal(getPersistedVoucherRenderMode({ renderPolicy: STRICT_VOUCHER_RENDER_POLICY }), "STRICT");
});

test("voucher bez markeru je jednoznačně legacy a historický", () => {
  assert.equal(getPersistedVoucherRenderMode({ renderPolicy: null }), "HISTORICAL");
});

test("neznámá policy selže uzavřeně", () => {
  assert.throws(() => getPersistedVoucherRenderMode({ renderPolicy: "UNKNOWN" }), /Neznámá render policy/);
});

test("PRINT, DIGITAL i e-mail vycházejí z persisted shared resolveru", async () => {
  const core = await (await import("node:fs/promises")).readFile("src/features/vouchers/lib/voucher-pdf-core.ts", "utf8");
  assert.equal((core.match(/getPersistedVoucherRenderMode\(voucher\)/g) ?? []).length, 2);
  assert.match(core, /generatePersistedVoucherDigitalPdf/);
  assert.match(core, /generatePersistedVoucherPrintPdf/);
  assert.doesNotMatch(core, /STRICT_VOUCHER_RENDER_CUTOFF/);
});

test("každá produkční issuance cesta ukládá explicitní STRICT_V1 marker", async () => {
  const fs = await import("node:fs/promises");
  const [management, stock] = await Promise.all([
    fs.readFile("src/features/vouchers/lib/voucher-management.ts", "utf8"),
    fs.readFile("src/features/vouchers/lib/voucher-stock.ts", "utf8"),
  ]);
  assert.equal((management.match(/renderPolicy: STRICT_VOUCHER_RENDER_POLICY/g) ?? []).length, 2);
  assert.equal((stock.match(/renderPolicy: STRICT_VOUCHER_RENDER_POLICY/g) ?? []).length, 2);
});

test("klientský create payload nemůže nastavit ani přepsat policy", () => {
  const parsed = createVoucherSchema.parse({
    type: VoucherType.VALUE,
    templateKey: "classic-v1",
    originalValueCzk: 1500,
    renderPolicy: null,
  });
  assert.equal("renderPolicy" in parsed, false);
});
