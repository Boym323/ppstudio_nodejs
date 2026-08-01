import assert from "node:assert/strict";
import test from "node:test";

import { VoucherType } from "@prisma/client";

import { toPublicBookingVoucherValidationSuccess } from "./public-booking-voucher-presentation";

test("veřejná odpověď hodnotového voucheru neobsahuje zůstatek v žádném poli ani textu", () => {
  const response = toPublicBookingVoucherValidationSuccess({
    code: "PP-2026-TAJNY",
    type: VoucherType.VALUE,
  });

  assert.deepEqual(response, {
    ok: true,
    code: "PP-2026-TAJNY",
    displayLabel: "Hodnotový poukaz",
  });
  assert.equal(JSON.stringify(response).includes("1730"), false);
  assert.equal(/\d+\s*Kč/u.test(JSON.stringify(response)), false);
  assert.equal(Object.keys(response).some((key) => key.toLowerCase().includes("remaining")), false);
});

test("veřejná odpověď službového voucheru obsahuje jen bezpečný název služby", () => {
  assert.deepEqual(
    toPublicBookingVoucherValidationSuccess({
      code: "PP-2026-SLUZBA",
      type: VoucherType.SERVICE,
      serviceNameSnapshot: "Lash lifting",
    }),
    {
      ok: true,
      code: "PP-2026-SLUZBA",
      displayLabel: "Poukaz na službu – Lash lifting",
    },
  );
});
