import { AdminRole } from "@prisma/client";

import { AdminSidebarNav } from "@/features/admin/components/admin-sidebar-nav";

import { Container } from "../ui/container";

type AdminShellProps = {
  children: React.ReactNode;
  currentRole: AdminRole;
  userName: string;
};

export function AdminShell({ children, currentRole, userName }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-[var(--color-admin-background)] text-[var(--color-admin-foreground)]">
      <Container className="grid gap-5 py-5 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
        <aside className="rounded-[var(--radius-panel)] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <AdminSidebarNav currentRole={currentRole} userName={userName} />
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
