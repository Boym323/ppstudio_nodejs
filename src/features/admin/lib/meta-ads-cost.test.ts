import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { costPerBooking, countPaidMetaBookings, isPaidMetaMedium, parseMetaAdsSpend } from "./meta-ads-cost";

describe("Meta Ads CPA", () => {
  it("rozlišuje placenou Meta návštěvu od organického Instagramu", () => {
    assert.equal(isPaidMetaMedium("paid_social"), true);
    assert.equal(isPaidMetaMedium("paid-social"), true);
    assert.equal(isPaidMetaMedium("CPC"), true);
    assert.equal(isPaidMetaMedium("social"), false);
    assert.equal(isPaidMetaMedium(null), false);
  });

  it("počítá jen webové rezervace z placených Meta zdrojů a bez storen", () => {
    const counts = countPaidMetaBookings([
      { acquisitionSource: "INSTAGRAM", acquisitionUtmMedium: "paid_social", status: "PENDING", count: 3 },
      { acquisitionSource: "FACEBOOK", acquisitionUtmMedium: "cpc", status: "COMPLETED", count: 2 },
      { acquisitionSource: "INSTAGRAM", acquisitionUtmMedium: "paid_social", status: "CANCELLED", count: 5 },
      { acquisitionSource: "INSTAGRAM", acquisitionUtmMedium: "social", status: "COMPLETED", count: 7 },
      { acquisitionSource: "GOOGLE", acquisitionUtmMedium: "paid_social", status: "COMPLETED", count: 11 },
    ]);
    assert.deepEqual(counts, { bookings: 5, completed: 2 });
  });

  it("parsuje peníze v měně účtu bez falešných hodnot", () => {
    assert.deepEqual(parseMetaAdsSpend({ data: [{ spend: "123.45", account_currency: "CZK" }] }), {
      spend: 123.45, currency: "CZK", hasData: true,
    });
    assert.deepEqual(parseMetaAdsSpend({ data: [] }), { spend: 0, currency: null, hasData: false });
    assert.equal(parseMetaAdsSpend({ error: { message: "unauthorized" } }), null);
    assert.equal(parseMetaAdsSpend({ data: [{ spend: "-5", account_currency: "CZK" }] }), null);
  });

  it("nenechává dělení nulou vytvářet falešnou cenu", () => {
    assert.equal(costPerBooking(3000, 15), 200);
    assert.equal(costPerBooking(100, 0), null);
    assert.equal(costPerBooking(0, 3), 0);
  });
});
