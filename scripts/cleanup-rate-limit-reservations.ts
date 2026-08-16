import "dotenv/config";

import { prisma } from "@/lib/prisma";

async function main() {
  const deleted = await prisma.$executeRaw`
    DELETE FROM "RateLimitReservation"
    WHERE "id" IN (
      SELECT "id"
      FROM "RateLimitReservation"
      WHERE "expiresAt" <= NOW()
      ORDER BY "expiresAt"
      LIMIT 10000
    )
  `;

  console.log(`Odstraněno expirovaných rate-limit rezervací: ${deleted}`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error("Úklid rate-limit rezervací selhal", error);
    process.exitCode = 1;
  });
