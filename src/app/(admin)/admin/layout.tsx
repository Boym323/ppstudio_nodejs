import type { Metadata, Viewport } from "next";

import { AdminPwaRegistrar } from "@/features/pwa/admin-pwa-registrar";
import { ToastProvider } from "@/components/ui/toast";

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
  icons: {
    apple: [{ url: "/pwa/admin-apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = { themeColor: "#18181a", viewportFit: "cover" };

export default function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <><AdminPwaRegistrar /><ToastProvider>{children}</ToastProvider></>;
}
