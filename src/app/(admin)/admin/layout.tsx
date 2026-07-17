import type { Metadata, Viewport } from "next";

import { AdminPwaRegistrar } from "@/features/pwa/admin-pwa-registrar";

export const metadata: Metadata = {
  applicationName: "PP Studio",
  manifest: "/admin.webmanifest",
  title: {
    absolute: "PP Studio – administrace",
  },
  robots: {
    index: false,
    follow: false,
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "PP Studio" },
};

export const viewport: Viewport = { themeColor: "#18181a", viewportFit: "cover" };

export default function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <><AdminPwaRegistrar />{children}</>;
}
