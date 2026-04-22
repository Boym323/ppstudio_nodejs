"use client";

import { useState } from "react";

import { AdminRole } from "@prisma/client";

import { AdminSidebarNav } from "@/features/admin/components/admin-sidebar-nav";
import { cn } from "@/lib/utils";

type AdminShellProps = {
  children: React.ReactNode;
  currentRole: AdminRole;
  userName: string;
};

export function AdminShell({ children, currentRole, userName }: AdminShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--color-admin-background)] text-[var(--color-admin-foreground)]">
      <div
        className={cn(
          "sticky top-0 z-40 border-b border-white/8 bg-[rgba(16,15,17,0.92)] px-4 py-3 backdrop-blur-xl transition lg:hidden",
          mobileSidebarOpen && "pointer-events-none opacity-0",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/42">PP Studio Admin</p>
            <p className="text-sm font-medium text-white/84">{currentRole === AdminRole.OWNER ? "Owner" : "Provoz salonu"}</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/84"
          >
            Menu
          </button>
        </div>
      </div>

      <div
        className={cn(
          "mx-auto grid min-h-screen w-full items-start gap-4 px-3 py-3 sm:px-6 sm:py-6 lg:gap-6 lg:px-6 lg:py-5 xl:px-7",
          "max-w-[min(100%,1860px)] lg:grid-cols-[224px_minmax(0,1fr)] xl:grid-cols-[228px_minmax(0,1fr)]",
        )}
      >
        <aside className="hidden rounded-[1.5rem] border border-white/7 bg-white/[0.03] p-3 backdrop-blur-xl lg:sticky lg:top-5 lg:block">
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
        <div className="min-w-0 space-y-6">{children}</div>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/55 backdrop-blur-sm transition lg:hidden",
          mobileSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden={!mobileSidebarOpen}
      >
        <aside
          className={cn(
            "absolute left-0 top-0 flex h-full w-[min(92vw,360px)] flex-col border-r border-white/10 bg-[#131116] px-4 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.35)] transition",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/42">Navigace</p>
              <p className="text-sm text-white/84">{userName}</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/72"
            >
              Zavřít
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <AdminSidebarNav currentRole={currentRole} userName={userName} />
          </div>

          <form action="/api/auth/logout" method="post" className="mt-4">
            <button
              type="submit"
              className="w-full rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80"
            >
              Odhlásit se
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
