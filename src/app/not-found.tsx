import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { NotFoundPage } from "@/components/layout/not-found-page";

export const metadata: Metadata = {
  title: "Stránka nebyla nalezena",
  description: "Požadovaná stránka PP Studia nebyla nalezena.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <SiteShell>
      <NotFoundPage />
    </SiteShell>
  );
}
