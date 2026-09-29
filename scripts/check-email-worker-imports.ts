import "dotenv/config";

import { prisma } from "@/lib/prisma";

// Tento import musí fungovat bez Next.js resolver conditions i testovacích shimů.
import "@/lib/email/worker";

console.info("Email worker imports loaded in an ordinary Node/tsx runtime.");
void prisma.$disconnect().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error("Email worker import check could not close Prisma", error);
    process.exit(1);
  },
);
