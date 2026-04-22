"use client";

import type { AdminUsersPageData } from "@/features/admin/lib/admin-users";

import { InviteUserDialog } from "./invite-user-dialog";
import { RoleCards } from "./role-cards";
import { UsersList } from "./users-list";
import { useState } from "react";

export function AdminUsersWorkspace({
  users,
  roleCards,
}: {
  users: AdminUsersPageData["users"];
  roleCards: AdminUsersPageData["roleCards"];
}) {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <>
      <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-white/70">
            Kdo má přístup, jakou má roli a co s ním lze udělat uvidíte hned bez dalšího rozklikávání.
          </p>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex justify-center rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
          >
            Pozvat uživatele
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
        <UsersList users={users} />
        <RoleCards roleCards={roleCards} />
      </div>

      <InviteUserDialog open={inviteOpen} mode="invite" onClose={() => setInviteOpen(false)} />
    </>
  );
}
