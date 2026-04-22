import { resolveBookingCalendarAccess, buildBookingCalendarIcs } from "@/features/calendar/lib/booking-calendar-event";

export const dynamic = "force-dynamic";

function buildUnavailableCalendarResponse() {
  return new Response("Kalendářová událost nebyla nalezena.", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      token?: string;
    }>;
  },
) {
  const { token } = await context.params;
  if (!token) {
    return buildUnavailableCalendarResponse();
  }

  const access = await resolveBookingCalendarAccess(token);

  if (access.status !== "available") {
    return buildUnavailableCalendarResponse();
  }

  const calendar = await buildBookingCalendarIcs(access.booking);
  const filename = `pp-studio-rezervace-${access.booking.id.slice(-8).toLowerCase()}.ics`;

  return new Response(calendar, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
