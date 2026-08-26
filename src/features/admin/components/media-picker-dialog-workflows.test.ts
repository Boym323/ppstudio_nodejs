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

test("správa referencí otevírá MediaPicker v Dialogu a zachová ID assetu", async () => {
  const source = await readFile(referenceSectionPath, "utf8");
  assert.match(source, /import \* as Dialog from '@\/components\/ui\/dialog'/);
  assert.match(source, />Přidat referenci</);
  assert.match(source, /<Dialog\.Content className="max-w-5xl/);
  assert.match(source, /name="mediaAssetId" value=\{selectedId\}/);
  assert.equal((source.match(/<MediaPicker /g) ?? []).length, 1);
});
