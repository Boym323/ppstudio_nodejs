import { siteConfig } from "@/config/site";
import type { FaqSection, Service } from "@/content/public-site";
import type { PublicSalonProfile } from "@/lib/site-settings";

type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | JsonLdValue[]
  | {
      [key: string]: JsonLdValue | undefined;
    };

type SeoJsonLdProps = {
  data: JsonLdValue;
};

export function SeoJsonLd({ data }: SeoJsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function buildSalonJsonLd(profile: PublicSalonProfile) {
  const bookingUrl = `${siteConfig.url}/rezervace`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BeautySalon",
        "@id": `${siteConfig.url}/#business`,
        name: profile.name,
        url: siteConfig.url,
        image: `${siteConfig.url}/brand/ppstudio-logo.png`,
        logo: `${siteConfig.url}/brand/ppstudio-logo.png`,
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
            urlTemplate: bookingUrl,
            inLanguage: "cs-CZ",
          },
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteConfig.url}/#website`,
        name: profile.name,
        url: siteConfig.url,
        publisher: {
          "@id": `${siteConfig.url}/#business`,
        },
        inLanguage: "cs-CZ",
      },
    ],
  };
}

export function buildHomePageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteConfig.url}/#webpage`,
    url: siteConfig.url,
    name: "PP Studio | Kosmetické studio Zlín",
    isPartOf: {
      "@id": `${siteConfig.url}/#website`,
    },
    about: {
      "@id": `${siteConfig.url}/#business`,
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

export function buildServiceJsonLd(service: Service, profile: Pick<PublicSalonProfile, "city">) {
  const pageUrl = `${siteConfig.url}/sluzby/${service.slug}`;
  const price = parseCzkPrice(service.priceFrom);
  const offer =
    price === null
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
        description: service.seoDescription,
        serviceType: service.category,
        inLanguage: "cs-CZ",
        provider: {
          "@id": `${siteConfig.url}/#business`,
        },
        areaServed: {
          "@type": "City",
          name: profile.city,
        },
        offers: offer,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Domů",
            item: siteConfig.url,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Služby",
            item: `${siteConfig.url}/sluzby`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: service.name,
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

function parseCzkPrice(value: string) {
  const normalizedValue = value.normalize("NFKC").toLowerCase();

  if (/(zdarma|dle konzultace|individuálně|individualne|na dotaz)/i.test(normalizedValue)) {
    return null;
  }

  const amount = normalizedValue.match(/\d+(?:[\s.]\d{3})*/)?.[0].replace(/[^\d]/g, "");

  return amount && Number(amount) > 0 ? amount : null;
}
