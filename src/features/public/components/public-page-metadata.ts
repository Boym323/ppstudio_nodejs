import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

export function buildPageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
}): Metadata {
  const canonicalPath = path === "/" ? "/" : path.replace(/\/+$/, "");
  const absoluteUrl = new URL(canonicalPath, siteConfig.canonicalUrl).toString();
  const metadataTitle = absoluteTitle ? title : `${title} | ${siteConfig.name}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: absoluteUrl,
    },
    openGraph: {
      title: metadataTitle,
      description,
      url: absoluteUrl,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "website",
      images: [
        {
          url: "/brand/ppstudio-og-logo.png",
          width: 1200,
          height: 630,
          alt: siteConfig.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: metadataTitle,
      description,
      images: ["/brand/ppstudio-og-logo.png"],
    },
  };
}
