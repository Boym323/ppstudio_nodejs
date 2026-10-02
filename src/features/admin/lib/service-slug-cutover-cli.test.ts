import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("slugový cutover CLI lze načíst v běžném Node runtime bez server-only shimu", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/service-slug-cutover-2026-10-02.ts"], {
      cwd: process.cwd(),
    }),
    (error: { stderr?: string }) => {
      assert.match(error.stderr ?? "", /Použití:/);
      assert.doesNotMatch(error.stderr ?? "", /server-only/);
      return true;
    },
  );
});
