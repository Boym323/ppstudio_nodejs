import assert from "node:assert/strict";
import test from "node:test";
import { buildPrismaDatasourceConfig } from "../../prisma.config";
import { withUtcPostgresTimezone } from "./postgres-utc";

test("UTC startup parametr zachová URL i původní options a má poslední slovo", () => {
  const url = new URL(withUtcPostgresTimezone("postgresql://user:password@localhost/db?schema=public&options=-c%20timezone%3DEurope%2FPrague%20-c%20statement_timeout%3D5000"));
  assert.equal(url.searchParams.get("schema"), "public");
  assert.equal(url.searchParams.get("options"), "-c timezone=Europe/Prague -c statement_timeout=5000 -c timezone=UTC");
  assert.equal(new URL(withUtcPostgresTimezone("postgresql://localhost/db")).searchParams.get("options"), "-c timezone=UTC");
});

test("Prisma CLI vynutí UTC pro aplikační i shadow databázi", () => {
  const config = buildPrismaDatasourceConfig(
    "postgresql://app:secret@localhost/production?schema=public",
    "postgresql://app:secret@localhost/shadow?options=-c%20timezone%3DEurope%2FPrague",
  );

  assert.equal(new URL(config.url).searchParams.get("options"), "-c timezone=UTC");
  assert.equal(new URL(config.shadowDatabaseUrl!).searchParams.get("options"), "-c timezone=Europe/Prague -c timezone=UTC");
  assert.equal(buildPrismaDatasourceConfig(undefined, undefined).url, "");
  assert.equal(buildPrismaDatasourceConfig(undefined, undefined).shadowDatabaseUrl, undefined);
});
