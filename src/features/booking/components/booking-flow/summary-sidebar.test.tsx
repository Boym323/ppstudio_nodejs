import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { initialPublicBookingActionState } from "@/features/booking/actions/public-booking-action-state";

import { BookingSummarySidebar } from "./summary-sidebar";
import type { VoucherApplicationState } from "./voucher-revalidation";

function renderVoucherSummary(voucherApplication: VoucherApplicationState) {
  return renderToStaticMarkup(
    <BookingSummarySidebar
      currentStep={4}
      fullName="Testovací klientka"
      email="klientka@example.com"
      phone="777 123 456"
      voucherCode="PP-2026-TEST"
      voucherApplication={voucherApplication}
      canGoToStep4
      isRefreshingCatalog={false}
      serverState={initialPublicBookingActionState}
      onEditService={() => {}}
      onEditTerm={() => {}}
      onEditContact={() => {}}
      onStepBack={() => {}}
    />,
  );
}

test("souhrn voucheru rozlišuje všechny stavy", () => {
  assert.match(renderVoucherSummary({ status: "idle" }), /Poukaz bude zkontrolován a uplatněn při návštěvě v salonu\./);
  assert.match(renderVoucherSummary({ status: "checking" }), /Ověřuji použitelnost voucheru…/);
  assert.match(
    renderVoucherSummary({ status: "applied", label: "Dárkový poukaz na lash lifting" }),
    /Poukaz je pro tuto službu ověřený: Dárkový poukaz na lash lifting\./,
  );
  assert.match(
    renderVoucherSummary({ status: "incompatible", message: "Tento poukaz je určený pro službu „Lash lifting“." }),
    /Tento poukaz je určený pro službu „Lash lifting“\./,
  );

  const invalidHtml = renderVoucherSummary({ status: "invalid", message: "Voucher už byl uplatněn." });

  assert.match(invalidHtml, /Tento poukaz momentálně nelze použít\. Upravte nebo odstraňte jeho kód\./);
  assert.doesNotMatch(invalidHtml, /Poukaz bude zkontrolován a uplatněn při návštěvě v salonu\./);
});
