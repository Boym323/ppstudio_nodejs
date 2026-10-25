import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { withUtcPostgresTimezone } from "./postgres-utc";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

for (const timezone of ["UTC", "Europe/Prague"]) {
  dbTest(`Prisma pool vynutí UTC přes výchozí ${timezone}: Prisma, raw SQL a DEFAULT`, async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Pouze izolovaná lokální DB");
    url.searchParams.set("options", `-c timezone=${timezone}`);
    const baseline = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
    const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: withUtcPostgresTimezone(url.toString()), max: 3 }) });
    const ids = [randomUUID(), randomUUID()];
    try {
      const [setting] = await baseline.$queryRawUnsafe<Array<{ timezone: string }>>("SELECT current_setting('TimeZone') AS timezone");
      assert.equal(setting.timezone, timezone);
      const connections = await Promise.all([0, 1, 2].map(() => client.$transaction(async (tx) => {
        const [row] = await tx.$queryRawUnsafe<Array<{ timezone: string; pid: number }>>("SELECT current_setting('TimeZone') AS timezone, pg_backend_pid() AS pid");
        await tx.$queryRawUnsafe("SELECT pg_sleep(0.1)::text");
        return row;
      })));
      assert.equal(new Set(connections.map((row) => row.pid)).size, 3);
      assert.ok(connections.every((row) => row.timezone === "UTC"));
      const before = Date.now();
      const appointment = new Date("2026-10-26T05:00:00.000Z");
      const user = await client.adminUser.create({ data: { id: ids[0], email: `${ids[0]}@example.test`, name: "UTC Prisma fixture", role: "OWNER", lastLoginAt: appointment } });
      assert.equal(user.lastLoginAt?.toISOString(), appointment.toISOString());
      assert.ok(Math.abs(user.createdAt.getTime() - before) < 5000);
      await client.$executeRaw`INSERT INTO "AdminUser" (id, email, name, role, "updatedAt", "lastLoginAt") VALUES (${ids[1]}, ${`${ids[1]}@example.test`}, 'UTC raw fixture', 'OWNER', CURRENT_TIMESTAMP, ${appointment})`;
      const raw = await client.adminUser.findUniqueOrThrow({ where: { id: ids[1] } });
      assert.equal(raw.lastLoginAt?.toISOString(), appointment.toISOString());
      assert.ok(Math.abs(raw.createdAt.getTime() - before) < 5000, "DEFAULT CURRENT_TIMESTAMP nesmí uložit lokální pražský čas");
      const [stored] = await client.$queryRaw<Array<{ stamp: string }>>`SELECT to_char("lastLoginAt", 'YYYY-MM-DD HH24:MI:SS') AS stamp FROM "AdminUser" WHERE id = ${ids[0]}`;
      assert.equal(stored.stamp, "2026-10-26 05:00:00");
      console.log(JSON.stringify({ timezone, poolTimezone: connections.map((row) => row.timezone), appointment: raw.lastLoginAt?.toISOString() }));
    } finally {
      await client.adminUser.deleteMany({ where: { id: { in: ids } } });
      await Promise.all([client.$disconnect(), baseline.$disconnect()]);
    }
  });
}
