import test from "node:test";
import assert from "node:assert/strict";

import { getAdminBasePath, getAdminSectionPath } from "./admin-paths";

test("getAdminBasePath vraci root cesty podle admin area", () => {
  assert.equal(getAdminBasePath("owner"), "/admin");
  assert.equal(getAdminBasePath("salon"), "/admin/provoz");
});

test("getAdminSectionPath sklada sdilene sekce konzistentne", () => {
  assert.equal(getAdminSectionPath("owner", "rezervace"), "/admin/rezervace");
  assert.equal(getAdminSectionPath("salon", "rezervace"), "/admin/provoz/rezervace");
  assert.equal(getAdminSectionPath("owner", "volne-terminy"), "/admin/volne-terminy");
  assert.equal(getAdminSectionPath("salon", "volne-terminy"), "/admin/provoz/volne-terminy");
});
