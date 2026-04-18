import { SiteShell } from "@/components/layout/site-shell";

export default function BookingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SiteShell variant="booking">{children}</SiteShell>;
}
