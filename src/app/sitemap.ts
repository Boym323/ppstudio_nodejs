import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { getPublicServiceSitemapEntries } from "@/features/public/lib/public-services";

type StaticSitemapRoute = {
  route: string;
  changeFrequency: "weekly" | "monthly";
  priority: number;
  lastModified: Date;
  dependsOnServices?: boolean;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: StaticSitemapRoute[] = [
    { route: "", changeFrequency: "weekly", priority: 1, lastModified: new Date("2026-04-27T00:00:00.000Z") },
    { route: "/rezervace", changeFrequency: "monthly", priority: 0.9, lastModified: new Date("2026-04-27T00:00:00.000Z") },
    { route: "/sluzby", changeFrequency: "monthly", priority: 0.7, lastModified: new Date("2026-04-27T00:00:00.000Z"), dependsOnServices: true },
    { route: "/cenik", changeFrequency: "monthly", priority: 0.7, lastModified: new Date("2026-04-27T00:00:00.000Z"), dependsOnServices: true },
    { route: "/o-mne", changeFrequency: "monthly", priority: 0.7, lastModified: new Date("2026-04-27T00:00:00.000Z") },
    { route: "/kontakt", changeFrequency: "monthly", priority: 0.7, lastModified: new Date("2026-04-27T00:00:00.000Z") },
    { route: "/faq", changeFrequency: "monthly", priority: 0.7, lastModified: new Date("2026-04-27T00:00:00.000Z") },
    { route: "/storno-podminky", changeFrequency: "monthly", priority: 0.7, lastModified: new Date("2026-04-27T00:00:00.000Z") },
    { route: "/obchodni-podminky", changeFrequency: "monthly", priority: 0.7, lastModified: new Date("2026-04-27T00:00:00.000Z") },
    { route: "/gdpr", changeFrequency: "monthly", priority: 0.7, lastModified: new Date("2026-04-27T00:00:00.000Z") },
  ];

  const services = await getPublicServiceSitemapEntries();
  const latestServiceUpdate = services.reduce<Date | null>(
    (latest, service) => (latest === null || service.updatedAt > latest ? service.updatedAt : latest),
    null,
  );

  return [
    ...staticRoutes.map((item) => ({
      url: `${siteConfig.url}${item.route}`,
      lastModified: item.dependsOnServices ? (latestServiceUpdate ?? item.lastModified) : item.lastModified,
      changeFrequency: item.changeFrequency,
      priority: item.priority,
    })),
    ...services.map((service) => ({
      url: `${siteConfig.url}/sluzby/${service.slug}`,
      lastModified: service.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ];
}
