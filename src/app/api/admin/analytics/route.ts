import { AdminRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { getDashboardAnalytics, getMatomoReportingHealth } from "@/lib/analytics/matomo";
import { getSession } from "@/lib/auth/session";
import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover";

export const revalidate = 300;

const analyticsFallback = {
  reportingStatus: "error",
  periodLabel: "Dnes",
  visits: 0,
  conversions: 0,
  conversionRate: 0,
  topSource: "—",
  sources: [],
  funnel: {
    service: 0,
    date: 0,
    time: 0,
    created: 0,
  },
  contactStepQuality: {
    started: 0,
    fieldFocus: 0,
    fieldInputStarted: 0,
    fieldError: 0,
    focusRate: 0,
    inputRate: 0,
    errorRate: 0,
  },
} as const;

type AdminAnalyticsRouteApiDependencies = {
  getSession: typeof getSession;
  getMatomoReportingHealth: typeof getMatomoReportingHealth;
  getDashboardAnalytics: typeof getDashboardAnalytics;
  notifySystemError: typeof sendOwnerSystemErrorPushover;
};

export function createAdminAnalyticsRouteApi(
  dependencies: AdminAnalyticsRouteApiDependencies = {
    getSession,
    getMatomoReportingHealth,
    getDashboardAnalytics,
    notifySystemError: sendOwnerSystemErrorPushover,
  },
) {
  return {
    async GET() {
      const session = await dependencies.getSession();

      if (!session || ![AdminRole.OWNER, AdminRole.SALON].includes(session.role)) {
        return NextResponse.json(
          {
            status: "error",
            message: "Do teto sekce maji pristup jen prihlaseni admin uzivatele.",
          },
          { status: 403 },
        );
      }

      try {
        const reportingHealth = await dependencies.getMatomoReportingHealth();

        if (reportingHealth.status !== "ok") {
          return NextResponse.json(
            {
              ...analyticsFallback,
              reportingStatus: reportingHealth.status,
              reportingMessage: reportingHealth.message,
            },
            { status: 200 },
          );
        }

        const analytics = await dependencies.getDashboardAnalytics();

        return NextResponse.json(
          {
            ...analytics,
            reportingStatus: "ok",
          },
          { status: 200 },
        );
      } catch (error) {
        console.error("Admin analytics API failed", {
          adminUserId: session.sub,
          role: session.role,
          error,
        });

        await dependencies.notifySystemError({
          title: "PP Studio - systemova chyba",
          message: "Admin analytics API vratilo fallback kvuli neocekavane chybe.",
          context: {
            contextId: "admin-analytics-api",
            adminUserId: session.sub,
            role: session.role,
          },
          error,
        });

        return NextResponse.json(
          {
            ...analyticsFallback,
            reportingMessage: "Matomo reporting je dočasně nedostupný.",
          },
          { status: 200 },
        );
      }
    },
  };
}

const api = createAdminAnalyticsRouteApi();
export const GET = api.GET;
