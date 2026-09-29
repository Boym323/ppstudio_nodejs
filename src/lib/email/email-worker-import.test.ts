import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("dependency graph e-mailového workeru se načte v obyčejném Node/tsx runtime", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/check-email-worker-imports.ts"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ordinary Node\/tsx runtime/);
});
