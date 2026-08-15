import assert from "node:assert/strict";
import test from "node:test";

import { getTrustedClientIp } from "./trusted-client-ip";

test("trusted client IP přijímá jen validní samostatné X-Real-IP", () => {
  assert.equal(getTrustedClientIp(new Headers({ "x-real-ip": "203.0.113.5" })), "203.0.113.5");
  assert.equal(getTrustedClientIp(new Headers({ "x-real-ip": "2001:db8::1" })), "2001:db8::1");
  assert.equal(getTrustedClientIp(new Headers({ "x-real-ip": "203.0.113.5, 198.51.100.7" })), undefined);
  assert.equal(getTrustedClientIp(new Headers({ "x-real-ip": "not-an-ip" })), undefined);
});

test("trusted client IP nikdy nepřebírá X-Forwarded-For", () => {
  assert.equal(
    getTrustedClientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 198.51.100.7" })),
    undefined,
  );
});
