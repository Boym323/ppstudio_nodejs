"use client";

import type { AdminUsersPageData } from "@/features/admin/lib/admin-users";

import { AdminPanel } from "./admin-page-shell";
import { UserRow } from "./user-row";

export function UsersList({ users }: { users: AdminUsersPageData["users"] }) {
  return (
    <AdminPanel
      title="Uživatelé"
      description="Hlavní pracovní část stránky se seznamem přístupů, jejich rolí, stavu a dostupných akcí."
    >
      <div className="grid gap-3">
        {users.map((user) => (
          <UserRow key={user.id} user={user} />
        ))}
      </div>
    </AdminPanel>
  );
}
