import { AdminPageShell } from "@/features/admin/components/admin-page-shell";
import { AdminUsersWorkspace } from "@/features/admin/components/admin-users-workspace";
import { getAdminUsersPageData } from "@/features/admin/lib/admin-users";

export async function AdminUsersPage() {
  const data = await getAdminUsersPageData();

  return (
    <AdminPageShell
      eyebrow="Přístupy a role"
      title="Přístupy"
      description="Owner-only správa přístupů, rolí a systémových účtů bez zbytečné složitosti."
      stats={data.stats}
    >
      <AdminUsersWorkspace users={data.users} roleCards={data.roleCards} />
    </AdminPageShell>
  );
}
