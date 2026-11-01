import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBookingAcquisitionCookieHeader,
  buildBookingAcquisitionCookieValue,
  parseBookingAcquisitionCookie,
} from "./booking-acquisition";

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
    mtmContent: null,
    mtmPlacement: null,
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

test("buildBookingAcquisitionCookieHeader adds Secure in production", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";

  try {
    assert.match(buildBookingAcquisitionCookieHeader("value"), /; Secure$/);
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = previousNodeEnv;
  }
});

test("buildBookingAcquisitionCookieValue keeps service, utm and mtm query params in landingPath", () => {
  const cookieValue = buildBookingAcquisitionCookieValue({
    pathname: "/rezervace",
    search: "?service=lash-lifting&utm_source=instagram&utm_medium=social&mtm_campaign=jaro-2026",
    hostname: "ppstudio.cz",
    referrer: "",
  });

  assert.ok(cookieValue);
  assert.equal(
    decodePayload(cookieValue).landingPath,
    "/rezervace?service=lash-lifting&utm_source=instagram&utm_medium=social&mtm_campaign=jaro-2026",
  );
});

test("buildBookingAcquisitionCookieValue maps mtm params into acquisition fields when utm params are missing", () => {
  const cookieValue = buildBookingAcquisitionCookieValue({
    pathname: "/rezervace",
    search: "?mtm_source=instagram&mtm_medium=social&mtm_campaign=jaro-2026",
    hostname: "ppstudio.cz",
    referrer: "",
  });

  assert.ok(cookieValue);
  assert.deepEqual(parseBookingAcquisitionCookie(cookieValue), {
    source: "INSTAGRAM",
    utmSource: "instagram",
    utmMedium: "social",
    utmCampaign: "jaro-2026",
    mtmContent: null,
    mtmPlacement: null,
    referrerHost: null,
  });
});

test("booking acquisition keeps MTM content and placement but never persists fbclid", () => {
  const cookieValue = buildBookingAcquisitionCookieValue({
    pathname: "/rezervace",
    search: "?utm_source=facebook&mtm_content=video-1&mtm_placement=stories&fbclid=click-secret",
    hostname: "ppstudio.cz",
    referrer: "",
  });

  assert.ok(cookieValue);
  const decoded = decodeURIComponent(cookieValue);
  const parsedPayload = JSON.parse(decoded) as { landingPath: string };

  assert.equal(parsedPayload.landingPath.includes("fbclid"), false);
  assert.deepEqual(parseBookingAcquisitionCookie(cookieValue), {
    source: "FACEBOOK",
    utmSource: "facebook",
    utmMedium: null,
    utmCampaign: null,
    mtmContent: "video-1",
    mtmPlacement: "stories",
    referrerHost: null,
  });
});

test("booking acquisition drops obvious contact data from campaign parameters", () => {
  const cookieValue = buildBookingAcquisitionCookieValue({
    pathname: "/rezervace",
    search: "?utm_source=someone%40example.com&mtm_content=%2B420777123456&mtm_placement=instagram_story",
    hostname: "ppstudio.cz",
    referrer: "",
  });

  assert.ok(cookieValue);
  const acquisition = parseBookingAcquisitionCookie(cookieValue);

  assert.equal(acquisition.utmSource, null);
  assert.equal(acquisition.mtmContent, null);
  assert.equal(acquisition.mtmPlacement, "instagram_story");
  assert.doesNotMatch(decodeURIComponent(cookieValue), /someone@example\.com|420777123456/i);
});
