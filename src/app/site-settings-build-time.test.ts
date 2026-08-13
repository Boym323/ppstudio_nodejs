import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "../..");

async function readSource(relativePath: string) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

test("SiteSettings reads are deferred until a request in all build-time layouts", async () => {
  const files = [
    "src/app/layout.tsx",
    "src/app/(public)/layout.tsx",
    "src/app/(booking)/layout.tsx",
  ];

  for (const file of files) {
    const source = await readSource(file);
    const connectionIndex = source.indexOf("await connection();");
    const siteSettingsReadIndex = source.indexOf("await getPublicSalonProfile()");

    assert.match(source, /import \{ connection \} from "next\/server";/);
    assert.ok(connectionIndex >= 0, `${file} must wait for an incoming request`);
    assert.ok(siteSettingsReadIndex >= 0, `${file} must read SiteSettings`);
    assert.ok(
      connectionIndex < siteSettingsReadIndex,
      `${file} must defer SiteSettings until after connection()`,
    );
  }
});
