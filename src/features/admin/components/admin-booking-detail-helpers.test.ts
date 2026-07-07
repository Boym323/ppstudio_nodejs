import assert from "node:assert/strict";
import test from "node:test";

import { getPriceDifferenceLabel, getStatusContext, getVoucherAmountHint } from "./admin-booking-detail-helpers";

test("getPriceDifferenceLabel vraci srozumitelny label pro slevu a navyseni", () => {
  assert.equal(getPriceDifferenceLabel(-250), "Sleva 250\u00A0Kč");
  assert.equal(getPriceDifferenceLabel(300), "Navýšení 300\u00A0Kč");
  assert.equal(getPriceDifferenceLabel(0), "Bez úpravy");
});

test("getVoucherAmountHint vraci hint jen pro hodnotovy voucher s nizsim zustatkem", () => {
  assert.equal(
    getVoucherAmountHint(
      {
        code: "ABCD",
        defaultRedeemAmountCzk: 400,
        remainingValueCzk: 400,
        remainingLabel: "400 Kč",
        id: "voucher-1",
        isActive: true,
        isRedeemable: true,
        statusLabel: "Aktivní",
        status: "ACTIVE",
        effectiveStatus: "ACTIVE",
        serviceId: null,
        serviceNameSnapshot: null,
        type: "VALUE",
        typeLabel: "Hodnotový",
        valueLabel: "500 Kč",
        validUntilLabel: "31. 12. 2026",
        defaultRedeemAmountCzkLabel: null,
      } as never,
      900,
    ),
    "Voucher pokryje maximálně 400\u00A0Kč. Zbytek ceny služby se doplatí mimo voucher.",
  );
  assert.equal(getVoucherAmountHint(null, 900), null);
});

test("getStatusContext rozlisuje confirmed a uzavreny detail bez dalsi akce", () => {
  const confirmed = getStatusContext({
    status: "CONFIRMED",
    availableActions: ["complete"],
  } as never);
  const completed = getStatusContext({
    status: "COMPLETED",
    availableActions: [],
  } as never);

  assert.deepEqual(confirmed, {
    title: "Potvrzený termín · Po návštěvě zapiš úhradu a dokonči návštěvu.",
    description: "Po návštěvě uzavři rezervaci jako hotovou, případně označ jako nedorazila.",
    tone: "confirmed",
  });
  assert.deepEqual(completed, {
    title: "Rezervace je uzavřená jako hotová.",
    description: "Detail teď slouží hlavně pro kontrolu poznámek a historie.",
    tone: "closed",
  });
});
