import assert from "node:assert/strict";
import test from "node:test";

import { isGitHubActionsPostgresServiceDatabase } from "./ci-postgres-service";

const trustedEnv = {
  CI: "true",
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "Boym323/ppstudio_nodejs",
} as const;

const url = "postgresql://postgres:postgres@postgres:5432/ppstudio?schema=public";

test("CI PostgreSQL service is allowed only for the expected Actions repository and DB", () => {
  assert.equal(isGitHubActionsPostgresServiceDatabase(new URL(url), trustedEnv), true);

  for (const env of [
    { ...trustedEnv, CI: "false" },
    { ...trustedEnv, GITHUB_ACTIONS: "false" },
    { ...trustedEnv, GITHUB_REPOSITORY: "untrusted/fork" },
  ]) {
    assert.equal(isGitHubActionsPostgresServiceDatabase(new URL(url), env), false);
  }
});

test("CI PostgreSQL service rejects other hosts, databases, schemas, ports and users", () => {
  const invalidUrls = [
    "postgresql://postgres:postgres@postgres.example.com:5432/ppstudio?schema=public",
    "postgresql://postgres:postgres@db.internal:5432/ppstudio?schema=public",
    "postgresql://postgres:postgres@postgres:5432/production?schema=public",
    "postgresql://postgres:postgres@postgres:5432/ppstudio?schema=private",
    "postgresql://postgres:postgres@postgres:5433/ppstudio?schema=public",
    "postgresql://admin:postgres@postgres:5432/ppstudio?schema=public",
  ];

  for (const candidate of invalidUrls) {
    assert.equal(
      isGitHubActionsPostgresServiceDatabase(new URL(candidate), trustedEnv),
      false,
      candidate,
    );
  }
});
