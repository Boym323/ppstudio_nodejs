import assert from "node:assert/strict";
import test from "node:test";
import { withUtcPostgresTimezone } from "./postgres-utc";

test("UTC startup parametr zachová URL i původní options a má poslední slovo", () => {
  const url = new URL(withUtcPostgresTimezone("postgresql://user:password@localhost/db?schema=public&options=-c%20timezone%3DEurope%2FPrague%20-c%20statement_timeout%3D5000"));
  assert.equal(url.searchParams.get("schema"), "public");
  assert.equal(url.searchParams.get("options"), "-c timezone=Europe/Prague -c statement_timeout=5000 -c timezone=UTC");
  assert.equal(new URL(withUtcPostgresTimezone("postgresql://localhost/db")).searchParams.get("options"), "-c timezone=UTC");
});
