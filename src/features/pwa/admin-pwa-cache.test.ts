import assert from "node:assert/strict";
import test from "node:test";

import { isSafePwaAsset, shouldBypassPwaCache, shouldHandleAdminNavigation } from "./admin-pwa-cache";

test("admin PWA povoluje pouze statické build assety a PWA ikony", () => {
  assert.equal(isSafePwaAsset("/_next/static/chunks/app.js"), true);
  assert.equal(isSafePwaAsset("/pwa/admin-512.png"), true);
  assert.equal(isSafePwaAsset("/pwa/other-file.json"), false);
  assert.equal(isSafePwaAsset("/admin/rezervace"), false);
  assert.equal(isSafePwaAsset("/api/admin/bookings"), false);
});

test("admin navigace zahrnuje pouze admin cestu a její potomky", () => {
  assert.equal(shouldHandleAdminNavigation("/admin"), true);
  assert.equal(shouldHandleAdminNavigation("/admin/provoz/rezervace"), true);
  assert.equal(shouldHandleAdminNavigation("/rezervace"), false);
  assert.equal(shouldHandleAdminNavigation("/administrator"), false);
});

test("data a HTML jsou z PWA cache vždy vynechány", () => {
  assert.equal(shouldBypassPwaCache("/api/admin/clients/search"), true);
  assert.equal(shouldBypassPwaCache("/admin/klienti"), true);
  assert.equal(shouldBypassPwaCache("/admin/vouchery"), true);
  assert.equal(shouldBypassPwaCache("/admin/rezervace"), true);
  assert.equal(shouldBypassPwaCache("/admin/platby"), true);
  assert.equal(shouldBypassPwaCache("/rezervace"), true);
  assert.equal(shouldBypassPwaCache("/_next/static/chunks/app.js"), false);
});
