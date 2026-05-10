import assert from "node:assert/strict";
import { before, test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/ppstudio_test";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-with-enough-length-123456";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "owner-password";
process.env.ADMIN_STAFF_EMAIL ??= "salon@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "salon-password";

let ServiceDetailPage: typeof import("./public-site")["ServiceDetailPage"];

before(async () => {
  const publicSiteModule = await import("./public-site");
  ServiceDetailPage = publicSiteModule.ServiceDetailPage;
});

test("ServiceDetailPage points booking CTA to /rezervace?service=<slug>", () => {
  const html = renderToStaticMarkup(
    <ServiceDetailPage
      service={{
        slug: "lash-lifting-special",
        name: "Lash lifting special",
        category: "Řasy",
        priceFrom: "1 290 Kč",
        duration: "60 min",
        description: "Detail služby pro test.",
        intro: "Intro služby pro test.",
        idealFor: ["test"],
        includes: ["test"],
        results: ["test"],
        placeholderAssetBrief: "placeholder",
        seoDescription: "SEO popis testované služby.",
      }}
    />,
  );

  assert.match(html, /href="\/rezervace\?service=lash-lifting-special"/);
});
