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

test("getDashboardAnalytics counts unique visits for ordered funnel events rather than legacy event totals", async () => {
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
          { label: "01 Otevření rezervace", nb_events: 14, nb_visits: 9 },
          { label: "02 Vybraná služba", nb_events: 13, nb_visits: 8 },
          { label: "03 Vybraný termín", nb_events: 9, nb_visits: 5 },
          { label: "04 Kontaktní krok", nb_events: 6, nb_visits: 4 },
          { label: "05 Odeslání rezervace", nb_events: 4, nb_visits: 3 },
          { label: "06 Vytvořená rezervace", nb_events: 3, nb_visits: 2 },
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

  assert.equal(analytics.funnelTrackingActive, true);
  assert.equal(analytics.funnel.viewed, 9);
  assert.equal(analytics.funnel.service, 8);
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

test("getDashboardAnalytics rozlišuje zdroje a ověřuje jejich konverze přes Matomo", async () => {
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    const method = url.searchParams.get("method");
    const withGoal = method?.startsWith("Referrers.") || method === "Goals.get";

    if (withGoal) {
      assert.equal(url.searchParams.get("idGoal"), "1");
    }

    const data: Record<string, unknown> = {
      "VisitsSummary.get": { nb_visits: 14 },
      "Goals.get": { nb_conversions: 4, conversion_rate: 28.57, revenue: 0 },
      "Actions.getPageUrls": [],
      "Events.getAction": [],
      "Referrers.getReferrerType": [
        { label: "Campaigns", nb_visits: 8, nb_conversions: 2 },
        { label: "Search Engines", nb_visits: 4, nb_conversions: 1 },
        { label: "Social Networks", nb_visits: 2, nb_conversions: 1 },
      ],
      "Referrers.getCampaigns": [
        { label: "sklik_search_ppstudio_v4_data", nb_visits: 5, nb_conversions: 2 },
        { label: "ppstudio_kosmetika_2026_10", nb_visits: 3, nb_conversions: 0 },
      ],
      "Referrers.getSearchEngines": [
        { label: "Google", nb_visits: 3, nb_conversions: 1 },
        { label: "Seznam", nb_visits: 1, nb_conversions: 0 },
      ],
      "Referrers.getSocials": [
        { label: "Facebook", nb_visits: 2, nb_conversions: 1 },
      ],
    };
    if (method === "Referrers.getSearchEngines" || method === "Referrers.getSocials") {
      assert.equal(url.searchParams.get("filter_limit"), "100");
    }
    return new Response(JSON.stringify(data[method ?? ""] ?? []), { status: 200 });
  }) as typeof fetch;

  const { getDashboardAnalytics } = await import("./matomo");
  const dashboard = await getDashboardAnalytics();

  assert.equal(dashboard.visits, 14);
  assert.deepEqual(dashboard.sources.find((row) => row.label === "Sklik"), {
    label: "Sklik",
    visits: 5,
    conversions: 2,
  });
  assert.deepEqual(dashboard.sources.find((row) => row.label === "Kampaně – neurčeno"), {
    label: "Kampaně – neurčeno",
    visits: 3,
    conversions: 0,
  });
  assert.deepEqual(dashboard.sources.find((row) => row.label === "Google (vyhledávač)"), {
    label: "Google (vyhledávač)",
    visits: 3,
    conversions: 1,
  });
  assert.deepEqual(dashboard.sources.find((row) => row.label === "Facebook (sociální síť)"), {
    label: "Facebook (sociální síť)",
    visits: 2,
    conversions: 1,
  });
  assert.equal(dashboard.funnelTrackingActive, false);
  assert.deepEqual(dashboard.funnel, {
    viewed: 0, service: 0, term: 0, contact: 0, submitted: 0, created: 0,
  });
  assert.equal(dashboard.sources.reduce((sum, row) => sum + row.visits, 0), 14);
  assert.equal(dashboard.sources.reduce((sum, row) => sum + row.conversions, 0), 4);
});

test("old funnel events without nb_visits do not masquerade as unique visits", async () => {
  global.fetch = (async (input: RequestInfo | URL) => {
    const method = new URL(typeof input === "string" ? input : input.toString()).searchParams.get("method");
    const data: Record<string, unknown> = {
      "VisitsSummary.get": { nb_visits: 3 },
      "Goals.get": { nb_conversions: 1, conversion_rate: 33.33, revenue: 0 },
      "Events.getAction": [
        { label: "Rezervace / Služba vybrána", nb_events: 15 },
        { label: "Rezervační průchod / 01 Otevření rezervace", nb_events: 5 },
      ],
      "Referrers.getReferrerType": [],
      "Referrers.getCampaigns": [],
      "Referrers.getSearchEngines": [],
      "Referrers.getSocials": [],
    };
    return new Response(JSON.stringify(data[method ?? ""] ?? []), { status: 200 });
  }) as typeof fetch;

  const { getDashboardAnalytics } = await import("./matomo");
  const analytics = await getDashboardAnalytics();
  assert.equal(analytics.funnelTrackingActive, false);
  assert.deepEqual(analytics.funnel, {
    viewed: 0, service: 0, term: 0, contact: 0, submitted: 0, created: 0,
  });
});
