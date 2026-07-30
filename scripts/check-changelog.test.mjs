import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const script = resolve("scripts/check-changelog.mjs");
const validChangelog = "# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "ppstudio-changelog-"));
  execFileSync("git", ["init", "-q"], { cwd: directory });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: directory });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: directory });
  writeFileSync(join(directory, "CHANGELOG.md"), validChangelog);
  writeFileSync(join(directory, "README.md"), "# Test\n");
  execFileSync("git", ["add", "."], { cwd: directory });
  execFileSync("git", ["commit", "-qm", "Základ"], { cwd: directory });
  return directory;
}

function run(directory, args = ["--base", "HEAD"]) {
  try {
    return { output: execFileSync(process.execPath, [script, ...args], { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), status: 0 };
  } catch (error) {
    return { output: `${error.stdout}\n${error.stderr}`, status: error.status };
  }
}

function withFixture(callback) {
  const directory = fixture();
  try { callback(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

test("produkční změna s changelogem projde", () => withFixture((directory) => {
  writeFileSync(join(directory, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n\n### Opraveno\n- Opraveno chování.\n\n## [1.0.0] - 2026-01-01\n");
  mkdirSync(join(directory, "src"));
  writeFileSync(join(directory, "src", "feature.ts"), "export const value = 1;\n");
  assert.equal(run(directory).status, 0);
}));

test("produkční změna bez changelogu selže a výjimka vyžaduje důvod", () => withFixture((directory) => {
  execFileSync("mkdir", ["-p", "src"], { cwd: directory });
  writeFileSync(join(directory, "src", "feature.ts"), "export const value = 1;\n");
  assert.equal(run(directory).status, 1);
  assert.equal(run(directory, ["--base", "HEAD", "--skip-reason", "Interní refaktor bez runtime dopadu"]).status, 1);
  assert.equal(run(directory, ["--base", "HEAD", "--skip-reason", "Důvod pro skip-changelog: Interní refaktor bez runtime dopadu"]).status, 0);
}));

test("dokumentační a testovací změny bez changelogu projdou", () => withFixture((directory) => {
  writeFileSync(join(directory, "README.md"), "# Upravená dokumentace\n");
  execFileSync("mkdir", ["-p", "tests"], { cwd: directory });
  writeFileSync(join(directory, "tests", "feature.spec.ts"), "export {};\n");
  assert.equal(run(directory).status, 0);
}));

test("Prisma migrace bez changelogu selže", () => withFixture((directory) => {
  execFileSync("mkdir", ["-p", "prisma/migrations/20260101000000_test"], { cwd: directory });
  writeFileSync(join(directory, "prisma/migrations/20260101000000_test/migration.sql"), "SELECT 1;\n");
  assert.equal(run(directory).status, 1);
}));

test("neplatná struktura a base vracejí srozumitelnou chybu", () => withFixture((directory) => {
  writeFileSync(join(directory, "CHANGELOG.md"), "# Changelog\n\n## [1.0.0] - 2026-01-01\n");
  assert.match(run(directory).output, /Unreleased/);
  writeFileSync(join(directory, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n\n### Opraveno\n\n## [1.0.0] - 2026-01-01\n");
  assert.match(run(directory).output, /nesmí být prázdná/);
  writeFileSync(join(directory, "CHANGELOG.md"), validChangelog);
  assert.match(run(directory, ["--base", "neexistuje"]).output, /Neplatný základ/);
}));

test("duplicitní Unreleased selže", () => withFixture((directory) => {
  writeFileSync(join(directory, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n");
  assert.match(run(directory).output, /právě jednu sekci/);
}));
