import assert from "node:assert/strict";
import test from "node:test";

import { buildCanonicalBookingRedirectPath } from "./public-slug-routing";

test("booking redirect replaces only the service slug and preserves other query parameters", () => {
  assert.equal(
    buildCanonicalBookingRedirectPath({
      service: "old-treatment",
      voucher: "ABC 123",
      source: ["service_detail", "legacy"],
      empty: undefined,
    }, "skin-balance"),
    "/rezervace?voucher=ABC+123&source=service_detail&source=legacy&service=skin-balance",
  );
});
