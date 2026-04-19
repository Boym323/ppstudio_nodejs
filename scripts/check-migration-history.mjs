import "dotenv/config";
import { Client } from "pg";

function exitWithError(message, details) {
  console.error(message);

  if (details) {
    console.error(details);
  }

  process.exit(1);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    exitWithError("DATABASE_URL není nastavené. Nelze ověřit historii migrací.");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    const openMigrations = await client.query(
      `SELECT migration_name, started_at
       FROM "_prisma_migrations"
       WHERE finished_at IS NULL
         AND rolled_back_at IS NULL
       ORDER BY started_at ASC`,
    );

    if (openMigrations.rowCount && openMigrations.rowCount > 0) {
      const lines = openMigrations.rows
        .map((row) => `- ${row.migration_name} (started_at: ${row.started_at.toISOString()})`)
        .join("\n");

      exitWithError(
        "V _prisma_migrations jsou otevřené (failed/incomplete) migrace. Nejprve je srovnej přes `prisma migrate resolve`.",
        lines,
      );
    }

    const rolledBackMigrations = await client.query(
      `SELECT migration_name, started_at
       FROM "_prisma_migrations"
       WHERE rolled_back_at IS NOT NULL
       ORDER BY started_at DESC
       LIMIT 20`,
    );

    if (rolledBackMigrations.rowCount && rolledBackMigrations.rowCount > 0) {
      console.warn("Pozor: v historii jsou rolled back migrace. Ověř, že odpovídají očekávanému recover postupu.");
      for (const row of rolledBackMigrations.rows) {
        console.warn(`- ${row.migration_name} (started_at: ${row.started_at.toISOString()})`);
      }
    }

    console.log("Migration history check: OK");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  exitWithError("Migration history check selhal.", error instanceof Error ? error.stack : String(error));
});
