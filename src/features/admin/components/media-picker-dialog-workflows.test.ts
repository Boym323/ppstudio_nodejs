import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serviceSectionPath = new URL("./service-media-section.tsx", import.meta.url);
const referenceSectionPath = new URL("./reference-media-section.tsx", import.meta.url);

test("správa médií otevírá MediaPicker pro HERO a galerii v project Dialogu", async () => {
  const source = await readFile(serviceSectionPath, "utf8");
  assert.match(source, /import \* as Dialog from "@\/components\/ui\/dialog"/);
  assert.match(source, /"Vybrat fotografii"/);
  assert.match(source, /"Změnit fotografii"/);
  assert.match(source, />Přidat fotografii</);
  assert.match(source, /<Dialog\.Content className="max-w-5xl/);
  assert.equal((source.match(/<MediaPicker /g) ?? []).length, 2);
  assert.doesNotMatch(source, /<MediaPicker assets=\{assets\} value=\{heroId\} onSelect=\{setHeroId\}\/>\n\s*<form/);
});

test("správa referencí otevírá MediaPicker v Dialogu a zachová vybrané médium", async () => {
  const source = await readFile(referenceSectionPath, "utf8");
  assert.match(source, /import \* as Dialog from '@\/components\/ui\/dialog'/);
  assert.match(source, />Přidat referenci</);
  assert.match(source, /<Dialog\.Content className="max-w-5xl/);
  assert.match(source, /name="mediaAssetId" value=\{selectedId\}/);
  assert.equal((source.match(/<MediaPicker /g) ?? []).length, 1);
});

test("References nevykreslují druhý inline picker", async () => {
  const adminPage = await readFile(new URL("./admin-media-page.tsx", import.meta.url), "utf8");
  assert.match(adminPage, /category !== MediaCollectionType\.REFERENCES/);
});

test("References nenačítají celý seznam a používají serverový scope", async () => {
  const adminPage = await readFile(new URL("./admin-media-page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(adminPage, /listPublishedMedia|referencePickerAssets/);
  const referenceSection = await readFile(referenceSectionPath, "utf8");
  assert.match(referenceSection, /Tato kolekce je zatím prázdná/);
  assert.match(referenceSection, /Přidat z knihovny médií/);
  assert.doesNotMatch(referenceSection, /Přidat z Media Library/);
});

test("picker References předává autoritativní serverový scope", async () => {
  const source = await readFile(referenceSectionPath, "utf8");
  assert.match(source, /enabled=\{pickerOpen\} scope=\{\{ type: 'REFERENCES' \}\}/);
});

test("service editor neposílá kompletní assets payload", async () => {
  const [page, loader] = await Promise.all([
    readFile(new URL("./admin-services-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-services.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /assets=\{data\.mediaAssets\}/);
  assert.doesNotMatch(loader, /mediaAssets:/);
  assert.match(serviceSectionPath.pathname ? await readFile(serviceSectionPath, "utf8") : "", /scope=\{\{ type: 'SERVICE_GALLERY', serviceId \}\}/);
});
