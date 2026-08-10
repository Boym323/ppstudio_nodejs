"use client";

import { useEffect, useState } from "react";

import { AdminRole } from "@prisma/client";

import { AdminSidebarNav } from "@/features/admin/components/admin-sidebar-nav";
import { AdminOfflineBanner } from "@/features/pwa/admin-offline-banner";
import { cn } from "@/lib/utils";
import * as Sheet from "@/components/ui/sheet";

type AdminShellProps = {
  children: React.ReactNode;
  currentRole: AdminRole;
  userName: string;
};

export function AdminShell({ children, currentRole, userName }: AdminShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (mediaQuery.matches) setMobileSidebarOpen(false); };
    mediaQuery.addEventListener("change", closeOnDesktop);
    return () => mediaQuery.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <Sheet.Root open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
    <div className="admin-app min-h-dvh overflow-x-clip bg-[var(--color-admin-background)] text-[var(--color-admin-foreground)]">
      <AdminOfflineBanner />
      <header
        className={cn(
          "sticky top-0 z-40 border-b border-white/8 bg-[rgba(16,15,17,0.92)] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl transition lg:hidden",
          mobileSidebarOpen && "pointer-events-none opacity-0",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">PP Studio Admin</p>
            <p className="text-sm font-medium text-white/84">{currentRole === AdminRole.OWNER ? "Owner" : "Provoz salonu"}</p>
          </div>
          <Sheet.Trigger asChild><button type="button" className="min-h-11 min-w-11 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/84">Menu</button></Sheet.Trigger>
        </div>
      </header>

      <div
        className={cn(
          "mx-auto grid min-h-dvh w-full items-start gap-4 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:gap-6 lg:px-6 lg:py-5 xl:px-7",
          "max-w-[min(100%,1860px)] lg:grid-cols-[224px_minmax(0,1fr)] xl:grid-cols-[228px_minmax(0,1fr)]",
        )}
      >
        <aside
          aria-label="Hlavní navigace administrace"
          className="hidden rounded-[1.5rem] border border-white/7 bg-white/[0.03] p-3 backdrop-blur-xl lg:sticky lg:top-5 lg:block"
        >
          <AdminSidebarNav currentRole={currentRole} userName={userName} />
          <form action="/api/auth/logout" method="post" className="mt-5">
            <button
              type="submit"
              className="w-full rounded-full border border-white/8 bg-white/[0.025] px-4 py-2.5 text-sm text-white/66 transition hover:border-white/16 hover:bg-white/[0.05] hover:text-white"
            >
              Odhlásit se
            </button>
          </form>
        </aside>
        <main className="min-w-0 space-y-6">{children}</main>
      </div>

      {mobileSidebarOpen ? (
      <Sheet.Content asChild side="left" className="bg-[#131116] lg:hidden"><aside id="admin-mobile-navigation"><Sheet.Title className="sr-only">Mobilní navigace administrace</Sheet.Title><Sheet.Description className="sr-only">Navigace administrace a odhlášení.</Sheet.Description>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Navigace</p>
              <p className="text-sm text-white/84">{userName}</p>
            </div>
            <Sheet.Close asChild><button type="button" className="min-h-11 min-w-11 rounded-full border border-white/10 px-3 py-2 text-sm text-white/72">Zavřít</button></Sheet.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <AdminSidebarNav
              currentRole={currentRole}
              userName={userName}
              onNavigate={() => setMobileSidebarOpen(false)}
            />
          </div>

          <form action="/api/auth/logout" method="post" className="mt-4">
            <button
              type="submit"
              className="w-full rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80"
            >
              Odhlásit se
            </button>
          </form>
        </aside></Sheet.Content>
      ) : null}
    </div>
    </Sheet.Root>
  );
}
