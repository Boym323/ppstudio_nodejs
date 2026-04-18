import { env } from "@/config/env";

export const siteConfig = {
  name: env.NEXT_PUBLIC_APP_NAME,
  title: "Luxusní kosmetický salon",
  description:
    "Moderní web pro kosmetický salon s důrazem na čistý zážitek, mobilní použitelnost a elegantní správu rezervací.",
  locale: "cs_CZ",
  url: env.NEXT_PUBLIC_APP_URL,
  contact: {
    phone: "+420 777 000 000",
    email: "hello@ppstudio.cz",
  },
} as const;
