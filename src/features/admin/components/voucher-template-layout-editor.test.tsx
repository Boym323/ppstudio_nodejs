import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { defaultVoucherTemplateLayout } from "@/features/vouchers/lib/voucher-template-defaults";

test("panel editoru zobrazuje pozici od horního levého rohu ořezu a odděluje technická pole", async (t) => {
  t.mock.module("@/features/admin/actions/voucher-template-actions", { exports: { saveVoucherTemplateLayoutAction: async () => {} } });
  const { VoucherTemplateLayoutEditor } = await import("./voucher-template-layout-editor");
  const original = structuredClone(defaultVoucherTemplateLayout);
  const html = renderToStaticMarkup(<VoucherTemplateLayoutEditor templateId="test" initialLayout={original} initialUpdatedAt="2026-10-06T10:00:00Z" />);

  const positionSection = html.match(/<section[^>]*><h4[^>]*>Pozice a rozměry<\/h4>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(positionSection);
  assert.match(positionSection, /X \[mm\]<input type="text" inputMode="decimal"[^>]*value="15"/);
  assert.match(positionSection, /Y \[mm\]<input type="text" inputMode="decimal"[^>]*value="53"/);
  assert.match(positionSection, /Šířka \[mm\]/);
  assert.match(positionSection, /Výška \[mm\]/);
  assert.match(positionSection, /Na střed vodorovně/);
  assert.match(positionSection, /Na střed svisle/);
  assert.match(positionSection, /Šipky: 0,1 mm · Shift \+ šipky: 1 mm/);
  assert.match(positionSection, /X 15,0 mm · Y 53,0 mm/);
  assert.doesNotMatch(positionSection, /Baseline|Min\. velikost|Řádkování|PDF souřadnice/);
  assert.match(html, /<details[^>]*><summary[^>]*>Pokročilé nastavení[\s\S]*?Baseline \(mm\)[\s\S]*?Min\. velikost \(pt\)[\s\S]*?Řádkování \(mm\)[\s\S]*?<\/details>/);
  for (const overlay of ["bleed", "trim", "safe", "guides"]) assert.match(html, new RegExp(`data-overlay="${overlay}"`));
  assert.deepEqual(original, defaultVoucherTemplateLayout, "zobrazení UI nesmí přepsat uložený layout");
});
