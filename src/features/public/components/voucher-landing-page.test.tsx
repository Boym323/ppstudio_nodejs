import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

test("FAQ poukazů zobrazuje aktuální výchozí platnost z administrace", async (t) => {
  let voucherDefaultValidityMonths = 1;
  t.mock.module("next/server", { exports: { connection: async () => undefined } });
  t.mock.module("@/lib/site-settings", {
    exports: {
      getPublicSalonProfile: async () => ({ phone: "+420 777 123 456", email: "studio@example.test" }),
      getSiteSettings: async () => ({ voucherDefaultValidityMonths }),
    },
  });

  const { VoucherLandingPage } = await import("./voucher-landing-page");
  const render = async () => renderToStaticMarkup(await VoucherLandingPage({ suggestedServices: [] }));

  assert.match(await render(), /Poukaz standardně platí 1 měsíc\./);
  voucherDefaultValidityMonths = 4;
  assert.match(await render(), /Poukaz standardně platí 4 měsíce\./);
  voucherDefaultValidityMonths = 12;
  assert.match(await render(), /Poukaz standardně platí 12 měsíců\./);
});
