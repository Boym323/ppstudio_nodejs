import assert from "node:assert/strict";
import test from "node:test";

import { CalendarFeedScope } from "@prisma/client";

(process.env as Record<string, string | undefined>).NODE_ENV ??= "test";
process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://ppstudio:ppstudio@localhost:5432/ppstudio";
process.env.ADMIN_SESSION_SECRET ??= "12345678901234567890123456789012";
process.env.ADMIN_OWNER_EMAIL ??= "owner@ppstudio.cz";
process.env.ADMIN_OWNER_PASSWORD ??= "owner-password";
process.env.ADMIN_STAFF_EMAIL ??= "salon@ppstudio.cz";
process.env.ADMIN_STAFF_PASSWORD ??= "salon-password";

test("calendar feed token is stable until rotation and validates against feed salt", async () => {
  const {
    buildCalendarFeedToken,
    buildCalendarFeedTokenSalt,
    buildCalendarFeedUrl,
    isCalendarFeedTokenValid,
    parseCalendarFeedToken,
  } = await import("./calendar-feed-token");

  const tokenSalt = buildCalendarFeedTokenSalt();
  const feed = {
    id: "cm1234567890abcdef123456",
    scope: CalendarFeedScope.OWNER_BOOKINGS,
    tokenSalt,
    isActive: true,
  };

  const rawToken = buildCalendarFeedToken(feed);

  assert.deepEqual(parseCalendarFeedToken(rawToken), {
    version: "v1",
    feedId: feed.id,
    signature: rawToken.split(".")[2],
  });
  assert.equal(isCalendarFeedTokenValid(feed, rawToken), true);
  assert.equal(isCalendarFeedTokenValid({ ...feed, tokenSalt: buildCalendarFeedTokenSalt() }, rawToken), false);
  assert.match(buildCalendarFeedUrl(feed), /\/api\/calendar\/owner\.ics\?token=/);
});
