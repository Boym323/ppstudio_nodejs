import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Suspense } from "react";

import { siteConfig } from "@/config/site";
import { DevChunkReload } from "@/components/dev/dev-chunk-reload";
import { BookingAcquisitionTracker } from "@/features/booking/components/booking-acquisition-tracker";
import { getPublicSalonProfile } from "@/lib/site-settings";

import "./globals.css";

const displayFont = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sansFont = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const salonProfile = await getPublicSalonProfile().catch(() => ({
    name: siteConfig.name,
  }));
  const brandName = salonProfile.name || siteConfig.name;

  return {
    metadataBase: new URL(siteConfig.canonicalUrl),
    applicationName: brandName,
    title: {
      default: `${brandName} | ${siteConfig.title}`,
      template: `%s | ${brandName}`,
    },
    description: siteConfig.description,
    keywords: [
      "kosmetický salon",
      "luxusní kosmetika",
      "péče o pleť",
      "rezervace kosmetiky",
      brandName,
    ],
    category: "beauty",
    authors: [{ name: brandName }],
    creator: brandName,
    publisher: brandName,
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${brandName} | ${siteConfig.title}`,
      description: siteConfig.description,
      url: siteConfig.canonicalUrl,
      siteName: brandName,
      locale: siteConfig.locale,
      type: "website",
      images: [
        {
          url: "/brand/ppstudio-og-logo.png",
          width: 1200,
          height: 630,
          alt: brandName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${brandName} | ${siteConfig.title}`,
      description: siteConfig.description,
      images: ["/brand/ppstudio-og-logo.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="cs"
      data-scroll-behavior="smooth"
      className={`${displayFont.variable} ${sansFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DevChunkReload />
        <Suspense fallback={null}>
          <BookingAcquisitionTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
