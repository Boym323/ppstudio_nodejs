import assert from "node:assert/strict";
import test from "node:test";

import { getSafeAdminRedirectPath } from "./admin-redirect";

const fallback = "/admin";

test("povolí očekávané interní admin cesty včetně query", () => {
  assert.equal(getSafeAdminRedirectPath("/admin", fallback), "/admin");
  assert.equal(getSafeAdminRedirectPath("/admin/provoz/sluzby?serviceId=1", fallback), "/admin/provoz/sluzby?serviceId=1");
});

test("odmítne externí a nečekané redirect cíle", () => {
  for (const value of [
    "//host/admin",
    "/\\host/admin",
    "https://example.com/admin",
    "javascript:alert(1)",
    "/rezervace",
    "/administer",
    "/admin%2f%2fevil",
  ]) {
    assert.equal(getSafeAdminRedirectPath(value, fallback), fallback, value);
  }
});

test("při chybějícím cíli použije fallback", () => {
  assert.equal(getSafeAdminRedirectPath(undefined, fallback), fallback);
  assert.equal(getSafeAdminRedirectPath("", fallback), fallback);
});
