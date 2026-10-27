import assert from "node:assert/strict";
import test from "node:test";

import { BookingPaymentStatus } from "@/generated/prisma/browser";
import { getBookingPaymentSummary } from "@/features/booking/payments/lib/booking-payment-summary";

import { aggregateAcquisition } from "./kpi-acquisition";
import { calculateDisruptionMetrics } from "./kpi-disruption-metrics";
import { getKpiHistoricalPrice } from "./kpi-pricing";

const rows = [
  { status: "COMPLETED", price: 1_000, source: "ig" },
  { status: "COMPLETED", price: 1_500, source: "INSTAGRAM" },
  { status: "CANCELLED", price: 800, source: "google" },
  { status: "NO_SHOW", price: 700, source: "fb" },
  { status: "CONFIRMED", price: 1_200, source: "firmy.cz" },
] as const;

test("kontrolní součty stavů, hodnot a akvizice zůstávají konzistentní", () => {
  const completed = rows.filter((row) => row.status === "COMPLETED");
  const unfinished = rows.filter((row) => row.status !== "COMPLETED");
  const disruptions = calculateDisruptionMetrics(rows.map((row) => ({
    status: row.status,
    slotPublishedAt: new Date("2026-06-01T08:00:00.000Z"),
    finalPriceCzk: row.price,
    servicePriceFromCzk: null,
  })));
  const acquisition = aggregateAcquisition(rows.map((row) => ({
    acquisitionSource: row.source,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    isCompleted: row.status === "COMPLETED",
    bookingValue: row.price,
  })));

  assert.equal(
    disruptions.relevantCount,
    completed.length + disruptions.cancellations + disruptions.noShows + rows.filter((row) => row.status === "CONFIRMED").length,
  );
  assert.equal(
    rows.reduce((sum, row) => sum + row.price, 0),
    completed.reduce((sum, row) => sum + row.price, 0) + unfinished.reduce((sum, row) => sum + row.price, 0),
  );
  assert.equal(
    acquisition.summary.reduce((sum, row) => sum + row.revenue, 0),
    completed.reduce((sum, row) => sum + row.price, 0),
  );
  assert.equal(
    acquisition.summary.reduce((sum, row) => sum + row.completed, 0),
    completed.length,
  );
});

test("historické KPI ignorují aktuální cenu katalogu u starých rezervací", () => {
  const oldBooking = { finalPriceCzk: null, servicePriceFromCzk: null, currentServicePriceCzk: 1_800 };
  const priceChanged = { finalPriceCzk: null, servicePriceFromCzk: 1_000, currentServicePriceCzk: 1_500 };
  const adjusted = { finalPriceCzk: 1_300, servicePriceFromCzk: 1_000, currentServicePriceCzk: 1_500 };

  assert.equal(getKpiHistoricalPrice(oldBooking), null);
  assert.equal(getKpiHistoricalPrice(priceChanged), 1_000);
  assert.equal(getKpiHistoricalPrice(adjusted), 1_300);
});

test("kombinované platby a vouchery nezmění historickou cenu rezervace ani zůstatek", () => {
  const totalPriceCzk = getKpiHistoricalPrice({ finalPriceCzk: null, servicePriceFromCzk: 1_700 }) ?? 0;
  const combined = getBookingPaymentSummary({
    totalPriceCzk,
    voucherRedemptions: [{ amountCzk: 500, voucher: { type: "VALUE" } }],
    payments: [
      { amountCzk: 1_200, status: BookingPaymentStatus.ACTIVE },
      { amountCzk: 900, status: BookingPaymentStatus.VOIDED },
    ],
  });
  const serviceVoucher = getBookingPaymentSummary({
    totalPriceCzk,
    serviceId: "service-1",
    servicePriceCzk: 1_700,
    voucherRedemptions: [{ amountCzk: 1_700, serviceId: "service-1", voucher: { type: "SERVICE" } }],
  });

  assert.equal(combined.remainingCzk, 0);
  assert.equal(combined.paidTotalCzk, totalPriceCzk);
  assert.equal(serviceVoucher.remainingCzk, 0);
  assert.equal(serviceVoucher.paidTotalCzk, totalPriceCzk);
});

test("koncept a nepublikovaný záznam nejsou relevantní plánované rezervace", () => {
  const result = calculateDisruptionMetrics([
    { status: "DRAFT", slotPublishedAt: new Date(), finalPriceCzk: 900, servicePriceFromCzk: null },
    { status: "CONFIRMED", slotPublishedAt: null, finalPriceCzk: 900, servicePriceFromCzk: null },
  ]);

  assert.equal(result.relevantCount, 0);
  assert.equal(result.cancellationRate, 0);
  assert.equal(result.noShowRate, 0);
});
