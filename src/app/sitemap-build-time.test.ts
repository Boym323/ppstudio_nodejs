import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "../..");

test("sitemap odloží čtení služeb až na HTTP požadavek", async () => {
  const source = await readFile(path.join(projectRoot, "src/app/sitemap.ts"), "utf8");
  const connectionIndex = source.indexOf("await connection();");
  const servicesReadIndex = source.indexOf("await getPublicServiceSitemapEntries()");

  assert.match(source, /import \{ connection \} from "next\/server";/);
  assert.ok(connectionIndex >= 0, "sitemap must wait for an incoming request");
  assert.ok(servicesReadIndex >= 0, "sitemap must read dynamic service entries");
  assert.ok(
    connectionIndex < servicesReadIndex,
    "sitemap must defer the Prisma service read until after connection()",
  );
  assert.doesNotMatch(source, /export const revalidate\s*=/, "request-time sitemap must not declare ISR");
});
