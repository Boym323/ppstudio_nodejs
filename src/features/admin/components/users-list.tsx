"use client";

import type { AdminUsersPageData } from "@/features/admin/lib/admin-users";

import { AdminPanel } from "./admin-page-shell";
import { UserRow } from "./user-row";

export function UsersList({ users }: { users: AdminUsersPageData["users"] }) {
  return (
    <AdminPanel
      title="Seznam přístupů"
      description="Přehled účtů, rolí, stavu a dostupných akcí na jednom místě."
    >
      <div className="grid gap-3">
        {users.map((user) => (
          <UserRow key={user.id} user={user} />
        ))}
      </div>
    </AdminPanel>
  );
}
