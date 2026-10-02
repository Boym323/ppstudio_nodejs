import { spawn } from "node:child_process";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function assertTestDatabase() {
  if (process.env.NODE_ENV === "production") {
    fail("DB integration tests nelze spustit v produkčním runtime.");
  }
  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL je pro DB integration tests povinné.");
  }

  const host = new URL(process.env.DATABASE_URL).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    fail(`DB integration tests vyžadují izolovanou lokální DB, ne host ${host}.`);
  }
}

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} skončil signálem ${signal}.`));
      else if (code !== 0) reject(new Error(`${command} skončil kódem ${code}.`));
      else resolve();
    });
  });
}

assertTestDatabase();

try {
  await run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "ci:prepare-voucher-fixtures"], {
    ...process.env,
    PPSTUDIO_INTEGRATION_FIXTURES: "1",
  });
  await run(process.execPath, [
    "--import", "./src/test/register-server-only.mjs",
    "--import", "tsx",
    "--test", "--test-concurrency=1", "src/**/*.integration.test.ts",
  ], {
    ...process.env,
    RUN_DB_INTEGRATION_TESTS: "1",
  });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
