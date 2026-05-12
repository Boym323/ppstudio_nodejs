import { siteConfig } from "@/config/site";
import type { FaqSection, Service } from "@/content/public-site";
import type { PublicSalonProfile } from "@/lib/site-settings";

type JsonLdPrimitive = string | number | boolean;
type JsonLdValue =
  | null
  | JsonLdPrimitive
  | JsonLdValue[]
  | {
      [key: string]: JsonLdValue | undefined | null;
    };

type SeoJsonLdProps = {
  data: JsonLdValue;
};

type BreadcrumbJsonLdItem = {
  label: string;
  href?: string;
};

type BusinessProfile = Pick<
  PublicSalonProfile,
  "name" | "phone" | "email" | "instagramUrl" | "streetAddress" | "postalCode" | "city"
>;

const BUSINESS_ID = `${siteConfig.url}/#business`;
const WEBSITE_ID = `${siteConfig.url}/#website`;
const LOGO_URL = `${siteConfig.url}/brand/ppstudio-logo.png`;

export function SeoJsonLd({ data }: SeoJsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(data),
      }}
    />
  );
}

export function serializeJsonLd(data: JsonLdValue) {
  return JSON.stringify(compactJsonLd(data)).replace(/</g, "\\u003c");
}

export function buildLocalBusinessJsonLd(profile: BusinessProfile) {
  const business = buildLocalBusinessNode(profile);

  return {
    "@context": "https://schema.org",
    "@graph": [
      business,
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: profile.name,
        url: siteConfig.url,
        publisher: {
          "@id": BUSINESS_ID,
        },
        inLanguage: "cs-CZ",
      },
    ],
  };
}

export function buildSalonJsonLd(profile: BusinessProfile) {
  return buildLocalBusinessJsonLd(profile);
}

export function buildHomePageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteConfig.url}/#webpage`,
    url: siteConfig.url,
    name: "PP Studio | Kosmetické studio Zlín",
    isPartOf: {
      "@id": WEBSITE_ID,
    },
    about: {
      "@id": BUSINESS_ID,
    },
    inLanguage: "cs-CZ",
  };
}

export function buildFaqPageJsonLd(sections: FaqSection[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${siteConfig.url}/faq#faqpage`,
    url: `${siteConfig.url}/faq`,
    name: "FAQ | PP Studio",
    inLanguage: "cs-CZ",
    mainEntity: sections.flatMap((section) =>
      section.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    ),
  };
}

export function buildBreadcrumbListJsonLd(items: BreadcrumbJsonLdItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: buildAbsoluteSiteUrl(item.href) } : {}),
    })),
  };
}

export function buildServiceJsonLd(service: Service, profile: BusinessProfile) {
  const pageUrl = `${siteConfig.url}/sluzby/${service.slug}`;
  const price = parseCzkPrice(service.priceFrom);
  const durationMinutes = service.durationMinutes ?? parseDurationMinutes(service.duration);
  const offer =
    price === undefined
      ? undefined
      : {
          "@type": "Offer",
          url: pageUrl,
          priceCurrency: "CZK",
          price,
          availability: "https://schema.org/InStock",
        };

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${pageUrl}#service`,
        url: pageUrl,
        name: service.name,
        description: service.seoDescription || service.intro || service.description,
        serviceType: service.category,
        inLanguage: "cs-CZ",
        provider: buildLocalBusinessNode(profile),
        areaServed: {
          "@type": "City",
          name: profile.city,
        },
        offers: offer,
        duration: durationMinutesToIsoDuration(durationMinutes),
      },
    ],
  };
}

export function durationMinutesToIsoDuration(minutes: number | undefined) {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) {
    return undefined;
  }

  return `PT${Math.round(minutes)}M`;
}

function buildLocalBusinessNode(profile: BusinessProfile) {
  return {
    "@type": "BeautySalon",
    "@id": BUSINESS_ID,
    name: profile.name,
    url: siteConfig.url,
    image: LOGO_URL,
    logo: LOGO_URL,
    telephone: profile.phone,
    email: profile.email,
    priceRange: "$$",
    description:
      "PP Studio je kosmetické studio ve Zlíně zaměřené na kosmetická ošetření pleti, péči o řasy a obočí, depilaci, líčení a klidnou individuální péči.",
    address: {
      "@type": "PostalAddress",
      streetAddress: profile.streetAddress,
      postalCode: profile.postalCode,
      addressLocality: profile.city,
      addressCountry: "CZ",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 49.2243006,
      longitude: 17.6666456,
    },
    areaServed: {
      "@type": "City",
      name: profile.city,
    },
    sameAs: profile.instagramUrl ? [profile.instagramUrl] : undefined,
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/rezervace`,
        inLanguage: "cs-CZ",
      },
    },
  };
}

function parseCzkPrice(value: string) {
  const normalizedValue = value.normalize("NFKC").toLowerCase();

  if (/(zdarma|dle konzultace|individuálně|individualne|na dotaz)/i.test(normalizedValue)) {
    return undefined;
  }

  const amount = normalizedValue.match(/\d+(?:[\s.]\d{3})*/)?.[0].replace(/[^\d]/g, "");

  return amount && Number(amount) > 0 ? amount : undefined;
}

function parseDurationMinutes(value: string) {
  const minutes = value.normalize("NFKC").match(/\d+/)?.[0];

  return minutes ? Number(minutes) : undefined;
}

function buildAbsoluteSiteUrl(href: string) {
  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  const baseUrl = siteConfig.url.replace(/\/+$/, "");
  const path = href === "/" ? "" : `/${href.replace(/^\/+/, "")}`;

  return `${baseUrl}${path}`;
}

function compactJsonLd(value: JsonLdValue | null | undefined): JsonLdValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const compacted = value
      .map((item) => compactJsonLd(item))
      .filter((item): item is JsonLdValue => item !== undefined);

    return compacted.length > 0 ? compacted : undefined;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).flatMap(([key, item]) => {
      const compacted = compactJsonLd(item);

      return compacted === undefined ? [] : [[key, compacted] as const];
    });

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}
