import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";
process.env.MATOMO_URL ??= "https://matomo.example.com";
process.env.MATOMO_SITE_ID ??= "1";
process.env.MATOMO_AUTH_TOKEN ??= "token";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test("getDashboardAnalytics derives booking funnel viewed step from booking pageviews", async () => {
  global.fetch = (async (input: RequestInfo | URL) => {
    const rawUrl = typeof input === "string" ? input : input.toString();
    const url = new URL(rawUrl);
    const method = url.searchParams.get("method");

    if (method === "VisitsSummary.get") {
      return new Response(
        JSON.stringify({
          nb_visits: 10,
        }),
        { status: 200 },
      );
    }

    if (method === "Events.getAction") {
      return new Response(
        JSON.stringify([
          { label: "Rezervace / Služba vybrána", nb_events: 8 },
          { label: "Rezervace / Služba předvyplněna", nb_events: 3 },
          { label: "Rezervace / Datum vybráno", nb_events: 6 },
          { label: "Rezervace / Čas vybrán", nb_events: 5 },
          { label: "Rezervace / Odeslána rezervace", nb_events: 3 },
          { label: "Rezervace / Vytvořena", nb_events: 2 },
          { label: "Rezervace / Kontakt zahájen", nb_events: 4 },
          { label: "Rezervace / Kontakt pole fokus", nb_events: 3 },
          { label: "Rezervace / Kontaktní pole zahájeno", nb_events: 2 },
          { label: "Rezervace / Kontakt pole chyba", nb_events: 1 },
        ]),
        { status: 200 },
      );
    }

    if (method === "Goals.get") {
      assert.equal(url.searchParams.get("idGoal"), "1");

      return new Response(
        JSON.stringify({
          nb_conversions: 3,
          conversion_rate: "30%",
          revenue: 2400,
        }),
        { status: 200 },
      );
    }

    if (method === "Actions.getPageUrls") {
      assert.equal(url.searchParams.get("flat"), "1");

      return new Response(
        JSON.stringify([
          { label: "/rezervace", nb_hits: 4 },
          { label: "/rezervace?service=lash-lifting", nb_hits: 3 },
          { label: "https://ppstudio.cz/rezervace?placement=Facebook_Mobile_Reels", nb_hits: 3 },
          { label: "/rezervace/storno/[token]", nb_hits: 99 },
        ]),
        { status: 200 },
      );
    }

    if (method === "Referrers.getReferrerType") {
      assert.equal(url.searchParams.get("idGoal"), "1");
      return new Response(
        JSON.stringify([{ label: "Direct Entry", nb_visits: 10, nb_conversions: 3 }]),
        { status: 200 },
      );
    }

    if (method === "Referrers.getCampaigns") {
      assert.equal(url.searchParams.get("idGoal"), "1");
      return new Response(JSON.stringify([]), { status: 200 });
    }

    return new Response(JSON.stringify([]), { status: 200 });
  }) as typeof fetch;

  const { getDashboardAnalytics } = await import("./matomo");
  const analytics = await getDashboardAnalytics();

  assert.equal(analytics.funnel.viewed, 10);
  assert.equal(analytics.funnel.service, 11);
  assert.equal(analytics.funnel.term, 5);
  assert.equal(analytics.funnel.contact, 4);
  assert.equal(analytics.funnel.submitted, 3);
  assert.equal(analytics.funnel.created, 2);
  assert.equal(analytics.conversions, 3);
  assert.equal(analytics.conversionRate, 30);
  assert.deepEqual(analytics.sources, [
    { label: "Přímý vstup", visits: 10, conversions: 3 },
  ]);
  assert.deepEqual(analytics.contactStepQuality, {
    started: 4,
    fieldFocus: 3,
    fieldInputStarted: 2,
    fieldError: 1,
    focusRate: 75,
    inputRate: 50,
    errorRate: 25,
  });
});
