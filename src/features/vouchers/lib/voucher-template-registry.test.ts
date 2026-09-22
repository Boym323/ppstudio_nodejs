import { access } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { VoucherType } from "@/generated/prisma/browser";

import {
  createVoucherTemplateRegistry,
  getActiveVoucherTemplatesForNewVouchers,
  getVoucherTemplate,
  isVoucherTemplateAllowedForType,
  requireVoucherTemplate,
  voucherTemplateRegistry,
} from "./voucher-template-test-registry";
import { getVoucherMasterAssetReader } from "./voucher-template-test-registry";

test("registry obsahuje classic-v1 s českým názvem a oběma typy", () => {
  const template = requireVoucherTemplate("classic-v1");

  assert.equal(template.label, "Klasický");
  assert.equal(template.masterAssetKey, "classic-v1");
  assert.deepEqual(template.allowedTypes, [VoucherType.VALUE, VoucherType.SERVICE]);
  assert.equal(template.activeForNewVouchers, true);
  assert.equal(isVoucherTemplateAllowedForType(template, VoucherType.VALUE), true);
  assert.equal(isVoucherTemplateAllowedForType(template, VoucherType.SERVICE), true);
});

test("registry a trusted asset map mají dostupný master i preview pro všechny templates", async () => {
  for (const template of voucherTemplateRegistry.templates) {
    const reader = getVoucherMasterAssetReader(template.masterAssetKey);
    assert.ok(reader, `missing master asset reader for ${template.masterAssetKey}`);
    assert.equal((await reader!()).subarray(0, 4).toString("utf8"), "%PDF");
    await access(path.join(process.cwd(), template.previewPath));
  }

  assert.equal(getVoucherMasterAssetReader("unknown-template"), undefined);
  assert.equal(getVoucherMasterAssetReader("../../etc/passwd"), undefined);
});

test("registry odmítá neplatný key a vrací aktivní templates", () => {
  assert.equal(getVoucherTemplate("missing-template"), undefined);
  assert.deepEqual(
    getActiveVoucherTemplatesForNewVouchers().map((template) => template.key),
    ["classic-v1"],
  );
});

test("test-only registry umí aktivní i historickou template bez produkčního assetu", () => {
  const classic = requireVoucherTemplate("classic-v1");
  const registry = createVoucherTemplateRegistry([
    classic,
    {
      ...classic,
      key: "test-template-v1",
      label: "Testovací",
      allowedTypes: [VoucherType.SERVICE],
      layout: {
        ...classic.layout,
        validityArea: { ...classic.layout.validityArea, xMm: 24, baselineMm: 20 },
        qrArea: { ...classic.layout.qrArea, xMm: 160, yMm: 12, widthMm: 20, heightMm: 20 },
      },
    },
    {
      ...classic,
      key: "test-template-inactive-v1",
      label: "Historická testovací",
      activeForNewVouchers: false,
    },
  ]);

  assert.deepEqual(
    getActiveVoucherTemplatesForNewVouchers(registry).map((template) => template.key),
    ["classic-v1", "test-template-v1"],
  );
  assert.equal(isVoucherTemplateAllowedForType(registry.require("test-template-v1"), VoucherType.SERVICE, registry), true);
  assert.equal(isVoucherTemplateAllowedForType(registry.require("test-template-v1"), VoucherType.VALUE, registry), false);
  assert.equal(registry.require("test-template-inactive-v1").activeForNewVouchers, false);
});
