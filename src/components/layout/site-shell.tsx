import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type SiteShellProps = {
  children: React.ReactNode;
  variant?: "public" | "booking";
};

export function SiteShell({ children, variant = "public" }: SiteShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-background)]">
      <SiteHeader variant={variant} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
