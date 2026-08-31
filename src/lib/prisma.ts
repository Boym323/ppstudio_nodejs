import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

import { env } from "@/config/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Next dev drží Prisma singleton přes HMR v globalThis. Po přidání modelu se
 * tak může zachovat instance vytvořená starším vygenerovaným klientem, která
 * nový delegate vůbec nemá. Takovou instanci nelze bezpečně znovu použít.
 */
function hasRequiredDelegates(client: PrismaClient) {
  const candidate = client as PrismaClient & {
    adminUserAuditEvent?: unknown;
    voucherChangeLog?: unknown;
    serviceChangeLog?: unknown;
    siteSettingsChangeLog?: unknown;
    emailProviderWebhookEvent?: unknown;
    mediaCollectionItem?: unknown;
    serviceMedia?: unknown;
  };

  return Boolean(
    candidate.adminUserAuditEvent
    && candidate.voucherChangeLog
    && candidate.serviceChangeLog
    && candidate.siteSettingsChangeLog
    && candidate.emailProviderWebhookEvent
    && candidate.mediaCollectionItem
    && candidate.serviceMedia,
  );
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // Každý integrační testovací soubor běží v samostatném procesu. Bez této
    // volby drží idle klienti event loop aktivní až do vypršení timeoutu poolu.
    allowExitOnIdle: process.env.RUN_DB_INTEGRATION_TESTS === "1",
  });
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

export const prisma = globalForPrisma.prisma && hasRequiredDelegates(globalForPrisma.prisma)
  ? globalForPrisma.prisma
  : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
