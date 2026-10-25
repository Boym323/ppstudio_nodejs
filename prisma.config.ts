import "dotenv/config";
import { defineConfig } from "prisma/config";

import { withUtcPostgresTimezone } from "./src/lib/postgres-utc";

export function buildPrismaDatasourceConfig(
  databaseUrl: string | undefined,
  shadowDatabaseUrl: string | undefined,
) {
  return {
    url: databaseUrl ? withUtcPostgresTimezone(databaseUrl) : "",
    shadowDatabaseUrl: shadowDatabaseUrl ? withUtcPostgresTimezone(shadowDatabaseUrl) : undefined,
  };
}

const datasource = buildPrismaDatasourceConfig(
  process.env.DATABASE_URL,
  process.env.SHADOW_DATABASE_URL,
);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource,
});
