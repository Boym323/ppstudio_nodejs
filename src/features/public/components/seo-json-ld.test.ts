import assert from "node:assert/strict";
import { before, describe, test } from "node:test";

import type { Service } from "@/content/public-site";
import type { PublicSalonProfile } from "@/lib/site-settings";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "http://127.0.0.1:3100";
process.env.NEXT_PUBLIC_SITE_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/ppstudio_test";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-with-enough-length-123456";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "owner-password";
process.env.ADMIN_STAFF_EMAIL ??= "salon@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "salon-password";

let buildLocalBusinessJsonLd: typeof import("./seo-json-ld")["buildLocalBusinessJsonLd"];
let buildHomePageJsonLd: typeof import("./seo-json-ld")["buildHomePageJsonLd"];
let buildPersonJsonLd: typeof import("./seo-json-ld")["buildPersonJsonLd"];
let buildFaqPageJsonLd: typeof import("./seo-json-ld")["buildFaqPageJsonLd"];
let buildBreadcrumbListJsonLd: typeof import("./seo-json-ld")["buildBreadcrumbListJsonLd"];
let buildServiceJsonLd: typeof import("./seo-json-ld")["buildServiceJsonLd"];
let serializeJsonLd: typeof import("./seo-json-ld")["serializeJsonLd"];

before(async () => {
  const seoJsonLd = await import("./seo-json-ld");

  buildLocalBusinessJsonLd = seoJsonLd.buildLocalBusinessJsonLd;
  buildHomePageJsonLd = seoJsonLd.buildHomePageJsonLd;
  buildPersonJsonLd = seoJsonLd.buildPersonJsonLd;
  buildFaqPageJsonLd = seoJsonLd.buildFaqPageJsonLd;
  buildBreadcrumbListJsonLd = seoJsonLd.buildBreadcrumbListJsonLd;
  buildServiceJsonLd = seoJsonLd.buildServiceJsonLd;
  serializeJsonLd = seoJsonLd.serializeJsonLd;
});

const salonProfile = {
  name: "PP Studio",
  operatorName: "Pavlína Pomykalová",
  businessId: "234 275 66",
  phone: "+420 732 856 036",
  email: "info@ppstudio.cz",
  instagramUrl: "https://www.instagram.com/ppstudio.cz/",
  streetAddress: "Sadová 2",
  postalCode: "760 01",
  city: "Zlín",
  addressLine: "Sadová 2, 760 01 Zlín",
  bookingLabel: "Dle vypsaných termínů a individuální domluvy",
} satisfies PublicSalonProfile;

const service = {
  slug: "refresh-treatment-75-min",
  name: "Čisticí ošetření pleti",
  category: "Kosmetické ošetření",
  priceFrom: "1 690 Kč",
  duration: "75 min",
  durationMinutes: 75,
  intro: "Šetrné čištění a zklidnění pleti.",
  description: "Viditelný veřejný popis služby.",
  idealFor: ["citlivější pleť"],
  includes: ["diagnostika"],
  results: ["čistší pleť"],
  placeholderAssetBrief: "Detail služby v salonu.",
  seoDescription: "Čisticí ošetření pleti ve Zlíně se šetrným postupem.",
} satisfies Service;

const sameAsProfiles = [
  "https://www.instagram.com/ppstudio.cz/",
  "https://www.facebook.com/ppstudio.cz",
  "https://www.google.com/maps/place/Kosmetika+%7C+Pavl%C3%ADna+Pomykalov%C3%A1/@49.2243341,17.6666905,17z/data=!3m1!4b1!4m6!3m5!1s0x471373237e15d51f:0x512b1d491baa6ee7!8m2!3d49.2243341!4d17.6666905!16s%2Fg%2F11n56ny14y",
  "https://www.firmy.cz/detail/13882549-kosmetika-pavlina-pomykalova-zlin.html",
  "https://mapy.com/cs/zakladni?mrp=%7B%22c%22%3A+111%7D&planovani-trasy=&rc=9oNFlx8BA8&ri=&ri=13882549&rs=&rs=firm&rt=&rt=&x=17.666679&y=49.224303&z=17",
];

describe("seo json-ld helpers", () => {
  test("builds LocalBusiness/BeautySalon JSON-LD from salon profile", () => {
    const jsonLd = buildLocalBusinessJsonLd(salonProfile);
    const business = jsonLd["@graph"][0] as {
      "@type": string;
      name: string;
      telephone: string;
      email: string;
      address: { addressLocality: string };
      "@id": string;
      owner: { "@id": string };
      potentialAction: { target: { urlTemplate: string } };
      openingHoursSpecification?: unknown;
      sameAs?: string[];
    };

    assert.equal(jsonLd["@context"], "https://schema.org");
    assert.equal(business["@type"], "BeautySalon");
    assert.equal(business.name, "PP Studio");
    assert.equal(business.telephone, "+420 732 856 036");
    assert.equal(business.email, "info@ppstudio.cz");
    assert.equal(business.address.addressLocality, "Zlín");
    assert.equal(business["@id"], "https://ppstudio.cz/#business");
    assert.equal(business.openingHoursSpecification, undefined);
    assert.equal(business.owner["@id"], "https://ppstudio.cz/o-mne#person");
    assert.equal(business.potentialAction.target.urlTemplate, "https://ppstudio.cz/rezervace");
    assert.deepEqual(business.sameAs, sameAsProfiles);
    const website = jsonLd["@graph"][1] as { "@id": string; url: string; publisher: { "@id": string } };
    assert.equal(website["@id"], "https://ppstudio.cz/#website");
    assert.equal(website.url, "https://ppstudio.cz");
    assert.equal(website.publisher["@id"], business["@id"]);
  });

  test("builds the homepage WebPage against the canonical WebSite and salon IDs", () => {
    const jsonLd = buildHomePageJsonLd();
    assert.equal(jsonLd["@context"], "https://schema.org");
    assert.equal(jsonLd["@type"], "WebPage");
    assert.equal(jsonLd["@id"], "https://ppstudio.cz/#webpage");
    assert.equal(jsonLd.url, "https://ppstudio.cz");
    assert.deepEqual(jsonLd.isPartOf, { "@id": "https://ppstudio.cz/#website" });
    assert.deepEqual(jsonLd.about, { "@id": "https://ppstudio.cz/#business" });
  });

  test("builds FAQPage from the same questions and answers as the public content", () => {
    const jsonLd = buildFaqPageJsonLd([
      {
        id: "rezervace",
        title: "Rezervace",
        description: "Praktické informace.",
        items: [{ question: "Jak si vyberu termín?", answer: "V rezervačním přehledu." }],
      },
    ]);
    assert.equal(jsonLd["@type"], "FAQPage");
    assert.equal(jsonLd["@id"], "https://ppstudio.cz/faq#faqpage");
    assert.equal(jsonLd.url, "https://ppstudio.cz/faq");
    assert.deepEqual(jsonLd.mainEntity, [
      {
        "@type": "Question",
        name: "Jak si vyberu termín?",
        acceptedAnswer: { "@type": "Answer", text: "V rezervačním přehledu." },
      },
    ]);
  });

  test("builds Service JSON-LD with offer, CZK currency and ISO duration", () => {
    const jsonLd = buildServiceJsonLd(service, salonProfile);
    const serviceNode = jsonLd["@graph"][0] as {
      "@type": string;
      name: string;
      description: string;
      provider: { "@type": string };
      areaServed: { name: string };
      "@id": string;
      url: string;
      offers?: { "@type": string; price: string; priceCurrency: string; url: string; availability?: string };
      duration?: unknown;
    };

    assert.equal(jsonLd["@context"], "https://schema.org");
    assert.equal(serviceNode["@type"], "Service");
    assert.equal(serviceNode.name, "Čisticí ošetření pleti");
    assert.equal(serviceNode.description, "Čisticí ošetření pleti ve Zlíně se šetrným postupem.");
    assert.equal(serviceNode.provider["@type"], "BeautySalon");
    assert.equal(serviceNode.areaServed.name, "Zlín");
    assert.ok(serviceNode.offers);
    assert.equal(serviceNode.offers.price, "1690");
    assert.equal(serviceNode.offers.priceCurrency, "CZK");
    assert.equal(serviceNode.offers.url, serviceNode.url);
    assert.equal(serviceNode.offers["@type"], "Offer");
    assert.equal(serviceNode.offers.availability, undefined);
    assert.equal(serviceNode["@id"], `${serviceNode.url}#service`);
    assert.equal(Object.hasOwn(serviceNode, "duration"), false);
    assert.doesNotMatch(serializeJsonLd(jsonLd), /"duration"\s*:/);
  });

  test("builds Person JSON-LD for the about page entity", () => {
    const jsonLd = buildPersonJsonLd({
      operatorName: salonProfile.operatorName,
      instagramUrl: salonProfile.instagramUrl,
      city: salonProfile.city,
      businessName: salonProfile.name,
    });

    assert.equal(jsonLd["@context"], "https://schema.org");
    assert.equal(jsonLd["@type"], "Person");
    assert.equal(jsonLd.name, "Pavlína Pomykalová");
    assert.equal(jsonLd.jobTitle, "Kosmetická specialistka");
    assert.equal(jsonLd.url, "https://ppstudio.cz/o-mne");
    assert.equal(Object.hasOwn(jsonLd, "sameAs"), false);
    const business = buildLocalBusinessJsonLd(salonProfile)["@graph"][0] as { owner: { "@id": string } };
    assert.equal(business.owner["@id"], jsonLd["@id"]);
  });

  test("builds BreadcrumbList JSON-LD with absolute URLs and current page without item", () => {
    const jsonLd = buildBreadcrumbListJsonLd([
      { label: "Domů", href: "/" },
      { label: "Služby", href: "/sluzby" },
      { label: "Čisticí ošetření pleti" },
    ]);

    assert.equal(jsonLd["@context"], "https://schema.org");
    assert.equal(jsonLd["@type"], "BreadcrumbList");
    assert.deepEqual(jsonLd.itemListElement, [
      {
        "@type": "ListItem",
        position: 1,
        name: "Domů",
        item: "https://ppstudio.cz",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Služby",
        item: "https://ppstudio.cz/sluzby",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Čisticí ošetření pleti",
      },
    ]);
    const currentPage = jsonLd.itemListElement[2];
    assert.ok(currentPage);
    assert.equal(Object.prototype.hasOwnProperty.call(currentPage, "item"), false);
  });

  test("keeps price as a schema-safe number string", () => {
    const jsonLd = buildServiceJsonLd(service, salonProfile);
    const serviceNode = jsonLd["@graph"][0] as { offers?: { price: string } };
    assert.ok(serviceNode.offers);
    const price = serviceNode.offers.price;

    assert.equal(typeof price, "string");
    assert.match(price, /^\d+$/);
  });

  test("does not publish the unsupported Service.duration property for any treatment length", () => {
    for (const durationMinutes of [30, 75, 120]) {
      const publicService = { ...service, durationMinutes, duration: `${durationMinutes} min` };
      const jsonLd = buildServiceJsonLd(publicService, salonProfile);
      const serviceNode = jsonLd["@graph"][0] as { name: string; duration?: unknown; offers?: unknown };
      assert.equal(Object.hasOwn(serviceNode, "duration"), false);
      assert.doesNotMatch(serializeJsonLd(jsonLd), /"duration"\s*:/);
      assert.equal(serviceNode.name, publicService.name);
      assert.ok(serviceNode.offers);
      assert.equal(publicService.durationMinutes, durationMinutes);
    }
  });

  test("does not publish starting, consultation or invalid prices as fixed offers", () => {
    for (const priceFrom of ["od 1 690 Kč", "Na dotaz", "Dle konzultace", "individuální cena", "Cena: 1 690 Kč"]) {
      const jsonLd = buildServiceJsonLd({ ...service, priceFrom }, salonProfile);
      const serviceNode = jsonLd["@graph"][0] as { offers?: unknown };
      assert.equal(serviceNode.offers, undefined, `${priceFrom} must not become a fixed-price Offer`);
    }
  });

  test("only uses an exact published amount and never invents a fixed price for zero", () => {
    const jsonLd = buildServiceJsonLd({ ...service, priceFrom: "1 690 Kč" }, salonProfile);
    const serviceNode = jsonLd["@graph"][0] as { offers?: { price: string; priceCurrency: string } };
    assert.deepEqual(serviceNode.offers, {
      "@type": "Offer",
      url: "https://ppstudio.cz/sluzby/refresh-treatment-75-min",
      priceCurrency: "CZK",
      price: "1690",
    });
    assert.equal(buildServiceJsonLd({ ...service, priceFrom: "0 Kč" }, salonProfile)["@graph"][0] &&
      (buildServiceJsonLd({ ...service, priceFrom: "0 Kč" }, salonProfile)["@graph"][0] as { offers?: unknown }).offers,
    undefined);
  });

  test("preserves Czech diacritics in serialized JSON-LD", () => {
    const serialized = serializeJsonLd(buildServiceJsonLd(service, salonProfile));

    assert.match(serialized, /Čisticí ošetření pleti/);
    assert.match(serialized, /Zlín/);
  });

  test("escapes less-than signs before emitting JSON-LD into HTML", () => {
    const serialized = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    assert.doesNotMatch(serialized, /<\//);
    assert.match(serialized, /\\u003c\/script>/);
  });

  test("omits undefined, null and empty values from serialized JSON-LD", () => {
    const array: Array<string | null | undefined> = ["hodnota", undefined, null, ""];
    const serialized = serializeJsonLd({
      "@context": "https://schema.org",
      name: "PP Studio",
      missing: undefined,
      nested: {
        empty: undefined,
        alsoEmpty: null,
        visible: "Zlín",
      },
      array: array.filter((item): item is string => typeof item === "string"),
    });

    assert.doesNotMatch(serialized, /undefined|null|missing|alsoEmpty|empty/);
    assert.match(serialized, /hodnota/);
    assert.match(serialized, /Zlín/);
  });
});
