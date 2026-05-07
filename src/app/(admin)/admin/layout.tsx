import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Administrace | PP Studio",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
