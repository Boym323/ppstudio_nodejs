import { AdminRole } from "@prisma/client";

import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import { getAdminRoleLabel } from "@/features/admin/lib/admin-user-presentation";

export function RoleBadge({ role }: { role: AdminRole }) {
  return <AdminStatePill tone={role === AdminRole.OWNER ? "accent" : "muted"}>{getAdminRoleLabel(role)}</AdminStatePill>;
}
