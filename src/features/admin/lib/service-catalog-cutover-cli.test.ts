import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("cutover CLI lze načíst v běžném Node runtime bez server-only shimu", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/service-catalog-cutover-2026-10-01.ts"], {
      cwd: process.cwd(),
    }),
    (error: { stderr?: string }) => {
      assert.match(error.stderr ?? "", /Použití:/);
      assert.doesNotMatch(error.stderr ?? "", /server-only/);
      return true;
    },
  );
});
