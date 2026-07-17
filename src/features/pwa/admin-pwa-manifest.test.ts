import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

type ManifestAsset = {
  src: string;
  sizes: string;
};

const projectRoot = process.cwd();

async function assertAssetSize(asset: ManifestAsset) {
  const [width, height] = asset.sizes.split("x").map(Number);
  const metadata = await sharp(path.join(projectRoot, "public", asset.src)).metadata();

  assert.equal(metadata.width, width, `${asset.src} má neočekávanou šířku`);
  assert.equal(metadata.height, height, `${asset.src} má neočekávanou výšku`);
}

test("admin manifest má start URL ve scope a odkazuje na existující PWA assety", async () => {
  const rawManifest = await readFile(path.join(projectRoot, "public/admin.webmanifest"), "utf8");
  const manifest = JSON.parse(rawManifest) as {
    id: string;
    start_url: string;
    scope: string;
    icons: ManifestAsset[];
    screenshots: ManifestAsset[];
    shortcuts: Array<{ url: string; icons: ManifestAsset[] }>;
  };

  assert.equal(manifest.id, "/admin/");
  assert.equal(manifest.start_url, "/admin/");
  assert.equal(manifest.scope, "/admin/");
  assert.equal(new URL(manifest.start_url, "https://ppstudio.test").pathname.startsWith(manifest.scope), true);

  await Promise.all([
    ...manifest.icons.map(assertAssetSize),
    ...manifest.screenshots.map(assertAssetSize),
    ...manifest.shortcuts.flatMap((shortcut) => shortcut.icons).map(assertAssetSize),
  ]);

  assert.deepEqual(manifest.shortcuts.map((shortcut) => shortcut.url), [
    "/admin/rezervace",
    "/admin/volne-terminy",
    "/admin/statistiky",
  ]);
});
