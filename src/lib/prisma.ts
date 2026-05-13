import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";

import { env } from "@/config/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const adapter = new PrismaPg(env.DATABASE_URL);
  const logLevels: Prisma.LogLevel[] =
    process.env.NODE_ENV === "development"
      ? ["warn", "error"]
      : process.env.NODE_ENV === "production"
        ? ["error"]
        : [];

  return new PrismaClient({
    adapter,
    log: logLevels,
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
