import {
  buildBookingCalendarIcs,
  resolveBookingCalendarAccess,
} from "@/features/calendar/lib/booking-calendar-event";

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

function extractCalendarToken(pathname: string) {
  const match = pathname.match(/^\/api\/bookings\/calendar\/(.+)$/);
  const rawValue = match?.[1] ? decodeURIComponent(match[1]) : null;

  if (!rawValue) {
    return null;
  }

  return rawValue.endsWith(".ics")
    ? rawValue.slice(0, -4)
    : rawValue;
}

export async function GET(request: Request) {
  const token = extractCalendarToken(new URL(request.url).pathname);

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
      "Content-Disposition": `inline; filename=\"${filename}\"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
