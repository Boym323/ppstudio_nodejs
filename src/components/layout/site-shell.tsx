import { getPublicSalonProfile } from "@/lib/site-settings";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type SiteShellProps = {
  children: React.ReactNode;
  variant?: "public" | "booking";
};

export async function SiteShell({ children, variant = "public" }: SiteShellProps) {
  const salonProfile = await getPublicSalonProfile();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-background)] overflow-x-clip">
      <SiteHeader variant={variant} brandName={salonProfile.name} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
