import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { siteConfig } from "@/config/site";
import { getPublicServiceSitemapEntries } from "@/features/public/lib/public-services";

type StaticSitemapRoute = {
  route: string;
  changeFrequency: "weekly" | "monthly";
  priority: number;
  dependsOnServices?: boolean;
};

const STATIC_PAGE_LAST_MODIFIED = new Date("2026-04-27T00:00:00.000Z");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: StaticSitemapRoute[] = [
    { route: "", changeFrequency: "weekly", priority: 1 },
    { route: "/rezervace", changeFrequency: "monthly", priority: 0.9 },
    { route: "/vouchery", changeFrequency: "monthly", priority: 0.8 },
    { route: "/sluzby", changeFrequency: "monthly", priority: 0.7, dependsOnServices: true },
    { route: "/cenik", changeFrequency: "monthly", priority: 0.7, dependsOnServices: true },
    { route: "/studio", changeFrequency: "monthly", priority: 0.7 },
    { route: "/o-mne", changeFrequency: "monthly", priority: 0.7 },
    { route: "/kontakt", changeFrequency: "monthly", priority: 0.7 },
    { route: "/faq", changeFrequency: "monthly", priority: 0.7 },
    { route: "/storno-podminky", changeFrequency: "monthly", priority: 0.7 },
    { route: "/obchodni-podminky", changeFrequency: "monthly", priority: 0.7 },
    { route: "/gdpr", changeFrequency: "monthly", priority: 0.7 },
  ];

  // Služby jsou spravované v databázi. Release build běží před migracemi a
  // nesmí proto otevírat aplikační databázi; aktuální sitemap se vytvoří až
  // pro skutečný HTTP request.
  await connection();
  const services = await getPublicServiceSitemapEntries();
  const latestServiceUpdate = services.reduce<Date | null>(
    (latest, service) => (latest === null || service.updatedAt > latest ? service.updatedAt : latest),
    null,
  );

  return [
    ...staticRoutes.map((item) => ({
      url: `${siteConfig.canonicalUrl}${item.route}`,
      lastModified: item.dependsOnServices ? (latestServiceUpdate ?? STATIC_PAGE_LAST_MODIFIED) : STATIC_PAGE_LAST_MODIFIED,
      changeFrequency: item.changeFrequency,
      priority: item.priority,
    })),
    ...services.map((service) => ({
      url: `${siteConfig.canonicalUrl}/sluzby/${service.slug}`,
      lastModified: service.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ];
}
