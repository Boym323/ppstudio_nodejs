import assert from "node:assert/strict";
import { before, test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "http://127.0.0.1:3100";
process.env.NEXT_PUBLIC_SITE_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/ppstudio_test";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-with-enough-length-123456";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "owner-password";
process.env.ADMIN_STAFF_EMAIL ??= "salon@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "salon-password";

let ServiceDetailPage: typeof import("./public-site")["ServiceDetailPage"];
let buildPageMetadata: typeof import("./public-site")["buildPageMetadata"];

before(async () => {
  const publicSiteModule = await import("./public-site");
  ServiceDetailPage = publicSiteModule.ServiceDetailPage;
  buildPageMetadata = publicSiteModule.buildPageMetadata;
});

test("buildPageMetadata keeps canonical and OpenGraph URLs on public canonical origin", () => {
  const metadata = buildPageMetadata({
    title: "Služby",
    description: "Kosmetické služby PP Studio.",
    path: "/sluzby/",
  });

  assert.equal(metadata.alternates?.canonical, "https://ppstudio.cz/sluzby");
  assert.equal(metadata.openGraph?.url, "https://ppstudio.cz/sluzby");
});

test("buildPageMetadata předává title bez značky, aby ji layout přidal právě jednou", () => {
  const metadata = buildPageMetadata({
    title: "Lash lifting Zlín",
    description: "Kosmetické služby PP Studio.",
    path: "/sluzby/lash-lifting",
  });

  assert.equal(metadata.title, "Lash lifting Zlín");
  assert.equal(metadata.openGraph?.title, "Lash lifting Zlín | PP Studio");
  assert.equal(metadata.twitter?.title, "Lash lifting Zlín | PP Studio");
});

test("ServiceDetailPage points booking CTA to the service with its entry source", () => {
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

  assert.match(
    html,
    /href="\/rezervace\?service=lash-lifting-special&amp;source=service_detail"/,
  );
});
