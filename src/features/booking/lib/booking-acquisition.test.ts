import assert from "node:assert/strict";
import test from "node:test";

import { buildBookingAcquisitionCookieValue, parseBookingAcquisitionCookie } from "./booking-acquisition";

function decodePayload(cookieValue: string) {
  return JSON.parse(decodeURIComponent(cookieValue)) as { landingPath: string };
}

test("buildBookingAcquisitionCookieValue rejects scheme-relative landing paths", () => {
  const cookieValue = buildBookingAcquisitionCookieValue({
    pathname: "//evil.example/landing",
    search: "?utm_source=google",
    hostname: "ppstudio.cz",
    referrer: "",
  });

  assert.ok(cookieValue);
  assert.equal(decodePayload(cookieValue).landingPath, "/");
});

test("parseBookingAcquisitionCookie does not classify substring host matches as known referrers", () => {
  const cookieValue = encodeURIComponent(
    JSON.stringify({
      v: 1,
      firstSeenAt: new Date("2026-05-06T10:00:00.000Z").toISOString(),
      lastSeenAt: new Date("2026-05-06T10:00:00.000Z").toISOString(),
      landingPath: "/rezervace",
      referrerHost: "facebook.com.evil.example",
    }),
  );

  assert.deepEqual(parseBookingAcquisitionCookie(cookieValue), {
    source: "OTHER",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    referrerHost: "facebook.com.evil.example",
  });
});

test("parseBookingAcquisitionCookie keeps subdomain host matches for known referrers", () => {
  const cookieValue = encodeURIComponent(
    JSON.stringify({
      v: 1,
      firstSeenAt: new Date("2026-05-06T10:00:00.000Z").toISOString(),
      lastSeenAt: new Date("2026-05-06T10:00:00.000Z").toISOString(),
      landingPath: "/rezervace",
      referrerHost: "m.facebook.com",
    }),
  );

  assert.equal(parseBookingAcquisitionCookie(cookieValue).source, "FACEBOOK");
});

test("parseBookingAcquisitionCookie keeps country Google domains without broad host labels", () => {
  const googleCookieValue = encodeURIComponent(
    JSON.stringify({
      v: 1,
      firstSeenAt: new Date("2026-05-06T10:00:00.000Z").toISOString(),
      lastSeenAt: new Date("2026-05-06T10:00:00.000Z").toISOString(),
      landingPath: "/rezervace",
      referrerHost: "www.google.cz",
    }),
  );
  const spoofedCookieValue = encodeURIComponent(
    JSON.stringify({
      v: 1,
      firstSeenAt: new Date("2026-05-06T10:00:00.000Z").toISOString(),
      lastSeenAt: new Date("2026-05-06T10:00:00.000Z").toISOString(),
      landingPath: "/rezervace",
      referrerHost: "google.evil.example",
    }),
  );

  assert.equal(parseBookingAcquisitionCookie(googleCookieValue).source, "GOOGLE");
  assert.equal(parseBookingAcquisitionCookie(spoofedCookieValue).source, "OTHER");
});
