"use client";

import { startTransition, useState } from "react";

import { AdminRole } from "@prisma/client";

import {
  changeAdminUserRoleAction,
  setAdminUserActiveAction,
} from "@/features/admin/actions/admin-user-actions";
import { type AdminUserAccessRecord } from "@/features/admin/lib/admin-users";
import { cn } from "@/lib/utils";

import { AccountStatusBadge } from "./account-status-badge";
import { InviteUserDialog } from "./invite-user-dialog";
import { RoleBadge } from "./role-badge";

export function UserRow({ user }: { user: AdminUserAccessRecord }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resendState, setResendState] = useState<{
    status: "idle" | "success" | "error";
    message?: string;
  }>({
    status: "idle",
  });
  const [isResendingInvite, setIsResendingInvite] = useState(false);

  function handleResendInvite() {
    setIsResendingInvite(true);
    setResendState({
      status: "idle",
    });

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/users/resend-invite", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | {
              status?: "success" | "error";
              message?: string;
            }
          | null;

        if (!response.ok || payload?.status !== "success") {
          setResendState({
            status: "error",
            message:
              payload?.message ??
              "Pozvanku se ted nepodarilo odeslat. Zkuste to prosim znovu.",
          });
          return;
        }

        setResendState({
          status: "success",
          message: payload.message,
        });
      } catch {
        setResendState({
          status: "error",
          message: "Pozvanku se ted nepodarilo odeslat. Zkuste to prosim znovu.",
        });
      } finally {
        setIsResendingInvite(false);
      }
    });
  }

  return (
    <>
      <article
        className={cn(
          "rounded-[1.35rem] border p-4 transition sm:p-4.5",
          user.isSystem
            ? "border-white/8 bg-white/[0.035]"
            : "border-white/10 bg-black/10 hover:border-white/16 hover:bg-white/[0.04]",
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h4 className="text-base font-medium text-white">{user.name}</h4>
              <RoleBadge role={user.role} />
              <AccountStatusBadge status={user.status} />
            </div>

            <p className="mt-2 text-sm text-white/72">{user.email}</p>
            <p className="mt-2 text-sm leading-6 text-white/58">{user.summary}</p>
            <p className="mt-2 text-sm leading-6 text-white/78">{user.helperText}</p>
          </div>

          <div className="flex flex-wrap gap-2 lg:max-w-[18rem] lg:justify-end">
            <button
              type="button"
              onClick={() => setDetailOpen((current) => !current)}
              className="rounded-full border border-white/10 px-3.5 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6"
            >
              {detailOpen ? "Skrýt detail" : "Detail"}
            </button>

            {user.canEdit ? (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="rounded-full border border-white/10 px-3.5 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6"
              >
                Upravit
              </button>
            ) : null}

            {user.canChangeRole ? (
              <form action={changeAdminUserRoleAction}>
                <input type="hidden" name="userId" value={user.id} />
                <input
                  type="hidden"
                  name="role"
                  value={user.role === AdminRole.OWNER ? "SALON" : "OWNER"}
                />
                <button
                  type="submit"
                  className="rounded-full border border-white/10 px-3.5 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6"
                >
                  {user.role === AdminRole.OWNER ? "Přepnout na SALON" : "Přepnout na OWNER"}
                </button>
              </form>
            ) : null}

            {user.canDeactivate ? (
              <form action={setAdminUserActiveAction}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="nextIsActive" value="false" />
                <button
                  type="submit"
                  className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3.5 py-2 text-sm text-amber-50 transition hover:border-amber-300/32 hover:bg-amber-400/16"
                >
                  Deaktivovat
                </button>
              </form>
            ) : null}

            {user.canActivate ? (
              <form action={setAdminUserActiveAction}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="nextIsActive" value="true" />
                <button
                  type="submit"
                  className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3.5 py-2 text-sm text-emerald-50 transition hover:border-emerald-300/32 hover:bg-emerald-400/16"
                >
                  Znovu aktivovat
                </button>
              </form>
            ) : null}

            {user.canResendInvite ? (
              <button
                type="button"
                onClick={handleResendInvite}
                disabled={isResendingInvite}
                className="rounded-full border border-white/10 px-3.5 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResendingInvite ? "Odesílám pozvánku..." : "Znovu poslat pozvánku"}
              </button>
            ) : null}
          </div>
        </div>

        {user.canResendInvite && resendState.status !== "idle" ? (
          <p
            className={cn(
              "mt-3 text-sm",
              resendState.status === "success" ? "text-emerald-200" : "text-red-200",
            )}
          >
            {resendState.message}
          </p>
        ) : null}

        {detailOpen ? (
          <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
            <DetailItem label="Role" value={user.role === AdminRole.OWNER ? "OWNER" : "SALON"} />
            <DetailItem label="Stav účtu" value={user.status} renderValue={<AccountStatusBadge status={user.status} />} />
            <DetailItem label="Vytvořeno" value={user.createdAtLabel} />
            <DetailItem label="Pozvánka" value={user.invitedAtLabel ?? "Bez čekající pozvánky"} />
            <DetailItem label="Poslední přihlášení" value={user.lastLoginAtLabel ?? "Zatím bez přihlášení"} />
            <DetailItem
              label="Možnosti"
              value={user.isSystem ? "Pouze čtení" : "Správa přes tuto sekci"}
            />
          </div>
        ) : null}
      </article>

      <InviteUserDialog
        open={editOpen}
        mode="edit"
        initialValues={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
}

function DetailItem({
  label,
  value,
  renderValue,
}: {
  label: string;
  value: string;
  renderValue?: React.ReactNode;
}) {
  return (
    <div className="rounded-[1rem] border border-white/7 bg-white/[0.03] px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">{label}</p>
      <div className="mt-2 text-sm leading-6 text-white/82">{renderValue ?? value}</div>
    </div>
  );
}
