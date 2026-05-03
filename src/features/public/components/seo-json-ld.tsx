import { siteConfig } from "@/config/site";
import type { Service } from "@/content/public-site";
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
        priceRange: "CZK",
        address: {
          "@type": "PostalAddress",
          streetAddress: profile.streetAddress,
          postalCode: profile.postalCode,
          addressLocality: profile.city,
          addressCountry: "CZ",
        },
        areaServed: {
          "@type": "City",
          name: profile.city,
        },
        sameAs: profile.instagramUrl ? [profile.instagramUrl] : undefined,
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

export function buildServiceJsonLd(service: Service, profile: Pick<PublicSalonProfile, "city">) {
  const pageUrl = `${siteConfig.url}/sluzby/${service.slug}`;
  const price = parseCzkPrice(service.priceFrom);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${pageUrl}#service`,
        name: service.name,
        description: service.seoDescription,
        serviceType: service.category,
        provider: {
          "@id": `${siteConfig.url}/#business`,
        },
        areaServed: {
          "@type": "City",
          name: profile.city,
        },
        offers: {
          "@type": "Offer",
          url: pageUrl,
          priceCurrency: "CZK",
          price: price ?? undefined,
          availability: "https://schema.org/InStock",
        },
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
  const normalized = value.replace(/[^\d]/g, "");

  return normalized.length > 0 ? normalized : null;
}
