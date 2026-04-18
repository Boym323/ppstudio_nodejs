import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/rezervace", "/sluzby", "/cenik", "/kontakt", "/o-salonu", "/faq"],
        disallow: ["/admin", "/admin/", "/admin/*", "/api/auth/*", "/rezervace/storno/*"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
