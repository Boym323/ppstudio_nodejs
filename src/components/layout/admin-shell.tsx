"use client";

import { useCallback, useRef, useState } from "react";

import { AdminRole } from "@prisma/client";

import { AdminSidebarNav } from "@/features/admin/components/admin-sidebar-nav";
import { AdminOfflineBanner } from "@/features/pwa/admin-offline-banner";
import { useAdminModalFocus } from "@/features/admin/components/admin-drawer-escape-close";
import { cn } from "@/lib/utils";

type AdminShellProps = {
  children: React.ReactNode;
  currentRole: AdminRole;
  userName: string;
};

export function AdminShell({ children, currentRole, userName }: AdminShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const mobileMenuCloseRef = useRef<HTMLButtonElement>(null);
  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
    window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
  }, []);

  useAdminModalFocus({
    open: mobileSidebarOpen,
    containerRef: mobileMenuRef,
    initialFocusRef: mobileMenuCloseRef,
    onClose: closeMobileSidebar,
  });

  return (
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
          <button
            ref={menuTriggerRef}
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={mobileSidebarOpen}
            aria-controls="admin-mobile-navigation"
            className="min-h-11 min-w-11 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/84"
          >
            Menu
          </button>
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
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mobilní navigace administrace"
        className={cn(
          "fixed inset-0 z-50 bg-black/55 backdrop-blur-sm transition lg:hidden",
          mobileSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={closeMobileSidebar}
      >
        <aside
          ref={mobileMenuRef}
          id="admin-mobile-navigation"
          className={cn(
            "absolute left-0 top-0 flex h-[100dvh] w-[min(92vw,360px)] flex-col border-r border-white/10 bg-[#131116] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] shadow-[0_18px_48px_rgba(0,0,0,0.35)] transition",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Navigace</p>
              <p className="text-sm text-white/84">{userName}</p>
            </div>
            <button
              ref={mobileMenuCloseRef}
              type="button"
              onClick={closeMobileSidebar}
              className="min-h-11 min-w-11 rounded-full border border-white/10 px-3 py-2 text-sm text-white/72"
            >
              Zavřít
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <AdminSidebarNav
              currentRole={currentRole}
              userName={userName}
              onNavigate={closeMobileSidebar}
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
        </aside>
      </div>
      ) : null}
    </div>
  );
}
