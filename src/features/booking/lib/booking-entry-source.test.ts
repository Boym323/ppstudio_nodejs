import assert from "node:assert/strict";
import test from "node:test";

import { buildBookingEntryHref, resolveBookingEntrySource } from "./booking-entry-source";

test("rezervační zdroj odpovídá stránce, ze které vede CTA", () => {
  const cases = [
    ["home", "homepage"],
    ["kosmetika zlín", "homepage"],
    ["Služby", "service_catalog"],
    ["service_detail", "service_detail"],
    ["ceník", "price_list"],
    ["vouchery", "voucher"],
    ["kontakt", "contact"],
    ["studio", "studio"],
    ["faq", "faq"],
    ["neznámá stránka", "other"],
  ] as const;

  for (const [page, expected] of cases) {
    assert.equal(resolveBookingEntrySource(page), expected, page);
  }
});

test("předvybraná služba ani UTM parametry nemění zdroj vstupní stránky", () => {
  assert.equal(
    buildBookingEntryHref("/rezervace?service=lash-lifting&utm_source=instagram", "Služby"),
    "/rezervace?service=lash-lifting\u0026utm_source=instagram\u0026source=service_catalog",
  );
  assert.equal(
    buildBookingEntryHref("/rezervace?source=other&utm_source=google", "kontakt"),
    "/rezervace?source=contact\u0026utm_source=google",
  );
});
