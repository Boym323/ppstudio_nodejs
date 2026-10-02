import "dotenv/config";

import { prisma } from "@/lib/prisma";

// Tento import musí fungovat bez Next.js resolver conditions i testovacích shimů.
import "@/lib/email/worker";

console.info("Email worker imports loaded in an ordinary Node/tsx runtime.");

async function main() {
  try {
    await prisma.$disconnect();
  } catch (error: unknown) {
    console.error("Email worker import check could not close Prisma", error);
    process.exitCode = 1;
  }
}

void main();
