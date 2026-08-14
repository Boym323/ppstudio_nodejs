import assert from "node:assert/strict";
import test, { after, afterEach } from "node:test";

import {
  buildSafeMatomoPath,
  claimMatomoPageview,
  ensureMatomoTrackingPath,
  trackBookingEvent,
  trackMatomoEvent,
  shouldInitializeMatomo,
  shouldInitializeMatomoTracking,
  shouldTrackMatomoPath,
} from "./matomo";

const originalEnv = {
  enabled: process.env.NEXT_PUBLIC_MATOMO_ENABLED,
  url: process.env.NEXT_PUBLIC_MATOMO_URL,
  siteId: process.env.NEXT_PUBLIC_MATOMO_SITE_ID,
};

const originalWindow = globalThis.window;
const globalWindow = globalThis as typeof globalThis & { window?: Window & typeof globalThis };

function setMatomoConfigured() {
  process.env.NEXT_PUBLIC_MATOMO_ENABLED = "true";
  process.env.NEXT_PUBLIC_MATOMO_URL = "https://matomo.example.com/";
  process.env.NEXT_PUBLIC_MATOMO_SITE_ID = "1";
}

function restoreEnv() {
  if (originalEnv.enabled === undefined) {
    delete process.env.NEXT_PUBLIC_MATOMO_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_MATOMO_ENABLED = originalEnv.enabled;
  }

  if (originalEnv.url === undefined) {
    delete process.env.NEXT_PUBLIC_MATOMO_URL;
  } else {
    process.env.NEXT_PUBLIC_MATOMO_URL = originalEnv.url;
  }

  if (originalEnv.siteId === undefined) {
    delete process.env.NEXT_PUBLIC_MATOMO_SITE_ID;
  } else {
    process.env.NEXT_PUBLIC_MATOMO_SITE_ID = originalEnv.siteId;
  }
}

function restoreWindow() {
  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalWindow, "window");
    return;
  }

  globalWindow.window = originalWindow;
}

function setMockWindow(windowMock: Partial<Window>) {
  globalWindow.window = windowMock as Window & typeof globalThis;
}

test("shouldInitializeMatomoTracking disables initialization when disabled flag is true", () => {
  setMatomoConfigured();

  assert.equal(shouldInitializeMatomo("/"), true);
  assert.equal(shouldInitializeMatomoTracking("/", { disabled: false }), true);
  assert.equal(shouldInitializeMatomoTracking("/", { disabled: true }), false);
});

test("shouldInitializeMatomoTracking keeps existing admin route protection", () => {
  setMatomoConfigured();

  assert.equal(shouldInitializeMatomoTracking("/admin"), false);
  assert.equal(shouldInitializeMatomoTracking("/admin", { disabled: false }), false);
  assert.equal(shouldTrackMatomoPath("/admin"), false);
});

test("claimMatomoPageview deduplicates one navigation but tracks a return from an untracked route", () => {
  setMockWindow({});

  assert.equal(claimMatomoPageview("/", true), true);
  assert.equal(claimMatomoPageview("/", true), false);
  assert.equal(claimMatomoPageview("/rezervace/storno/[token]", false), false);
  assert.equal(claimMatomoPageview("/", true), true);
});

test("claimMatomoPageview keeps a return trackable after consecutive untracked routes", () => {
  setMockWindow({});

  assert.equal(claimMatomoPageview("/rezervace", true), true);
  assert.equal(claimMatomoPageview("/rezervace/sprava/[token]", false), false);
  assert.equal(claimMatomoPageview("/rezervace/storno/[token]", false), false);
  assert.equal(claimMatomoPageview("/rezervace", true), true);
  assert.equal(claimMatomoPageview("/sluzby", true), true);
});

after(() => {
  restoreEnv();
  restoreWindow();
});

afterEach(() => {
  restoreWindow();
});

test("buildSafeMatomoPath removes sensitive query params and rewrites token routes", () => {
  assert.equal(
    buildSafeMatomoPath("/rezervace/storno/abc123"),
    "/rezervace/storno/[token]",
  );

  const searchParams = new URLSearchParams({
    service: "lash-lifting",
    email: "jana@example.com",
    phone: "+420 777 123 456",
    redirect: "/rezervace/sprava/secret-token",
  });

  assert.equal(
    buildSafeMatomoPath("/rezervace", searchParams),
    "/rezervace?service=lash-lifting",
  );
});

test("trackMatomoEvent allows safe storno actions but still blocks raw token paths", () => {
  setMatomoConfigured();

  const calls: unknown[][] = [];
  setMockWindow({
    _paq: {
      push(payload: unknown[]) {
        calls.push(payload);
      },
    } as unknown as Array<unknown[]>,
  });

  trackMatomoEvent("Rezervace", "Storno dokončeno", "Lash lifting");
  trackMatomoEvent("Rezervace", "Storno odesláno", "/rezervace/storno/secret-token");

  assert.deepEqual(calls, [
    ["trackEvent", "Rezervace", "Storno dokončeno", "Lash lifting"],
  ]);
});

test("trackBookingEvent uses the stable Czech taxonomy and service slug", () => {
  setMatomoConfigured();

  const calls: unknown[][] = [];
  setMockWindow({
    _paq: {
      push(payload: unknown[]) {
        calls.push(payload);
      },
    } as unknown as Array<unknown[]>,
  });

  trackBookingEvent("Vytvořena", "korejsky-lash-lifting");

  assert.deepEqual(calls, [
    ["trackEvent", "Rezervace", "Vytvořena", "korejsky-lash-lifting"],
  ]);
});

test("trackBookingEvent keeps the booking date action and name for Matomo diagnostics", () => {
  setMatomoConfigured();

  const calls: unknown[][] = [];
  setMockWindow({
    _paq: {
      push(payload: unknown[]) {
        calls.push(payload);
      },
    } as unknown as Array<unknown[]>,
  });

  trackBookingEvent("Datum vybráno", "2026-09-03");

  assert.deepEqual(calls, [
    ["trackEvent", "Rezervace", "Datum vybráno", "2026-09-03"],
  ]);
});

test("trackBookingEvent keeps the Čas vybrán funnel action with the detailed slot name", () => {
  setMatomoConfigured();

  const calls: unknown[][] = [];
  setMockWindow({
    _paq: {
      push(payload: unknown[]) {
        calls.push(payload);
      },
    } as unknown as Array<unknown[]>,
  });

  trackBookingEvent("Čas vybrán", "2026-09-03 | 10:00–11:15 | korejsky-lash-lifting");

  assert.deepEqual(calls, [
    ["trackEvent", "Rezervace", "Čas vybrán", "2026-09-03 | 10:00–11:15 | korejsky-lash-lifting"],
  ]);
});

test("ensureMatomoTrackingPath bootstraps safe token route without pageview", () => {
  setMatomoConfigured();

  const calls: unknown[][] = [];
  setMockWindow({
    _paq: {
      push(payload: unknown[]) {
        calls.push(payload);
      },
    } as unknown as Array<unknown[]>,
  });

  ensureMatomoTrackingPath("/rezervace/storno/[token]");
  ensureMatomoTrackingPath("/rezervace/storno/[token]");

  assert.deepEqual(calls, [
    ["setTrackerUrl", "https://matomo.example.com/matomo.php"],
    ["setSiteId", "1"],
    ["enableHeartBeatTimer", 15],
    ["enableLinkTracking"],
    ["setCustomUrl", "/rezervace/storno/[token]"],
  ]);
});
