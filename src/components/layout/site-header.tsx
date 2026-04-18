import Link from "next/link";

import { mainNavigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

import { Container } from "../ui/container";

type SiteHeaderProps = {
  variant?: "public" | "booking";
};

export function SiteHeader({ variant = "public" }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[color:rgba(17,17,17,0.72)] backdrop-blur-xl">
      <Container className="flex h-18 items-center justify-between gap-6">
        <Link href="/" className="font-display text-2xl tracking-[0.18em] text-white">
          {siteConfig.name}
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {mainNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm uppercase tracking-[0.16em] transition-colors",
                item.href === "/rezervace" && variant === "booking"
                  ? "text-[var(--color-accent)]"
                  : "text-white/72 hover:text-white",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>
    </header>
  );
}
