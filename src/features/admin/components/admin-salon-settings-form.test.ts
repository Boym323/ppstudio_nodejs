import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const formPath = new URL("./admin-salon-settings-form.tsx", import.meta.url);

test("veřejné fotografie v nastavení používají nezávislé MediaPickery s hidden fields", async () => {
  const source = await readFile(formPath, "utf8");

  assert.match(source, /<MediaPicker area="owner" enabled=\{pickerOpen\} scope=\{\{ type: "GENERAL", section: "SETTINGS" \}\}/);
  assert.match(source, /<input type="hidden" name=\{name\} value=\{value\} \/>/);
  assert.equal((source.match(/<PublicPhotoField name=/g) ?? []).length, 4);
  assert.match(source, /name="contactPhotoMediaId"[\s\S]*error=\{serverState\.fieldErrors\?\.contactPhotoMediaId\}/);
  assert.match(source, /name="homePortraitMediaId"[\s\S]*error=\{serverState\.fieldErrors\?\.homePortraitMediaId\}/);
  assert.match(source, /name="aboutPortraitMediaId"[\s\S]*error=\{serverState\.fieldErrors\?\.aboutPortraitMediaId\}/);
});

test("vybraná fotografie zobrazuje náhled, lze ji změnit nebo odebrat", async () => {
  const source = await readFile(formPath, "utf8");

  assert.match(source, /selectedAsset\.thumbnailPublicUrl \?\? selectedAsset\.publicUrl/);
  assert.match(source, /Vybrat jiné médium/);
  assert.match(source, /Odebrat fotografii/);
  assert.match(source, /setValue\(""\); setSelectedAsset\(null\)/);
  assert.match(source, /Portrét na úvodní stránce/);
  assert.match(source, /Portrét na stránce O mně/);
});

test("voucher logo používá lazy picker a zachovává textovou variantu", async () => {
  const source = await readFile(formPath, "utf8");
  assert.match(source, /name="voucherPdfLogoMediaId"/);
  assert.match(source, /emptyLabel="Textové logo PP Studio"/);
  assert.doesNotMatch(source, /publishedMediaOptions|<select/);
});

test("Settings neposílá kompletní seznam publikovaných médií", async () => {
  const loader = await readFile(new URL("../lib/admin-settings-page-data.ts", import.meta.url), "utf8");
  assert.doesNotMatch(loader, /listPublishedMedia|publishedMediaOptions/);
  assert.match(loader, /id: \{ in: selectedMediaIds \}/);
});
