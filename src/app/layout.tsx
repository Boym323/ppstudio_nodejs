import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";

import { siteConfig } from "@/config/site";
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
    metadataBase: new URL(siteConfig.url),
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
    alternates: {
      canonical: "/",
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${brandName} | ${siteConfig.title}`,
      description: siteConfig.description,
      url: siteConfig.url,
      siteName: brandName,
      locale: siteConfig.locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${brandName} | ${siteConfig.title}`,
      description: siteConfig.description,
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
        <BookingAcquisitionTracker />
        {children}
      </body>
    </html>
  );
}
