import { AdminPageShell } from "@/features/admin/components/admin-page-shell";
import { AdminUsersWorkspace } from "@/features/admin/components/admin-users-workspace";
import { getAdminUsersPageData } from "@/features/admin/lib/admin-users";

export async function AdminUsersPage() {
  const data = await getAdminUsersPageData();

  return (
    <AdminPageShell
      eyebrow="Správa přístupů"
      title="Uživatelé / role"
      description="Jednoduchá owner-only sekce pro správu přístupů v PP Studio. Bez technického balastu, bez dalších mezirolí a s jasným rozlišením mezi běžnými a systémovými účty."
      stats={data.stats}
    >
      <AdminUsersWorkspace users={data.users} roleCards={data.roleCards} />
    </AdminPageShell>
  );
}
