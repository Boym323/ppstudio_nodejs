import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin formulář popisuje cenu služby jako pevnou cenu", async () => {
  const source = await readFile(new URL("./admin-service-form.tsx", import.meta.url), "utf8");

  assert.match(source, /label="Cena \(Kč\)"/);
  assert.match(source, /Pevná cena služby/);
  assert.doesNotMatch(source, /label="Cena od \(Kč\)"/);
  assert.doesNotMatch(source, /Nejnižší cena/);
});
