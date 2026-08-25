import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover";
import { prisma } from "@/lib/prisma";

const DB_UNAVAILABLE_ERROR_CODE = "DATABASE_UNAVAILABLE";
const DB_FAILURE_ALERT_COOLDOWN_MS = 10 * 60 * 1000;

type PublicHealthRouteDependencies = {
  checkDatabase: () => Promise<unknown>;
  notifySystemError: typeof sendOwnerSystemErrorPushover;
  now: () => Date;
  claimDbFailureAlert: (nowMs: number) => boolean;
};

export function createDbFailureAlertCooldown(
  cooldownMs = DB_FAILURE_ALERT_COOLDOWN_MS,
) {
  let lastAlertAtMs: number | null = null;

  return (nowMs: number) => {
    if (lastAlertAtMs !== null && nowMs - lastAlertAtMs < cooldownMs) {
      return false;
    }

    lastAlertAtMs = nowMs;
    return true;
  };
}

const claimDbFailureAlert = createDbFailureAlertCooldown();

export function createPublicHealthRouteApi(
  overrides: Partial<PublicHealthRouteDependencies> = {},
) {
  const dependencies: PublicHealthRouteDependencies = {
    checkDatabase: () => prisma.$queryRaw`SELECT 1`,
    notifySystemError: sendOwnerSystemErrorPushover,
    now: () => new Date(),
    claimDbFailureAlert,
    ...overrides,
  };

  return {
    GET: async () => {
      try {
        await dependencies.checkDatabase();
      } catch {
        const nowMs = dependencies.now().getTime();

        if (dependencies.claimDbFailureAlert(nowMs)) {
          void dependencies
            .notifySystemError({
              title: "PP Studio - systemova chyba",
              message: "Health endpoint zjistil nedostupnou databazi.",
              context: { contextId: "health-db-check" },
            })
            .catch((notificationError) => {
              console.error("Health DB failure Pushover dispatch failed", {
                notificationError,
              });
            });
        }

        return Response.json(
          {
            status: "error",
            error: { code: DB_UNAVAILABLE_ERROR_CODE },
          },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      }

      return Response.json(
        { status: "ok" },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    },
  };
}
