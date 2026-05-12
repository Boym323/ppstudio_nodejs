import { env } from "@/config/env";

export const siteConfig = {
  name: env.NEXT_PUBLIC_APP_NAME,
  title: "Kosmetický salon ve Zlíně",
  description:
    "PP Studio Pavlíny Pomykalové ve Zlíně nabízí kosmetická ošetření pleti, péči o řasy a obočí, depilaci, líčení a online rezervaci termínu.",
  locale: "cs_CZ",
  url: env.NEXT_PUBLIC_APP_URL,
  canonicalUrl: env.NEXT_PUBLIC_SITE_URL ?? env.NEXT_PUBLIC_APP_URL,
  contact: {
    phone: "+420 732 856 036",
    email: "info@ppstudio.cz",
  },
} as const;
