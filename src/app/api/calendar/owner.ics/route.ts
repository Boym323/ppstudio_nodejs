import { CalendarFeedScope } from "@prisma/client";
import { type NextRequest } from "next/server";

import {
  buildOwnerCalendarFeedIcs,
  validateCalendarFeedRequestToken,
} from "@/features/calendar/lib/calendar-feed-service";

export const dynamic = "force-dynamic";

function buildUnauthorizedCalendarResponse() {
  return new Response("Kalendář nebyl nalezen.", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();

  if (!token) {
    return buildUnauthorizedCalendarResponse();
  }

  const feed = await validateCalendarFeedRequestToken(CalendarFeedScope.OWNER_BOOKINGS, token);

  if (!feed) {
    return buildUnauthorizedCalendarResponse();
  }

  const calendar = await buildOwnerCalendarFeedIcs();

  return new Response(calendar, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="owner-bookings.ics"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
