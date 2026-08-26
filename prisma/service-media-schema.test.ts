import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ServiceMedia má role, deterministické pořadí a restriktivní FK", async () => {
  const migration = await readFile(new URL("./migrations/20260825190000_service_media/migration.sql", import.meta.url), "utf8");

  assert.match(migration, /ServiceMedia_one_hero_per_service[\s\S]*WHERE "role" = 'HERO'/);
  assert.match(migration, /ServiceMedia_serviceId_role_mediaAssetId_key/);
  assert.match(migration, /ServiceMedia_serviceId_role_sortOrder_key/);
  assert.match(migration, /ServiceMedia_mediaAssetId_fkey[\s\S]*ON DELETE RESTRICT/);
});
