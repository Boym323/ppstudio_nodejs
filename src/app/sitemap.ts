import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { getPublicServices } from "@/features/public/lib/public-services";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const staticRoutes = [
    "",
    "/rezervace",
    "/sluzby",
    "/cenik",
    "/o-salonu",
    "/kontakt",
    "/faq",
    "/storno-podminky",
    "/obchodni-podminky",
    "/gdpr",
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: `${siteConfig.url}${route}`,
      lastModified,
      changeFrequency: (route === "" ? "weekly" : "monthly") as "weekly" | "monthly",
      priority: route === "" ? 1 : route === "/rezervace" ? 0.9 : 0.7,
    })),
    ...(await getPublicServices()).map((service) => ({
      url: `${siteConfig.url}/sluzby/${service.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ];
}
