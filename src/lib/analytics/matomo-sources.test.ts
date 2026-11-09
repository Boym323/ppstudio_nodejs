import assert from "node:assert/strict";
import test from "node:test";

import { buildSourceRows, mapCampaignLabel } from "./matomo-sources";

test("kampaň se zařadí mezi placené platformy pouze s jednoznačným prefixem", () => {
  assert.equal(mapCampaignLabel("sklik_search_ppstudio_v4_data"), "Sklik");
  assert.equal(mapCampaignLabel("sklik_kosmetika_zlin"), "Sklik");
  assert.equal(mapCampaignLabel("google_ads_podzim"), "Google Ads");
  assert.equal(mapCampaignLabel("meta_ads_reels"), "Meta Ads");
  assert.equal(mapCampaignLabel("fb_ads_reels"), "Meta Ads");
  assert.equal(mapCampaignLabel("ig"), "Instagram (označená kampaň)");
  assert.equal(mapCampaignLabel("fb"), "Facebook (označená kampaň)");
  assert.equal(mapCampaignLabel("ppstudio_kosmetika_2026_10"), "Kampaně – neurčeno");
  assert.equal(mapCampaignLabel("pp | kosmetika zlín | search | new"), "Kampaně – neurčeno");
  assert.equal(mapCampaignLabel("search_google"), "Kampaně – neurčeno");
});

test("zdroje oddělují kampaně, jednotlivé vyhledávače a sociální sítě bez dvojího započtení", () => {
  const sources = buildSourceRows(
    [
      { label: "Campaigns", nb_visits: 20, nb_conversions: 4 },
      { label: "Search Engines", nb_visits: 10, nb_conversions: 3 },
      { label: "Social Networks", nb_visits: 5, nb_conversions: 1 },
      { label: "Websites", nb_visits: 2, nb_conversions: 1 },
      { label: "Direct Entry", nb_visits: 1, nb_conversions: 0 },
    ],
    [
      { label: "sklik_search_ppstudio_v4_data", nb_visits: 8, nb_conversions: 3 },
      { label: "ig", nb_visits: 4, nb_conversions: 1 },
      { label: "ppstudio_kosmetika_2026_10", nb_visits: 8, nb_conversions: 0 },
    ],
    [
      { label: "Google", nb_visits: 7, nb_conversions: 2 },
      { label: "Seznam", nb_visits: 3, nb_conversions: 1 },
    ],
    [
      { label: "Facebook", nb_visits: 4, nb_conversions: 1 },
      { label: "Instagram", nb_visits: 1, nb_conversions: 0 },
    ],
  );

  assert.deepEqual(sources.find((row) => row.label === "Sklik"), {
    label: "Sklik",
    visits: 8,
    conversions: 3,
  });
  assert.deepEqual(sources.find((row) => row.label === "Google (vyhledávač)"), {
    label: "Google (vyhledávač)",
    visits: 7,
    conversions: 2,
  });
  assert.deepEqual(sources.find((row) => row.label === "Facebook (sociální síť)"), {
    label: "Facebook (sociální síť)",
    visits: 4,
    conversions: 1,
  });
  assert.deepEqual(sources.find((row) => row.label === "Odkazující weby"), {
    label: "Odkazující weby",
    visits: 2,
    conversions: 1,
  });
  assert.equal(sources.reduce((sum, row) => sum + row.visits, 0), 38);
  assert.equal(sources.reduce((sum, row) => sum + row.conversions, 0), 9);
});

test("při nesouladu konverzí se detail sociálních sítí nahradí ověřeným souhrnem", () => {
  assert.deepEqual(
    buildSourceRows(
      [{ label: "Social Networks", nb_visits: 3, nb_conversions: 2 }],
      [],
      [],
      [{ label: "Facebook", nb_visits: 3, nb_conversions: 0 }],
    ),
    [{ label: "Sociální sítě", visits: 3, conversions: 2 }],
  );
});

test("při neúplném počtu návštěv zůstane rozdíl v agregované skupině", () => {
  const rows = buildSourceRows(
    [{ label: "Search Engines", nb_visits: 10, nb_conversions: 4 }],
    [],
    [{ label: "Google", nb_visits: 7, nb_conversions: 3 }],
    [],
  );
  assert.deepEqual(rows, [
    { label: "Google (vyhledávač)", visits: 7, conversions: 3 },
    { label: "Vyhledávače", visits: 3, conversions: 1 },
  ]);
});

test("neslučitelný detail kampaní nikdy nepřičítá další návštěvy", () => {
  assert.deepEqual(
    buildSourceRows(
      [{ label: "Campaigns", nb_visits: 3, nb_conversions: 1 }],
      [{ label: "sklik_search_ppstudio_v4_data", nb_visits: 5, nb_conversions: 1 }],
      [],
      [],
    ),
    [{ label: "Kampaně – neurčeno", visits: 3, conversions: 1 }],
  );
});
