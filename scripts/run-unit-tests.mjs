import { readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = join(process.cwd(), "src");
const coverage = process.argv.includes("--coverage");

async function findUnitTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findUnitTests(path));
    } else if (
      /\.test\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".integration.test.ts")
    ) {
      files.push(relative(process.cwd(), path));
    }
  }

  return files;
}

const files = (await findUnitTests(root)).sort();
if (files.length === 0) {
  console.error("Nebyly nalezeny žádné unit testy.");
  process.exit(1);
}

if (coverage) {
  await rm("coverage", { recursive: true, force: true });
  await rm(".nyc_output", { recursive: true, force: true });
}

const command = coverage ? "c8" : process.execPath;
const args = coverage
  ? [process.execPath, "--import", "./src/test/register-server-only.mjs", "--import", "tsx", "--test", ...files]
  : ["--import", "./src/test/register-server-only.mjs", "--import", "tsx", "--test", ...files];
const result = spawnSync(command, args, { stdio: "inherit" });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
