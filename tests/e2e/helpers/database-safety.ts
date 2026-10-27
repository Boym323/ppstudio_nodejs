import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { isGitHubActionsPostgresServiceDatabase } from "@/test/ci-postgres-service";

type DatabaseIdentity = {
  database: string;
  schema: string;
  serverAddress: string | null;
  serverPort: number | null;
};

function isLoopback(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
}

function isApprovedDatabase(database: string, schema: string, target: URL) {
  if (schema !== "public" || process.env.NODE_ENV === "production") return false;
  if (database === "ppstudio_dev") return true;
  if (database === "ppstudio" && process.env.CI === "true") {
    return isLoopback(target.hostname) || isGitHubActionsPostgresServiceDatabase(target, {
      CI: process.env.CI,
      GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
      GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
    });
  }
  return database.endsWith("_test") && isLoopback(target.hostname);
}

export async function assertE2eDatabaseIdentity() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("E2E odmítlo DB operaci: DATABASE_URL není nastavené.");

  let target: URL;
  try {
    target = new URL(connectionString);
  } catch {
    throw new Error("E2E odmítlo DB operaci: DATABASE_URL není platná PostgreSQL URL.");
  }

  const expectedDatabase = decodeURIComponent(target.pathname.slice(1));
  const expectedSchema = target.searchParams.get("schema") ?? "public";
  if (!isApprovedDatabase(expectedDatabase, expectedSchema, target)) {
    throw new Error(
      `E2E odmítlo DB operaci pro host=${target.hostname}, database=${expectedDatabase}, schema=${expectedSchema}, NODE_ENV=${process.env.NODE_ENV ?? "(unset)"}.`,
    );
  }

  const [identity] = await prisma.$queryRaw<DatabaseIdentity[]>`
    SELECT current_database() AS database,
      current_schema() AS schema,
      inet_server_addr()::text AS "serverAddress",
      inet_server_port() AS "serverPort"
  `;

  if (!identity
    || identity.database !== expectedDatabase
    || identity.schema !== expectedSchema) {
    throw new Error(
      `E2E odmítlo DB operaci: cílová a připojená DB se liší (URL=${expectedDatabase}/${expectedSchema}, server=${identity?.database ?? "(unknown)"}/${identity?.schema ?? "(unknown)"}).`,
    );
  }

  return {
    database: identity.database,
    schema: identity.schema,
    serverAddress: identity.serverAddress,
    serverPort: identity.serverPort,
  };
}
