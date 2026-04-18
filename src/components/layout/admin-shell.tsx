import Link from "next/link";

import { AdminRole } from "@prisma/client";

import { adminNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

import { Container } from "../ui/container";

type AdminShellProps = {
  children: React.ReactNode;
  currentRole: AdminRole;
  userName: string;
};

export function AdminShell({ children, currentRole, userName }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-[var(--color-admin-background)] text-[var(--color-admin-foreground)]">
      <Container className="grid gap-6 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-[var(--radius-panel)] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="space-y-2 border-b border-white/10 pb-5">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Admin</p>
            <h1 className="font-display text-3xl text-white">PP Studio</h1>
            <p className="text-sm text-white/70">
              Přihlášen: {userName} • {currentRole === AdminRole.OWNER ? "Owner" : "Provoz"}
            </p>
          </div>
          <nav className="mt-5 space-y-2">
            {adminNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-2xl px-4 py-3 text-sm text-white/72 transition hover:bg-white/8 hover:text-white",
                  item.href === "/admin" && currentRole !== AdminRole.OWNER && "hidden",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action="/api/auth/logout" method="post" className="mt-6">
            <button
              type="submit"
              className="w-full rounded-full border border-white/10 px-4 py-3 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
            >
              Odhlásit se
            </button>
          </form>
        </aside>
        <div className="space-y-6">{children}</div>
      </Container>
    </div>
  );
}
