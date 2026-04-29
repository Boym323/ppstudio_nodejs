import { AdminRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { getDashboardAnalytics, getMatomoReportingHealth } from "@/lib/analytics/matomo";
import { getSession } from "@/lib/auth/session";

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
} as const;

export async function GET() {
  const session = await getSession();

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
    const reportingHealth = await getMatomoReportingHealth();

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

    const analytics = await getDashboardAnalytics();

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

    return NextResponse.json(
      {
        ...analyticsFallback,
        reportingMessage: "Matomo reporting je dočasně nedostupný.",
      },
      { status: 200 },
    );
  }
}
