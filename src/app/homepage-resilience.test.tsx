import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import PublicError from "./(public)/error";

test("veřejná chybová stránka nabídne kontakt a opakování bez interní chyby", () => {
  let retries = 0;
  const element = PublicError({ error: new Error("internal database detail"), retry: () => { retries += 1; } });
  const html = renderToStaticMarkup(element);
  assert.match(html, /href="\/kontakt"/);
  assert.match(html, /Zkusit znovu/);
  assert.doesNotMatch(html, /internal database detail/);
  element.props.children.props.children[2].props.children[0].props.onClick();
  assert.equal(retries, 1);
});

test("homepage a kontakt zachovají obsah při výpadku katalogu a fotografií", async (t) => {
  let servicesUnavailable = true;
  let catalogEmpty = false;
  let durationUnavailable = true;
  const unavailable = async () => { throw new Error("database unavailable"); };
  t.mock.method(console, "error", () => undefined);
  t.mock.module("next/server", { exports: { connection: async () => undefined } });
  t.mock.module("@/lib/site-settings", {
    exports: {
      getBookingPolicySettings: async () => ({ cancellationHours: 24 }),
      getPublicSalonProfile: async () => ({
        name: "PP Studio", phone: "+420 777 123 456", email: "studio@example.com",
        addressLine: "Sadová, Zlín", instagramUrl: null, operatorName: "Pavlína", businessId: "12345678",
      }),
    },
  });
  t.mock.module("@/features/public/lib/public-media", {
    exports: { getPrimaryPublicHomePortrait: unavailable },
  });
  t.mock.module("@/features/public/lib/public-studio-photos", {
    exports: { getPrimaryPublicContactPhoto: unavailable },
  });
  const { services } = await import("@/content/public-site");
  t.mock.module("@/features/public/lib/public-services", {
    exports: {
      getHomepageFeaturedServices: async () => servicesUnavailable ? unavailable() : catalogEmpty ? [] : [services[0]],
      getPublicServiceDurationRange: async () => durationUnavailable ? unavailable() : { minMinutes: 30, maxMinutes: 90 },
    },
  });
  const { PublicHomePage } = await import("@/features/public/components/public-home-page");
  t.mock.module("@/features/public/components/public-site", {
    exports: { PublicHomePage, buildPageMetadata: () => ({}) },
  });
  t.mock.module("@/features/public/components/seo-json-ld", {
    exports: { SeoJsonLd: () => null, buildHomePageJsonLd: () => ({}) },
  });
  const { default: Page } = await import("./(public)/page");
  const renderHome = async () => {
    const page = await Page();
    return renderToStaticMarkup(await PublicHomePage(page.props.children[1].props));
  };

  const fallbackHtml = await renderHome();
  assert.match(fallbackHtml, /Nabídku služeb se teď nepodařilo načíst/);
  assert.match(fallbackHtml, /href="\/kontakt"/);
  assert.match(fallbackHtml, /ppstudio-portrait.jpg/);
  assert.doesNotMatch(fallbackHtml, /Detail služby/);
  assert.doesNotMatch(fallbackHtml, /database unavailable/);

  servicesUnavailable = false;
  catalogEmpty = true;
  const emptyHtml = await renderHome();
  assert.match(emptyHtml, /Aktuálně nejsou zveřejněné žádné služby/);
  assert.match(emptyHtml, /href="\/kontakt"/);
  assert.doesNotMatch(emptyHtml, /Detail služby/);
  for (const service of services) {
    assert.ok(!emptyHtml.includes(service.name));
    assert.ok(!emptyHtml.includes(`/sluzby/${service.slug}`));
  }

  catalogEmpty = false;
  const partialHtml = await renderHome();
  assert.match(partialHtml, /Detail služby/);
  assert.doesNotMatch(partialHtml, /Nabídku služeb se teď nepodařilo načíst/);

  durationUnavailable = false;
  assert.match(await renderHome(), /Detail služby/);

  const { ContactPage } = await import("@/features/public/components/contact-page");
  const contactHtml = renderToStaticMarkup(await ContactPage());
  assert.match(contactHtml, /href="tel:\+420777123456"/);
  assert.match(contactHtml, /Sadová/);
});
